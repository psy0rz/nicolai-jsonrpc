"use strict";

const Webserver = require('./webserver.js');
const { Rpc, SessionManager } = require('simple-json-rpc');

var sessionManager = new SessionManager();
var rpc = new Rpc("Example", sessionManager);

var webserver = new Webserver({
    port: 8080,
    host: '0.0.0.0',
    application: rpc
});

class User {
    constructor(username) {
        this.username = username;
        this.permissions = [];
    }
    
    serialize() {
        return {username: this.username};
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
    session.setUser(new User(parameters.username));
}

rpc.addMethod(
    "user/authenticate",
    authenticate,
    {
        type: "object",
        required: {
            username: {
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
