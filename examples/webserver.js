"use strict";

const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

class Webserver {
    constructor( opts ) {
        this._opts = Object.assign({
            port: 8080,
            host: "0.0.0.0",
            queue: 512,
            application: null
        }, opts);

        this._ws = new WebSocket.Server({
            noServer: true
        });

        this._ws.on("connection", this._onWsConnect.bind(this));
        this._ws.on("close", this._onWsClose.bind(this));
        this._wsPingInterval = setInterval(this._wsPing.bind(this), 2000);
        
        this._webserver = http.createServer(this._handle.bind(this)).listen(
            this._opts.port,
            this._opts.host,
            this._opts.queue
        );
        
        this._webserver.on("upgrade", (req, socket, head) => {
            this._ws.handleUpgrade(req, socket, head, (ws) => {
                this._ws.emit("connection", ws, req);
            });
        });
    }

    _onWsClose() {
        clearInterval(this._wsPingInterval);
    }

    _onWsConnect(ws) {
        ws.identifier = crypto.randomBytes(64).toString("base64"); // Used to keep track of connections within the session manager
        ws.isAlive = true;
        ws.on("message", this._onWsMessage.bind(this, ws));
        ws.on('pong', this._onWsHeartbeat.bind(this, ws));
    }
        
    _onWsMessage(ws, message) {
        this._opts.application.handle(message, ws, this._ws).then((result) => {
            ws.send(result);
        }).catch((error) => {
            ws.send(error);
        });
    }

    _wsPing() {
        this._ws.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping(()=>{});
        });
    }

    _onWsHeartbeat(ws) {
        ws.isAlive = true;
    }
    
    _handle(request, response) {
        // eslint-disable-next-line no-unused-vars
        const { method, url, headers } = request;
        let body = "";
        request.on("data", (data) => {
            body += data;
        });
        request.on("end", () => {
            if (method === "POST") {
                this._opts.application.handle(body, null, null).then((result) => {
                    response.writeHead(200, {"Content-Type": "application/json"});
                    response.end(result);
                }).catch((err) => {
                    if (typeof err==="string") {
                        response.writeHead(400, {"Content-Type": "application/json"});
                        response.end(err);
                    } else {
                        response.writeHead(500, {"Content-Type": "text/html"});
                        response.end("Internal server error");
                        throw err;
                    }
                });
            } else {
                response.writeHead(200, {"Content-Type": "application/json"});
                response.end(this._opts.application.usage());
            }
        });
    }
}

module.exports = Webserver;
