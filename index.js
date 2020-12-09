/*

MIT License

Copyright (c) 2020 Renze Nicolai

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

"use strict";

class Rpc {
	constructor( opts ) {
		this._opts = Object.assign({
			strict: true,
			auth: null,
			identity: ""
		}, opts);
		
		this._methods = {};
		
		this._alwaysAllow = [];
		
		this.errors = {
			parse:          { code: -32700, message: "Parse error"           }, // As defined in JSON-RPC 2.0
			invalid:        { code: -32600, message: "Invalid Request"       }, // As defined in JSON-RPC 2.0
			method:         { code: -32601, message: "Method not found"      }, // As defined in JSON-RPC 2.0
			parameters:     { code: -32602, message: "Invalid params"        }, // As defined in JSON-RPC 2.0
			internal:       { code: -32603, message: "Internal error"        }, // As defined in JSON-RPC 2.0
			server:         { code: -32000, message: "Server error"          }, // Custom
			permission:     { code: -32001, message: "Access denied"         }, // Custom
			user:           { code: -32002                                   }, // Custom
			invalidToken:   { code: -32001, message: "Invalid token"         }  // Custom
		};
		
		this.addMethod('usage', (session, params) => { return this.usage(false, true); }, {type: 'none'}, {type: 'object', description: 'Object describing this API'});
		this.addMethod('ping', (session, params) => { return "pong"; }, {type: 'none'}, {type: 'string', description: 'A string containing the text \'pong\''});
		this.addAlwaysAllow('usage');
		this.addAlwaysAllow('ping');
	}
	
	listMethods() {
		var methods = {};
		for (var i in this._methods) {
			var parameters = null;
			if (typeof this._methods[i].parameters !== "undefined") {
				parameters = this._methods[i].parameters;
			}
			methods[i] = {parameters: parameters, result: this._methods[i].result};
		}
		return methods;
	}
	
	addMethod(name, callback, parameters=null, result=null) {
		// Sanity checks for developers adding new methods
		if (typeof name !== "string") {
			throw "Expected the method name to be a string.";
		}
		if (typeof callback !== "function") {
			throw "Expected the callback for "+name+" to be a function.";
		}
		if (callback.length !== 2) {
			throw "The callback function for "+name+" has an invalid amount of arguments.";
		}
		if (parameters !== null) {
			if (typeof parameters !== "object") {
				throw "Expected the parameter specification for "+name+" to be either an object or an array of objects";
			}
			if (!Array.isArray(parameters)) {
				parameters = [parameters]; // Encapsulate parameter specifications in an array to allow for supplying multiple specifications
			}
			for (var i = 0; i < parameters.length; i++) {
				if (typeof parameters[i].type !== "string") {
					throw "Expected each parameter specification for "+name+" to contain a type declaration.";
				}
			}
		}
		if (result !== null) {
			if (typeof result !== "object") {
				throw "Expected the parameter specification for "+name+" to be either an object or an array of objects";
			}
			if (!Array.isArray(result)) {
				result = [result]; // Encapsulate result specifications in an array to allow for supplying multiple specifications
			}
			for (var i = 0; i < result.length; i++) {
				if (typeof result[i].type !== "string") {
					throw "Expected each result specification for "+name+" to contain a type declaration.";
				}
			}
		}
		this._methods[name] = {callback: callback, parameters: parameters, result: result};
	}
	
	deleteMethod(name) {
		if (this._methods[name]) {
			delete this._methods[name];
			return true;
		}
		return false;
	}
	
	addAlwaysAllow(method) {
		this._alwaysAllow.push(method);
	}
	
	_checkParameters(parameters, constraints) {
		let accepted = false;
		// 1) When no parameters are supplied
		if ((parameters === null) && ((constraints.type === "none") || (constraints.type === "null"))) {
			accepted = true;
		}
		// 2) When the function accepts any argument
		if (constraints.type === "any") {
			accepted = true;
		}
		// 3) When the function accepts a string argument
		else if ((typeof parameters === "string") && (constraints.type === "string")) {
			accepted = true;
		}
		// 4) When the function accepts a number argument
		else if ((typeof parameters === "number") && (constraints.type === "number")) {
			accepted = true;
		}
		// 5) When the function accepts a boolean argument
		else if ((typeof parameters === "boolean") && (constraints.type === "boolean")) {
			accepted = true;
		}
		// 6) When the function accepts an array
		else if ((typeof parameters === "object") && (Array.isArray(parameters)) && (constraints.type === "array")) {
			if (typeof constraints.contains === "string") {
				accepted = true;
				if (constraints.contains !== 'any') {
					for (var i = 0; i < parameters.length; i++) {
						if (typeof parameters[i] !== constraints.contains) {
							accepted = false;
							break;
						}
					}
				}
			} else if (typeof constraints.contains === "object") {
				accepted = true;
				for (var i = 0; i < parameters.length; i++) {
					if (!this._checkParameters(parameters[i], constraints.contains)) {
						accepted = false;
						break;
					}
				}
			} else {
				// No valid constraints found for the contents of the array
				accepted = true;
			}
		}
		// 7) When the function accepts an object
		else if ((typeof parameters === "object") && (constraints.type === "object")) {
			if (parameters === null) {
				// When the object is null
				accepted = (typeof constraints.allowNull === 'boolean') && (constraints.allowNull === true);
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
							accepted = false;
							break;
						}
						if (typeof constraints.required[item].type !== "undefined") {
							// If constraints are set for the content of the required parameter
							if (!this._checkParameters(parameters[item], constraints.required[item])) {
								// The constraints of the parameter were not met
								accepted = false;
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
						// The parameter is an optinoal parameter
						if (typeof constraints.optional[item].type !== "undefined") {
							// If constraints are set for the contents of the optional parameter
							if (!this._checkParameters(parameters[item], constraints.optional[item])) {
								// The constraints of the parameter were not met
								accepted = false;
								break;
							}
						}
					} else {
						// The parameter is neither a required or an optional parameter
						accepted = false;
						break;
					}
				}
			}
		}
		// 8) When the function accepts multiple types
		else if (Array.isArray(constraints.type)) {
			let listOfTypes = constraints.type;
			for (let i = 0; i < listOfTypes.length; i++) {
				constraints.type = listOfTypes[i];
				if (this._checkParameters(parameters, constraints)) {
					accepted = true;
					break;
				}
			}
		}
		return accepted;
	}
	
	
	
	async _handleRequest(request, connection=null, jsonrpc=true) {
		var response = {};
		
		if (jsonrpc) {
			response.jsonrpc = '2.0';
		}
		
		if (request.id) {
			response.id = request.id;
		}

		if (jsonrpc) {
			if (
				(this._opts.strict && ((request.jsonrpc !== "2.0") || (!request.id))) ||
				(typeof request.method !== 'string')
			) {
				response.error = this.errors.invalid;
				throw response;
			}
		}
			
		if (typeof request.params === 'undefined') {
			request.params = null;
		}
		
		var havePermission = this._alwaysAllow.indexOf(request.method) > -1;
		
		if (!this._opts.auth) {
			havePermission = true;
		}
		
		var session = null;
		if ((typeof request.token === 'string') && (this._opts.auth)) {
			session = this._opts.auth.getSession(request.token);
			if (session) {
				session.use();
				if (connection) {
					session.setConnection(connection);
				}
				if (!havePermission) {
					let user = session.getUser();
					if (user !== null) {
						havePermission = user.hasPermission(request.method);
					}
				}
			} else {
				response.error = this.errors.invalidToken;
				throw response;
			}
		}
		
		if (!havePermission) {
			response.error = this.errors.permission;
			throw response;
		}
		
		if (typeof this._methods[request.method] !== 'object') {
			response.error = this.errors.method;
			throw response;
		}
		
		if (typeof this._methods[request.method].parameters !== "undefined") {			
			let accepted = false;
			for (var i = 0; i < this._methods[request.method].parameters.length; i++) {
				let constraint = this._methods[request.method].parameters[i];
				if (this._checkParameters(request.params, constraint)) {
					accepted = true;
					break;
				}
			}
			if (!accepted) {
				response.error = this.errors.parameters;
				throw response;
			}
		}

		try {
			var result = await this._methods[request.method].callback(session, request.params);
			response.result = result;
		} catch (error) {
			if (typeof error==="string") {
				response.error = Object.assign({ message: error }, this.errors.user);
			} else {
				response.error = Object.assign({ raw: error }, this.errors.internal);
			}
			throw response;
		}
		return response;
	}
	
	usage(jsonrpc=false, raw=false) {
		let result = {
			service: this._opts.identity,
			methods: this.listMethods()
		};
		if (jsonrpc) {
			result.jsonrpc = "2.0";
			result.code = 0;
			result.message = "Empty request received";
		}
		return raw ? result : JSON.stringify(result);
	}
	
	async handle(data, connection=null, jsonrpc=true) {
		var requests = null;
		if (typeof data === 'string') {
			if (data === "") {
				return this.usage(true);
			}
			try {
				requests = JSON.parse(data);
			} catch (error) {
				throw JSON.stringify(this.errors.parse);
			}
		} else {
			requests = data;
		}
		
		var singleResult = false;
		if (!Array.isArray(requests)) {
			requests = [requests];
			singleResult = true;
		}
		
		if (requests.length < 1) {
			throw JSON.stringify(this.errors.invalid);
		}
		
		var results = [];

		try {
			for (let index = 0; index<requests.length; index++) {
				var result = await this._handleRequest(requests[index], connection, jsonrpc);
				results.push(result);
			}
		} catch (error) {
			throw JSON.stringify(error);
		}
		
		return JSON.stringify(singleResult ? results[0] : results);
	}
}

module.exports = Rpc;
