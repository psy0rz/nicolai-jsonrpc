"use strict";

const { Rpc, SessionManager, Webserver } = require("nicolai-jsonrpc");

var sessionManager = new SessionManager();
var rpc = new Rpc("Session manager example", sessionManager);

var webserver = new Webserver({
    port: 8000,
    host: "0.0.0.0",
    application: rpc
});

class User {
    /* This class is just an example */
    constructor(name) {
        this.name = name;
        this.permissions = [
            "example"
        ];
    }
    
    serialize() {
        /* This function is only used in this example to be able to return the user object after authentication */
        return {
            name: this.name
        };
    }
    
    getPermissions() {
        /* This function is used by the session manager to generate the list of methods granted permission to for a session
           this list is returned by the 'session/state' API call. */
        return this.permissions;
    }
    
    checkPermission(method) {
        /* This function is used by the session manager to either grant or deny access to an API method */
        for (let index = 0; index < this.permissions.length; index++) {
            if (method.startsWith(this.permissions[index])) {
                return true;
            }
        }
        return false;
    }
}

let testUser = new User("test");

async function authenticate(parameters, session) {
    if (session === null) {
        throw "Invalid session";
    }
    if ((parameters.name === "test") && (parameters.password === "test")) {
        session.setUser(testUser);
    } else {
        throw Error("Invalid username / password combination, use 'test' as username and as password to authenticate to this example server.");
    }
    return testUser.serialize();
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
    true // This method is public and may always be accessed
);

async function authorizedAction(parameters, session) {
    // No need to check the parameters, the library does this by itself using the schema supplied when registering the method
    let sum = parameters.reduce((previousValue, currentValue) => { return previousValue + currentValue}, 0); // Sum of the array passed as parameters
    return "Authorized action executed, result is: " + sum;
}

rpc.addMethod(
    "example",
    authorizedAction,
    { // Allowed arguments
        type: "array",
        contains: "number"
    },
    { // Returned result
        type: "string"
    },
    false // This method is private and may only be accessed if authenticated
);

console.log("Session manager example is running.");

function printSessions() {
    sessionManager.listSessions(null, null).then((result) => {
        console.log(result);
    }).catch((error) => {
        console.error(error);
    });
}

//setInterval(printSessions, 1000);
