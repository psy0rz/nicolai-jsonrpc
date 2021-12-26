/**
* @license
* Copyright 2021 Renze Nicolai
* This code is released under the MIT license.
* SPDX-License-Identifier: MIT
*/

/**
 * @tutorial
 * Creating an API is done by instantiating the RPC class with
 * 
 * Optional parameters:
 *  - An identity: a string containing the name of the API
 *  - A session manager object which implements a getSession(token) function which returns a session
 * 
 * A session may implement the following functions:
 *  - setConnection(connection)
 *  - checkPermission(method) -> bool : a function which returns a boolean indicating weither or not the requested method may be executed
 */

"use strict";

class Rpc {
    constructor(aIdentity = "", aSessionManager = null) {
        this._identity = aIdentity;
        this._sessionManager = aSessionManager;
        this._methods = {};
        
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

        // Add a method that returns API usage information
        // eslint-disable-next-line no-unused-vars
        this.addMethod("usage", (params, session) => { return this.usage(); }, {type: "none"}, {type: "object", description: "Object describing this API"}, true);

        // Add a method that allows for executing a connection test
        // eslint-disable-next-line no-unused-vars
        this.addMethod("ping", (params, session) => { return "pong"; }, {type: "none"}, {type: "string", description: "A string containing the text 'pong'"}, true);

        // Add methods for managing sessions
        if (this._sessionManager) {
            if (typeof this._sessionManager.registerRpcMethods === "function") {
                this._sessionManager.registerRpcMethods(this);
            }
        }
    }

    _checkParameters(parameters, constraints, path="/") {
        let accepted = false;
        let reason = "Unspecified ("+path+")";
        // 1) When no parameters are supplied
        if ((parameters === null) && ((constraints.type === "none") || (constraints.type === "null"))) {
            accepted = true;
        } else if (parameters === null) {
            reason = "Found NULL, expected \"" + constraints.type + "\" ("+path+")";
        }
        // 2) When the function accepts any argument
        if (constraints.type === "any") {
            accepted = true;
        }
        // 3) When the function accepts a string argument
        else if ((typeof parameters === "string") && (constraints.type === "string")) {
            accepted = true;
        } else if (typeof parameters === "string") {
            reason = "Found \"string\", expected \"" + constraints.type + "\" ("+path+")";
        }
        // 4) When the function accepts a number argument
        else if ((typeof parameters === "number") && (constraints.type === "number")) {
            accepted = true;
        } else if (typeof parameters === "number") {
            reason = "Found \"number\", expected \"" + constraints.type + "\" ("+path+")";
        }
        // 5) When the function accepts a boolean argument
        else if ((typeof parameters === "boolean") && (constraints.type === "boolean")) {
            accepted = true;
        } else if (typeof parameters === "boolean") {
            reason = "Found \"boolean\", expected \"" + constraints.type + "\" ("+path+")";
        }
        // 6) When the function accepts an array
        else if ((typeof parameters === "object") && (Array.isArray(parameters)) && (constraints.type === "array")) {
            if ((typeof constraints.length === "number") && (parameters.length !== constraints.length)) {
                // Length is defined and does not match
                reason = "Length mismatch ("+path+")";
                accepted = false;
            } else if ((typeof constraints.minlength === "number") && (parameters.length < constraints.minlength)) {
                // Minimum length is defined and does not match
                reason = "Length less than minimum ("+path+")";
                accepted = false;
            } else if ((typeof constraints.maxlength === "number") && (parameters.length > constraints.maxlength)) {
                // Maximum length is defined and does not match
                reason = "Length larger than maximum ("+path+")";
                accepted = false;
            } else if (typeof constraints.contains === "string") {
                accepted = true;
                if (constraints.contains !== "any") {
                    for (let index = 0; index < parameters.length; index++) {
                        if (typeof parameters[index] !== constraints.contains) {
                            reason = "Type mismatch ("+path+")";
                            accepted = false;
                            break;
                        }
                    }
                }
            } else if (typeof constraints.contains === "object") {
                accepted = true;
                for (let index = 0; index < parameters.length; index++) {
                    const [result, subReason] = this._checkParameters(parameters[index], constraints.contains, path + "@" + index + "/");
                    if (!result) {
                        accepted = false;
                        reason = subReason;
                        break;
                    }
                }
            } else {
                // No valid constraints found for the contents of the array
                accepted = true;
            }
        } else if ((typeof parameters === "object") && (Array.isArray(parameters)) && (constraints.type !== "array")) {
            reason = "Found \"array\", expected \"" + constraints.type + "\" ("+path+")";
        }
        // 7) When the function accepts an object
        else if ((typeof parameters === "object") && (constraints.type === "object")) {
            if ((typeof constraints.contains === "object") && (typeof constraints.required === "undefined")) {
                constraints.required = constraints.contains;
            }
            if (parameters === null) {
                // When the object is null
                accepted = (typeof constraints.allowNull === "boolean") && (constraints.allowNull === true);
                if (!accepted) {
                    reason = "Expected element, found NULL ("+path+")";
                }
            } else if ((typeof constraints.required === "undefined") && (typeof constraints.optional === "undefined")) {
                // When the object has no constraints
                accepted = true;
            } else {
                accepted = true;
                // When the object has required parameters
                if (typeof constraints.required !== "undefined") {
                    for (let item in constraints.required) {
                        if (typeof parameters[item] === "undefined") {
                            // And a required parameter is missing
                            reason = "Required parameter is missing ("+path+")";
                            accepted = false;
                            break;
                        }
                        if (typeof constraints.required[item].type !== "undefined") {
                            // If constraints are set for the content of the required parameter
                            const [result, subReason] = this._checkParameters(parameters[item], constraints.required[item], path + item + "/");
                            if (!result) {
                                // The constraints of the parameter were not met
                                accepted = false;
                                reason = subReason;
                                break;
                            }
                        }
                    }
                }
                
                // Check that the object does not contain stray parameters
                for (let item in parameters) {
                    if ((typeof constraints.required !== "undefined") && (item in constraints.required)) {
                        // The parameter is a required parameter
                        continue;
                    } else if ((typeof constraints.optional !== "undefined") && (item in constraints.optional)) {
                        // The parameter is an optional parameter
                        if (typeof constraints.optional[item].type !== "undefined") {
                            // If constraints are set for the contents of the optional parameter
                            const [result, subReason] = this._checkParameters(parameters[item], constraints.optional[item], path + item + "/");
                            if (!result) {
                                // The constraints of the parameter were not met
                                accepted = false;
                                reason = subReason;
                                break;
                            }
                        }
                    } else {
                        // The parameter is neither a required or an optional parameter
                        reason = "Found stray parameter " + path + item;
                        accepted = false;
                        break;
                    }
                }
            }
        } else if ((typeof parameters === "object") && (constraints.type !== "object")) {
            reason = "Found \"object\", expected \"" + constraints.type + "\" ("+path+")";
        }
        // 8) When the function accepts multiple types
        else if (Array.isArray(constraints.type)) {
            let listOfTypes = constraints.type;
            for (let i = 0; i < listOfTypes.length; i++) {
                constraints.type = listOfTypes[i];
                // eslint-disable-next-line no-unused-vars
                const [result, subReason] = this._checkParameters(parameters, constraints, "[" + i + "]/");
                if (result) {
                    accepted = true;
                    break;
                }
            }
        }
        return [accepted, reason];
    }
    
