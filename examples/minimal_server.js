"use strict";

const { Rpc, SessionManager, Webserver } = require("nicolai-jsonrpc");

var rpc = new Rpc("Minimal webserver example");

var webserver = new Webserver({
    port: 8000,
    host: "0.0.0.0",
    application: rpc
});

/* Add an API method */

async function test(parameters, session) {
    console.log("test(", parameters, ")");
    return "Test says hi!";
}

rpc.addMethod(
    "test", // Method name
    test, // Async function for handling the API request
    { type: "string" }, // Allowed parameters
    { type: "string" }, // Structure of the response
    true // Disable authentication checking
);

console.log("Connect via HTTP or websockets to http://localhost:8000/");
console.log("And send a POST request or a websockets message with the following contents:");
console.log('{"jsonrpc": "2.0", "id": "123", "method":"test", "params":"Hello world"}');
