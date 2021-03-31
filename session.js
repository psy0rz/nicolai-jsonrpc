/**
* @license
* Copyright 2021 Renze Nicolai
* This code is released under the MIT license.
* SPDX-License-Identifier: MIT
*/

"use strict";

const crypto = require("crypto");

class Session {
    constructor(aPermissions = [], aRpcMethodPrefix = "") {
        // The unique identifier for this session
        this._id = crypto.randomBytes(64).toString("base64");
        
        // Unix timestamps for keeping track of the amount of seconds this session has been idle
        this._dateCreated = Math.floor(Date.now() / 1000);
        this._dateLastUsed = this._dateCreated;
        
        // Prefix for RPC methods of the SessionManager
        this._parentRpcMethodPrefix = aRpcMethodPrefix;
        
        // List of methods which this session may call, regardless of weither or not the sessions user may call the method
        this._permissions = aPermissions;
        
        // User account associated with this session
        this._user = null;
        
        // Push message subscriptions
        this._subscriptions = {};

        // Connections
        this._connections = [];
    }
    
    getIdentifier() {
        // Returns the unique identifier of this session
        return this._id;
    }
    
    getCreatedAt() {
        // Returns a unix timestamp representing the moment this session was created
        return this._dateCreated;
    }
    
    getUsedAt() {
        // Returns a unix timestamp representing the moment this session was last used
        return this._dateLastUsed;
    }
    
    use() {
        // Update the timestamp representing the moment this session was last used to the current time
        this._dateLastUsed = Math.floor(Date.now() / 1000);
    }
    
    setUser(user) {
        this._user = user;
    }
    
    getUser() {
        return this._user;
    }
    
    getPermissions() {
        let userPermissions = this._user ? ((typeof this._user.getPermissions === "function") ? this._user.getPermissions() : []) : [];
        return this._permissions.concat(userPermissions);
    }

    checkPermission(method) {
        for (let index = 0; index < this._permissions.length; index++) {
            if (method.startsWith(this._permissions[index])) {
                return true;
            }
        }
        if ((this._user !== null) && (typeof this._user.checkPermission === "function")) {
            return this._user.checkPermission(method);
        }
        return false;
    }
    
    addPermission(permission) {
        let result = false;
        if (!this._permissions.includes(permission)) {
            this._permissions.push(permission);
            result = true;
        }
        return result;
    }
    
    removePermission(permission) {
        let result = false;
        if (this._permissions.includes(permission)) {
            this._permissions = this._permissions.filter(item => item !== permission);
            result = true;
        }
        return result;
    }
    
    allowPush() {
        this.addPermission(this._parentRpcMethodPrefix + "push/subscriptions");
        this.addPermission(this._parentRpcMethodPrefix + "push/subscribe");
        this.addPermission(this._parentRpcMethodPrefix + "push/unsubscribe");
    }

    denyPush() {
        this.removePermission(this._parentRpcMethodPrefix + "push/subscriptions");
        this.removePermission(this._parentRpcMethodPrefix + "push/subscribe");
        this.removePermission(this._parentRpcMethodPrefix + "push/unsubscribe");
    }

    allowManagement() {
        this.addPermission(this._parentRpcMethodPrefix + "management/list");
        this.addPermission(this._parentRpcMethodPrefix + "management/destroy");
    }

    denyManagement() {
        this.removePermission(this._parentRpcMethodPrefix + "management/list");
        this.removePermission(this._parentRpcMethodPrefix + "management/destroy");
    }

    getSubscriptions(identifier = "anonymous") {
        if (identifier in this._subscriptions) {
            return this._subscriptions[identifier];
        } else {
            return [];
        }
    }
    
    subscribe(subject, identifier = "anonymous") {
        let result = false;
        if (identifier in this._subscriptions) {
            if (!this._subscriptions[identifier].includes(subject)) {
                this._subscriptions[identifier].push(subject);
                result = true;
            }
        }
        return result;
    }

    unsubscribe(subject, identifier = "anonymous") {
        let result = false;
        if (identifier in this._subscriptions) {
            if (this._subscriptions[identifier].includes(subject)) {
                this._subscriptions[identifier] = this._subscriptions[identifier].filter(item => item !== subject);
                result = true;
            }
        }
        return result;
    }
    
    serialize() {
        // Summary of the session
        return {
            id: this._id,
            user: this._user,
            dateCreated: this._dateCreated,
            dateLastUsed: this._dateLastUsed,
            subscriptions: this._subscriptions,
            permissions: this._permissions
        };
    }

    setConnection(connection) {
        if (typeof connection.smIdentifier !== "string") {
            connection.smIdentifier = crypto.randomBytes(64).toString("base64");
            this._connections[connection.smIdentifier] = connection;
            this._subscriptions[connection.smIdentifier] = [];
            connection.on("close", this._onConnectionClose.bind(this, connection));
        }
    }

    _onConnectionClose(connection) {
        if (connection.smIdentifier in this._connections) {
            delete this._connections[connection.smIdentifier];
        }
        if (connection.smIdentifier in this._subscriptions) {
            delete this._subscriptions[connection.smIdentifier];
        }
    }
    
