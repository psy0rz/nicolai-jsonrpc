/**
 * Copyright 2022 Renze Nicolai
 * SPDX-License-Identifier: MIT
 */

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
            application: null,
            timeout: 30000,
            usage: true,
            homepage: "<h1>API server</h1>",
            url: ""
        }, opts);

        this._ws = new WebSocket.Server({
            noServer: true
        });

        this._ws.on("connection", this._onWsConnect.bind(this));
        this._ws.on("close", this._onWsClose.bind(this));
        this._wsPingInterval = setInterval(this._wsPing.bind(this), this._opts.timeout);
        
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

    _onWsClose(code, data) {
        //const reason = data.toString();
        clearInterval(this._wsPingInterval);
    }

    _onWsConnect(ws) {
        ws.identifier = crypto.randomBytes(64).toString("base64"); // Used to keep track of connections within the session manager
        ws.isAlive = true;
        ws.on("message", this._onWsMessage.bind(this, ws));
        ws.on('pong', this._onWsHeartbeat.bind(this, ws));
    }
        
    _onWsMessage(ws, data, isBinary) {
        let message = isBinary ? data : data.toString();
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
        let { method, url, headers } = request;
        if (url.startsWith(this._opts.url)) {
            url = url.substring(this._opts.url.length);
        }
        let token = null;
        console.log(headers);
        if ("token" in headers) {
            token = headers.token.split(" ").pop();
        } else if ("authorization" in headers) {
            token = headers.authorization.split(" ").pop();
        }
        let body = "";
        request.on("data", (data) => {
            body += data;
        });
        request.on("end", () => {
            console.log("Request", method, url);
            if (url === "/") {
                if (method === "POST") {
                    this._opts.application.handle(body, null, token).then((result) => {
                        response.writeHead(200, {"Content-Type": "application/json"});
                        response.end(result);
                    }).catch((err) => {
                        if (typeof err==="string") {
                            response.writeHead(500, {"Content-Type": "application/json"});
                            response.end(err);
                        } else {
                            response.writeHead(500, {"Content-Type": "text/html"});
                            response.end("Internal server error");
                            throw err;
                        }
                    });
                } else if (this._opts.usage) {
                    response.writeHead(200, {"Content-Type": "application/json"});
                    response.end(JSON.stringify(this._opts.application.usage()));
                } else {
                    response.writeHead(200, {"Content-Type": "text/html"});
                    response.end(this._opts.homepage);
                }
            } else {
                let parameters = null;

                if (method === "POST") {
                    if (("content-type" in headers) && (headers["content-type"] === "application/json")) {
                        try {
                            parameters = JSON.parse(body);
                        } catch (error) {
                            response.writeHead(400, {"Content-Type": "text/html"});
                            response.end("Invalid request");
                        }
                    } else {
                        parameters = body;
                    }
                }

                this._opts.application.handleHttpRequest(url, parameters, token).then((result) => {
                    response.writeHead(200, {"Content-Type": "application/json"});
                    response.end(result);
                }).catch((error) => {
                    if (typeof error === "string") {
                        response.writeHead(500, {"Content-Type": "application/json"});
                        response.end(error);
                    } else {
                        response.writeHead(500, {"Content-Type": "text/html"});
                        response.end("Internal server error");
                        throw error;
                    }
                });

                if (response.error === null) {
                    response.writeHead(200, {"Content-Type": "text/html"});
                    response.end(JSON.stringify(response.result));
                }
            }
        });
    }
}

module.exports = Webserver;
