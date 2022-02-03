/**
 * RPC library
 *
 * @license
 * Copyright 2022 Renze Nicolai
 * This code is released under the MIT license.
 * SPDX-License-Identifier: MIT
 */

"use strict";

const checkParameters = require("./checkParameters.js");

let Ajv;
try {
    Ajv = require("ajv");
} catch (error) {
    Ajv = null;
}

class Rpc {
    constructor(aIdentity = "", aSessionManager = null, aEnablePing = true, aEnableUsage = true, aVerbose = true) {
        this._identity = aIdentity;
        this._sessionManager = aSessionManager;
        this._methods = {};
        this._enableUsage = aEnableUsage;
        this._verbose = aVerbose;

        if (Ajv !== null) {
            this._ajv = new Ajv();
        } else {
            this._ajv = null;
        }
        
        this._errors = {
            parse:          { code: -32700, message: "Parse error"           }, // As defined in JSON-RPC 2.0
            invalid:        { code: -32600, message: "Invalid Request"       }, // As defined in JSON-RPC 2.0
            method:         { code: -32601, message: "Method not found"      }, // As defined in JSON-RPC 2.0
            parameters:     { code: -32602, message: "Invalid params"        }, // As defined in JSON-RPC 2.0
            internal:       { code: -32603, message: "Internal error"        }, // As defined in JSON-RPC 2.0
            permission:     { code: -32000, message: "Access denied"         }, // Custom: returned when the permissions of the client are insufficient to execute the request
            invalidToken:   { code: -32001, message: "Invalid token"         }, // Custom: returned when the token supplied by the client can not be associated with a session
            returnString:   { code: -32002, message: ""                      }, // Custom: returned when the executed method throws a string
            returnError:    { code: -32003, message: ""                      }, // Custom: returned when the executed method throws an Error
            returnCustom:   { code: -32004, message: ""                      }, // Custom: returned when the executed method throws an unknown type of object
        };

        if (aEnablePing) {
            // Add a method that returns API usage information
            // eslint-disable-next-line no-unused-vars
            this.addMethod("usage", (params, session) => { return this.usage(); }, {type: "none"}, {type: "object", description: "Object describing this API"}, true);
        }

        if (aEnableUsage) {
            // Add a method that allows for executing a connection test
            // eslint-disable-next-line no-unused-vars
            this.addMethod("ping", (params, session) => { return "pong"; }, {type: "none"}, {type: "string", description: "A string containing the text 'pong'"}, true);
        }

        // Add methods for managing sessions
        if (this._sessionManager) {
            if (typeof this._sessionManager.registerRpcMethods === "function") {
                this._sessionManager.registerRpcMethods(this);
            }
        }
    }
    
    usage() {
        if (this._enableUsage) {
            return {
                service: this._identity,
                methods: this.listMethods()
            };
        } else {
            return {};
        }
    }
    
    listMethods(onlyPublic = false, returnArray = false) {
        let methods = returnArray ? [] : {};
        for (let methodName in this._methods) {
            let parameters = null;
            if (typeof this._methods[methodName].parameterSchema !== "undefined") {
                parameters = this._methods[methodName].parameterSchema;
            }
            if (this._methods[methodName].public || (!onlyPublic)) {
                if (returnArray) {
                    methods.push(methodName);
                } else {
                    methods[methodName] = {parameters: parameters, result: this._methods[methodName].resultSchema, public: this._methods[methodName].public};
                }
            }
        }
        return methods;
    }
    
    addMethod(name, callback, parameterSchema, resultSchema, isPublic = false, useAjvForSchema = false) {
        if (useAjvForSchema && (this._ajv === null)) {
            //throw Error("Ajv schema parser required but not available");
            console.log("Warning: method '" + name + "' requests Ajv schema parser, but Ajv is not available");
            useAjvForSchema = false;
        }
        if (typeof name !== "string") {
            throw Error("Expected the method name to be a string");
        }
        if (typeof callback !== "function") {
            throw Error("Expected the callback for method \"" + name + "\" to be a function");
        }

        let ajvValidateParameters = null;
        let ajvValidateResult = null;

        if (useAjvForSchema) {
            // JSON schema parser using Ajv
            try {
                ajvValidateParameters = this._ajv.compile(parameterSchema);
            } catch (error) {
                console.error("Failed to compile parameter schema for method '" + name + "'");
                throw error;
            }
            try {
                ajvValidateResult = this._ajv.compile(resultSchema);
            } catch (error) {
                console.error("Failed to compile result schema for method '" + name + "'");
                throw error;
            }
        } else {
            // Legacy custom schema language
            if (typeof parameterSchema !== "object") {
                throw Error("Expected the parameter schema for method \"" + name + "\" to be either an object or an array of objects");
            }
            if (!Array.isArray(parameterSchema)) {
                parameterSchema = [parameterSchema]; // Encapsulate parameter schema in an array to allow for supplying multiple specifications
            }
            for (let index = 0; index < parameterSchema.length; index++) {
                if (typeof parameterSchema[index].type !== "string") {
                    throw Error("Expected each parameter schema for method \"" + name + "\" to contain a type declaration");
                }
            }

            if (typeof resultSchema !== "object") {
                throw Error("Expected the result schema for method \"" + name + "\" to be either an object or an array of objects");
            }
            if (!Array.isArray(resultSchema)) {
                resultSchema = [resultSchema]; // Encapsulate result schema in an array to allow for supplying multiple specifications
            }
            for (let index = 0; index < resultSchema.length; index++) {
                if (resultSchema[index] === null) {
                    console.log("Warning: method '" + name + "' defines no result schema");
                    continue;
                }
                if (typeof resultSchema[index].type !== "string") {
                    throw Error("Expected each result schema for \"" + name + "\" to contain a type declaration");
                }
            }
        }

        this._methods[name] = {
            callback: callback,
            parameterSchema: parameterSchema,
            resultSchema: resultSchema,
            public: isPublic,
            ajvValidateParameters: ajvValidateParameters,
            ajvValidateResult: ajvValidateResult
        };

        if (this._sessionManager !== null) {
            this._sessionManager.setPublicMethods(this.listMethods(true, true));
        }
    }