    async push(subject, message, identifier) {
        let result = false;
        for (let identifier in this._subscriptions) {
            if (this._subscriptions[identifier].includes(subject)) {
                this._connections[identifier].send(JSON.stringify({
                    pushMessage: true,
                    subject: subject,
                    message: message
                }));
                result = true;
            }
        }
        return result;
    }
}

class SessionManager {
    constructor(opts={}) {
        this._opts = Object.assign({
            timeout: null
        }, opts);

        this.sessions = [];
        this.alwaysAllow = [];
        
        if (this._opts.timeout !== null) {
            setTimeout(this._gc.bind(this), 5000);
        }
        
        this._permissionsToAddToNewSessions = [];
        this._rpcMethodPrefix = "";
    }
    
    /* Internal functions */
    
    _destroySession(id) {
        for (var i in this.sessions) {
            if (this.sessions[i].getIdentifier() === id) {
                this.sessions.splice(i,1);
                return true;
            }
        }
        return false;
    }
    
    _gc() {
        if (this._opts.timeout === null) {
            return;
        }
        
        var now = Math.floor((new Date()).getTime() / 1000);
        
        var sessionsToKeep = [];
        for (var i in this.sessions) {
            var unusedSince = now-this.sessions[i].getUsedAt();
            if (unusedSince < this._opts.timeout) {
                sessionsToKeep.push(this.sessions[i]);
            }
        }
        
        this.sessions = sessionsToKeep;
        
        // Reschedule the garbage collector
        setTimeout(this._gc.bind(this), 5000);
    }
    
    /* System functions */

    push(subject, message) { // Broadcast to all sessions
        for (let index in this.sessions) {
            this.sessions[index].push(subject, message);
        }
    }
    
    getSession(token) {
        for (let index in this.sessions) {
            if (this.sessions[index].getIdentifier()===token) {
                return this.sessions[index];
            }
        }
        return null;
    }

    getSessions() {
        return this.sessions;
    }
    
    /* RPC API functions: management of individual sessions */

    // eslint-disable-next-line no-unused-vars
    async createSession(parameters, session) {
        let newSession = new Session(JSON.parse(JSON.stringify(this._permissionsToAddToNewSessions)), this._rpcMethodPrefix); // The JSON operations here copy the permissions array
        this.sessions.push(newSession);
        return newSession.getIdentifier();
    }

    async destroyCurrentSession(parameters, session) {
        let result = false;
        for (var i in this.sessions) {
            if (this.sessions[i] === session) {
                this.sessions.splice(i,1);
                result = true;
                break;
            }
        }
        return result;
    }
    
    async state(parameters, session) {
        if (session === null) {
            throw Error("No session");
        }
        let user = session.getUser();
        return {
            user: (user !== null) ? user.serialize() : null,
            permissions: session.getPermissions()
        };
    }
    
    async listPermissionsForCurrentSession(parameters, session) {
        if (session === null) {
            throw Error("No session");
        }
        return session.getPermissions();
    }
    
    async getSubscriptions(parameters, session, connection) {
        if (session === null) {
            throw Error("No session");
        }
        if (connection === null) {
            throw Error("No persistent connection");
        }
        if (typeof connection.smIdentifier !== "string") {
            throw Error("Connection doesn't have an identifier");
        }
        return session.getSubscriptions(connection.smIdentifier);
    }
    
    async subscribe(parameters, session, connection) {
        if (session === null) {
            throw Error("No session");
        }
        if (connection === null) {
            throw Error("No persistent connection");
        }
        if (typeof connection.smIdentifier !== "string") {
            throw Error("Connection doesn't have an identifier");
        }
        if (typeof parameters === "string") {
            return session.subscribe(parameters, connection.smIdentifier);
        } else {
            let result = [];
            for (let i = 0; i < parameters.length; i++) {
                result.push(session.subscribe(parameters[i], connection.smIdentifier));
            }
            return result;
        }
    }

    async unsubscribe(parameters, session, connection) {
        if (session === null) {
            throw Error("No session");
        }
        if (connection === null) {
            throw Error("No persistent connection");
        }
        if (typeof connection.smIdentifier !== "string") {
            throw Error("Connection doesn't have an identifier");
        }
        if (typeof parameters === "string") {
            let result = await session.unsubscribe(parameters, connection.smIdentifier);
            return result;
        } else {
            let result = [];
            for (let i = 0; i < parameters.length; i++) {
                result.push(session.unsubscribe(parameters[i], connection.smIdentifier));
            }
            return result;
        }
    }
    
    /* RPC API functions: administrative tasks */

    // eslint-disable-next-line no-unused-vars
    async listSessions(parameters, session) {
        var sessionList = [];
        for (var i in this.sessions) {
            sessionList.push(this.sessions[i].serialize());
        }
        return sessionList;
    }

    // eslint-disable-next-line no-unused-vars
    async destroySession(parameters, session) {
        return this._destroySession(parameters);
    }

