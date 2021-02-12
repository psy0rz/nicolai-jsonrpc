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

console.log("Example is running.");
