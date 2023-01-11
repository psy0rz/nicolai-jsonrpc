/**
 * Copyright 2022 Renze Nicolai
 * SPDX-License-Identifier: MIT
 */

"use strict";

const Ajv = require("ajv/dist/2019");

class Rpc {
    constructor(aIdentity = "", aSessionManager = null, aVerbose = true) {
        this._identity = aIdentity;
        this._sessionManager = aSessionManager;
        this._methods = {};
        this._verbose = aVerbose;

        if (typeof this._identity === "string") {
            // Legacy compatibility
            this._identity = {
                title: this._identity,
                version: ""
            };
        } else if (typeof this._identity !== "object") {
            throw new Error("Expected identity to be an object");
        }

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

        // A method that returns API usage information
        // eslint-disable-next-line no-unused-vars
        this.addPublicMethod("usage", (parameters, session) => { return this.usage(); }, {type: "null"}, {type: "object", description: "Object describing this API"});

        // A method that allows for executing a connection test
        // eslint-disable-next-line no-unused-vars
        this.addPublicMethod("ping", (parameters, session) => { return "pong"; }, {type: "null"}, {type: "string", description: "A string containing the text 'pong'"});

        // A method that returns the list of available methods
        // eslint-disable-next-line no-unused-vars
        this.addPublicMethod("methods", (parameters, session) => { return this.getMethods(); }, {type: "null"}, {type: "array", description: "List of methods", items: {type: "string"}});

        // Add methods for managing sessions
        if (this._sessionManager) {
            if (typeof this._sessionManager.registerRpcMethods === "function") {
                this._sessionManager.registerRpcMethods(this);
            }
        }
    }
    
    usage() {
        let authorizationParameter = [
            {
                name: "Token",
                in: "header",
                description: "Authorization token",
                required: true,
                schema: {
                    type: "string"
                }
            }
        ];
        let output = {
            openapi: "3.0.0",
            info: this._identity,
            paths: {
                "/": {
                    post: {
                        operationId: "JSON-RPC v2.0 interface",
                        summary: "Access this API via JSON-RPC 2.0 messages",
                        responses: {
                            "200": {
                                description: "200 response",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                jsonrpc: {
                                                    type: "string",
                                                    description: "Must contain the text '2.0'"
                                                },
                                                id: {
                                                    type: "string",
                                                    description: "Identifier for the request, can be freely chosen"
                                                },
                                                result: {

                                                },
                                                error: {

                                                }
                                            },
                                            required: ["jsonrpc", "id", "result", "error"]
                                        }
                                    }
                                }
                            }
                        },
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            jsonrpc: {
                                                type: "string",
                                                description: "Must contain the text '2.0'"
                                            },
                                            id: {
                                                type: "string",
                                                description: "Identifier for the request, can be freely chosen"
                                            },
                                            method: {
                                                type: "string",
                                                description: "Method to be executed"
                                            },
                                            params: {
                                                description: "Depends on the method called"
                                            },
                                            token: {
                                                type: "string",
                                                description: "Authentication token"
                                            }
                                        },
                                        required: [
                                            "jsonrpc", "id", "method"
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };
        for (let method in this._methods) {
            let methodInfo = this._methods[method];
            output.paths["/" + method] = {};
            let resultSchemaContainer = {};
            if ((methodInfo.ajvValidateResult !== null) && (typeof methodInfo.resultSchema === "object")) {
                resultSchemaContainer = {schema: methodInfo.resultSchema};
            }
            if ((methodInfo.ajvValidateParameters === null) || (typeof methodInfo.parameterSchema !== "object")) {
                console.log("Warning: RPC method '" + method + "' does not have a valid parameter schema defined");
            } else {
                let description = {
                    operationId: method,
                    summary: "",
                    responses: {
                        "200": {
                            description: "200 response",
                            content: {
                                "application/json": resultSchemaContainer
                            }
                        }
                    }
                };
                if (!methodInfo.public) {
                    description.parameters = authorizationParameter;
                }
                if (methodInfo.parameterSchema.type !== "null") {
                    // Parameters: POST request
                    description.requestBody = {
                        required: true,
                        content: {
                            "application/json": {
                                schema: methodInfo.parameterSchema
                            }
                        }
                    };
                    output.paths["/" + method].post = description;
                } else {
                    // No parameters: GET request
                    output.paths["/" + method].get = description;
                }
            }

        }
        return output;
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