    registerRpcMethods(rpc, prefix="session") {
        if (prefix!=="") prefix = prefix + "/";

        this._rpcMethodPrefix = prefix;
        this._permissionsToAddToNewSessions.push(prefix + "create");
        this._permissionsToAddToNewSessions.push(prefix + "destroy");
        this._permissionsToAddToNewSessions.push(prefix + "state");
        this._permissionsToAddToNewSessions.push(prefix + "permissions");
        
        /*
        * Create session
        * 
        * Returns a unique session token used to identify the session in further requests
        * 
        */
        rpc.addMethod(
            prefix+"create",
            this.createSession.bind(this),
            [
                {
                    type: "none"
                }
            ],
            {
                type: "string",
                description: "Session token"
            },
            true
        );
        
        /*
        * Destroy the current session
        * 
        * Destroys the session attached to the request
        * 
        */
        rpc.addMethod(
            prefix+"destroy",
            this.destroyCurrentSession.bind(this),
            [
                {
                    type: "none"
                }
            ],
            {
                type: "boolean",
                description: "True when the session has succesfully been destroyed, false when the session could not be destroyed"
            },
            false
        );
        
        /*
        * Query the state of the current session
        * 
        * Returns the state of the session attached to the request
        * 
        */
        rpc.addMethod(
            prefix+"state",
            this.state.bind(this),
            [
                {
                    type: "none"
                }
            ],
            {
                type: "object",
                description: "State of the session",
                contains: {
                    user: {
                        type: "object",
                        description: "Serialized user or NULL when no user is available"
                    },
                    permissions: {
                        type: "array",
                        description: "List of methods which this session may call",
                        contains: {
                            type: "string",
                            description: "Method which this session may call"
                        }
                    }
                }
            },
            false
        );
        
        /*
        * Query permissions granted to the current session
        * 
        * Returns a list of permissions granted to the session attached to the request
        * 
        */
        rpc.addMethod(
            prefix+"permissions",
            this.listPermissionsForCurrentSession.bind(this),
            [
                {
                    type: "none"
                }
            ],
            {
                type: "array",
                description: "List of methods which this session may call",
                contains: {
                    type: "string",
                    description: "Method which this session may call"
                }
            },
            false
        );
        
        /* 
        * Pushmessages: list of subscriptions
        *
        * Returns the list of topics subscribed to of the session attached to the request
        * 
        */
        rpc.addMethod(
            prefix+"push/subscriptions",
            this.getSubscriptions.bind(this),
            {
                type: "none"
            },
            {
                type: "array",
                description: "Array of topics which the session is subscribed to",
                contains: {
                    type: "string", description: "Topic"
                }
            },
            false
        );
        
        /* 
        * Pushmessages: subscribe to a topic
        *
        * Adds the supplied topic to the list of topics subscribed to of the session attached to the request
        * 
        */
        rpc.addMethod(
            prefix+"push/subscribe",
            this.subscribe.bind(this),
            [
                {
                    type: "string",
                    description: "Topic"
                },
                {
                    type: "array",
                    contains: "string",
                    description: "Array containing topics"
                }
            ],
            [
                {
                    type: "boolean",
                    description: "True when successfully subscribed, false when already subscribed"
                },
                {
                    type: "array",
                    description: "Array of results",
                    contains: {
                        type: "boolean", description: "True when successfully subscribed, false when already subscribed"
                    }
                }
            ],
            false
        );
        
        /*
        * Pushmessages: unsubscribe from a topic
        * 
        * Removes the supplied topic to the list of topics subscribed to of the session attached to the request
        * 
        */
        rpc.addMethod(
            prefix+"push/unsubscribe",
            this.unsubscribe.bind(this),
            [
                {
                    type: "string",
                    description: "Topic"
                },
                {
                    type: "array",
                    contains: "string",
                    description: "Array containing topics"
                }
            ],
            [
                {
                    type: "boolean",
                    description: "True when successfully unsubscribed, false when already unsubscribed"
                },
                {
                    type: "array",
                    description: "Array of results",
                    contains: {
                        type: "boolean", description: "True when successfully unsubscribed, false when already unsubscribed"
                    }
                }
            ],
            false
        );
        
        /*
        * Management: list all active sessions
        * 
        * Returns a list of sessions
        * 
        */
        rpc.addMethod(
            prefix+"management/list",
            this.listSessions.bind(this),
            [
                {
                    type: "none"
                }
            ],
            {type: "array", description: "List of serialized sessions"},
            false
        );
        
        /*
        * Management: destroy a session
        * 
        * Destroys the session corresponding to the supplied session token
        * 
        */
        rpc.addMethod(
            prefix+"management/destroy",
            this.destroySession.bind(this),
            [
                {
                    type: "string",
                    description: "Unique identifier of the session that will be destroyed"
                }
            ],
            {type: "boolean", description: "True when a session was destroyed, false when no session with the supplied identifier exists"},
            false
        );
    }
}

module.exports = SessionManager;
