"use strict";

const Rpc  = require("nicolai-jsonrpc/rpc.js");

var rpc = new Rpc("Basic example");

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

/* Call the API method */

rpc.handle('{"jsonrpc": "2.0", "id": "123", "method":"test", "params":"Hello world"}').then((response) => {
    console.log("Response:", response);
});

/* Query API usage */

/*
rpc.handle('{"jsonrpc": "2.0", "id": "123", "method":"usage", "params":null}').then((response) => {
    console.log("Usage:", response);
});
*/