    getMethods() {
        var methods = [];
        for (let method in this._methods) {
            methods.push(method);
        }
        return methods;
    }

    addPublicMethod(name, callback, parameterSchema, resultSchema) {
        return this.addMethod(name, callback, parameterSchema, resultSchema, true);
    }
    
    addMethod(name, callback, parameterSchema, resultSchema, isPublic = false) {
        if (typeof name !== "string") {
            throw Error("Expected the method name to be a string");
        }
        if (typeof callback !== "function") {
            throw Error("Expected the callback for method \"" + name + "\" to be a function");
        }

        let ajvValidateParameters = null;
        let ajvValidateResult = null;

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
                    throw {
                        code: this._errors.parameters.code,
                        message: this._errors.parameters.message,
                        reason: ajvValidate.errors
                    };
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
                    throw {
                        code: this._errors.parameters.code,
                        message: this._errors.parameters.message,
                        reason: reason
                    };
                }
            }
        }
        
        // 4) Execute the method
        return this._methods[method].callback(parameters, session, connection);
    }
    
    async _handle(request, connection, token = null) {
        let response = {jsonrpc: "2.0", id: null, result: null, error: null};
        
        // 1) Check if the request is valid
        if ((typeof request !== "object") || (typeof request.jsonrpc !== "string") || (request.jsonrpc !== "2.0") || (typeof request.id === "undefined") || (typeof request.method !== "string")) {
            response.error = this._errors.invalid;
            return response;
        }
        
        // 2) Fill in missing request fields
        request = Object.assign({ id: null, params: null, token: token }, request);
        
        // 3) Copy the request identifier into the response
        response.id = request.id;
        
        // 4) Execute the request and return either a result or an error
        try {
            response.result = await this._execute(request.method, request.params, request.token, connection);
        } catch (error) {
            if (typeof error === "string") {
                response.error = {
                    code: this._errors.returnString.code,
                    message: error
                };
            } else if (typeof error === "object") {
                if (error instanceof Error) {
                    if (error.message === "Access denied") {
                        response.error = this._errors.permission;
                    } else {
                        response.error = {
                            code: this._errors.returnError.code,
                            message: error.message
                        };
                    }
                } else {
                    response.error = error;
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
    
    async handle(request, connection = null, token = null) {
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
                promises.push(this._handle(request[index], connection, token));
            }
            return JSON.stringify(await Promise.all(promises));
        } else {
            // The request is a singular request
            return JSON.stringify(await this._handle(request, connection, token));
        }
    }

    async handleHttpRequest(url, parameters = null, token = null) {
        if (url[0] === "/") {
            url = url.substring(1);
        }
        try {
            let result = await this._execute(url, parameters, token);
            return JSON.stringify(result);
        } catch (error) {
            if (typeof error === "string") {
                error = Object.assign(this._errors.returnString, {message: error});
            } else if (typeof error === "object") {
                if (error instanceof Error) {
                    error = Object.assign(this._errors.returnError, {message: error.message});
                    if (error.message === "Access denied") {
                        error = this._errors.permission;
                    }
                } else {
                    error = Object.assign(this._errors.returnCustom, error);
                }
            } else {
                error = this._errors.internal;
            }
            if (this._verbose) {
                console.error("HTTP request RPC call to '" + url + "' failed", error, token);
            }
            throw JSON.stringify(error);
        }
    }
}

module.exports = Rpc;
