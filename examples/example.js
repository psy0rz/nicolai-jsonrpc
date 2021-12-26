"use strict";

const { Rpc, SessionManager, Webserver } = require("nicolai-jsonrpc");

var sessionManager = new SessionManager();
var rpc = new Rpc("Example", sessionManager);

var webserver = new Webserver({
    port: 8000,
    host: "0.0.0.0",
    application: rpc
});

class User {
    constructor(name) {
        this.name = name;
        this.permissions = [];
    }
    
    serialize() {
        return {name: this.name};
    }
    
    getPermissions() {
        return this.permissions;
    }
    
    checkPermission(method) {
        for (let index = 0; index < this.permissions.length; index++) {
            if (method.startsWith(this.permissions[index])) {
                return true;
            }
        }
        return false;
    }
}

async function authenticate(parameters, session) {
    if (session === null) {
        throw "Invalid session";
    }
    session.setUser(new User(parameters.name));
}

rpc.addMethod(
    "authentication/login",
    authenticate,
    {
        type: "object",
        required: {
            name: {
                type: "string"
            }
        },
        optional: {
            password: {
                type: "string"
            }
        }
    },
    {
        type: "none"
    },
    true
);

console.log("Example is running.");

function printSessions() {
    sessionManager.listSessions(null, null).then((result) => {
        console.log(result);
    }).catch((error) => {
        console.error(error);
    });
}

//setInterval(printSessions, 1000);