    addPushStub(name, isPublic = false, description = "This method can only be used as a push message topic") {
        let result = this.addMethod(
            name,
            async (parameters, session) => {
                throw Error("Please subscribe to this method via the push message API, no RPC functionality is implemented for this method.");
            },
            {type: "null", description: description},
            {type: "null"},
            isPublic,
            false
        );

        if (this._sessionManager !== null) {
            this._sessionManager.setPublicMethods(this.listMethods(true, true));
        }

        return result;
    }
    
    deleteMethod(name) {
        if (this._methods[name]) {
            delete this._methods[name];
            return true;
        }
        if (this._sessionManager !== null) {
            this._sessionManager.setPublicMethods(this.listMethods(true, true));
        }
        return false;
    }
    
    async _execute(method = null, parameters = null, token = null, connection=null) {
        // 1) Check if the method exists
        if (typeof this._methods[method] !== "object") {
            throw this._errors.method;
        }
        
        // 2) Check if the client is authorized to execute the method
        let session = null;
        if (this._sessionManager !== null) {
            if (token !== null) {
                session = this._sessionManager.getSession(token);
                if (session === null) {
                    throw this._errors.invalidToken;
                }
            }
            if (session !== null) {
                if (typeof session.use === "function") {
                    session.use();
                }
                if (typeof session.setConnection === "function") {
                    session.setConnection(connection);
                }
            }
            if (this._methods[method].public === false) {
                if ((session === null) || ((typeof session.checkPermission === "function") && (!session.checkPermission(method)))) {
                    throw this._errors.permission;
                }
            }
        }
        
        // 3) Check if the client has provided valid parameters
        if ((typeof this._methods[method].parameterSchema !== "undefined") && (this._methods[method].parameterSchema !== null)) {
            let ajvValidate = this._methods[method].ajvValidateParameters;
            if (ajvValidate !== null) {
                let valid = ajvValidate(parameters);
                if (!valid) {
                    throw Object.assign(this._errors.parameters, {"reason": ajvValidate.errors});
                }
            } else {
                // Legacy validator
                let valid = false;
                let reason = "";
                for (var i = 0; i < this._methods[method].parameterSchema.length; i++) {
                    let constraints = this._methods[method].parameterSchema[i];
                    const [result, subReason] = checkParameters(parameters, constraints);
                    reason = subReason;
                    if (result) {
                        valid = true;
                        break;
                    }
                }
                if (!valid) {
                    throw Object.assign(this._errors.parameters, {"reason": reason});
                }
            }
        }
        
        // 4) Execute the method
        return this._methods[method].callback(parameters, session, connection);
    }
    
    async _handle(request, connection) {
        let response = {jsonrpc: "2.0", id: null, result: null, error: null};
        
        // 1) Check if the request is valid
        if ((typeof request !== "object") || (typeof request.jsonrpc !== "string") || (request.jsonrpc !== "2.0") || (typeof request.id === "undefined") || (typeof request.method !== "string")) {
            response.error = this._errors.invalid;
            return response;
        }
        
        // 2) Fill in missing request fields
        request = Object.assign({ id: null, params: null, token: null }, request);
        
        // 3) Copy the request identifier into the response
        response.id = request.id;
        
        // 4) Execute the request and return either a result or an error
        try {
            response.result = await this._execute(request.method, request.params, request.token, connection);
        } catch (error) {
            if (typeof error === "string") {
                response.error = Object.assign(this._errors.returnString, {message: error});
            } else if (typeof error === "object") {
                if (error instanceof Error) {
                    response.error = Object.assign(this._errors.returnError, {message: error.message});
                    if (error.message === "Access denied") {
                        response.error = this._errors.permission;
                    }
                } else {
                    response.error = Object.assign(this._errors.returnCustom, error);
                }
            } else {
                response.error = this._errors.internal;
            }
            if (this._verbose) {
                console.error("RPC call to '" + request.method + "' failed", error);
            }
        }
        return response;
    }
    
    async handle(request, connection = null) {
        // 1) If the request is a string then the request will be parsed as JSON data
        if (typeof request === "string") {
            try {
                request = JSON.parse(request);
            } catch (error) {
                return JSON.stringify({jsonrpc: "2.0", id: null, result: null, error: this._errors.parse});
            }
        }
        
        // 2) If the request isn"t an existing object
        if ((typeof request !== "object") || (request === null)) {
            return JSON.stringify({jsonrpc: "2.0", id: null, result: null, error: this._errors.invalid});
        }
        
        // 3) Execute the request
        if (Array.isArray(request)) {
            // The request is an array containing multiple requests
            let promises = [];
            for (let index = 0; index < request.length; index++) {
                promises.push(this._handle(request[index], connection));
            }
            return JSON.stringify(await Promise.all(promises));
        } else {
            // The request is a singular request
            return JSON.stringify(await this._handle(request, connection));
        }
    }
}

module.exports = Rpc;