    usage() {
        return {
            service: this._identity,
            methods: this.listMethods()
        };
    }
    
    listMethods() {
        var methods = {};
        for (var i in this._methods) {
            var parameters = null;
            if (typeof this._methods[i].parameters !== "undefined") {
                parameters = this._methods[i].parameters;
            }
            methods[i] = {parameters: parameters, result: this._methods[i].result, public: this._methods[i].public};
        }
        return methods;
    }
    
    addMethod(name, callback, parameters = null, result = null, isPublic = false) {
        if (typeof name !== "string") {
            throw Error("Expected the method name to be a string");
        }
        if (typeof callback !== "function") {
            throw Error("Expected the callback for method \"" + name + "\" to be a function");
        }
        if (parameters !== null) {
            if (typeof parameters !== "object") {
                throw Error("Expected the parameter specification for method \"" + name + "\" to be either an object or an array of objects");
            }
            if (!Array.isArray(parameters)) {
                parameters = [parameters]; // Encapsulate parameter specifications in an array to allow for supplying multiple specifications
            }
            for (let index = 0; index < parameters.length; index++) {
                if (typeof parameters[index].type !== "string") {
                    throw Error("Expected each parameter specification for method \"" + name + "\" to contain a type declaration");
                }
            }
        }
        if (result !== null) {
            if (typeof result !== "object") {
                throw Error("Expected the parameter specification for method \"" + name + "\" to be either an object or an array of objects");
            }
            if (!Array.isArray(result)) {
                result = [result]; // Encapsulate result specifications in an array to allow for supplying multiple specifications
            }
            for (let index = 0; index < result.length; index++) {
                if (typeof result[index].type !== "string") {
                    throw Error("Expected each result specification for \"" + name + "\" to contain a type declaration");
                }
            }
        }
        this._methods[name] = {callback: callback, parameters: parameters, result: result, public: isPublic};
    }
    
    deleteMethod(name) {
        if (this._methods[name]) {
            delete this._methods[name];
            return true;
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
        if ((typeof this._methods[method].parameters !== "undefined") && (this._methods[method].parameters !== null)) {
            let accepted = false;
            let reason = "";
            for (var i = 0; i < this._methods[method].parameters.length; i++) {
                let constraints = this._methods[method].parameters[i];
                const [result, subReason] = this._checkParameters(parameters, constraints);
                reason = subReason;
                if (result) {
                    accepted = true;
                    break;
                }
            }
            if (!accepted) {
                throw Object.assign(this._errors.parameters, {"reason": reason});
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
                } else {
                    response.error = Object.assign(this._errors.returnCustom, error);
                }
            } else {
                response.error = this._errors.internal;
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
