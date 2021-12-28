"use strict";

var app = null;

function start() {
    app = new App();
}

class App {
    constructor() {
        this.apiClient = new ApiClient(this._onApiConnect.bind(this), this._onApiDisconnect.bind(this), this._onApiError.bind(this), this._onApiSession.bind(this));
        this.apiClient.connect();
    }
    
    _onApiConnect() {
        console.log("API connected");
        document.getElementById("status").innerHTML = "connected";
    }

    _onApiDisconnect() {
        console.log("API disconnected, reconnecting...");
        document.getElementById("status").innerHTML = "disconnected";
        this.apiClient.connect();
    }
    
    _onApiError(source, ...args) {
        console.log("API error (in "+source+")", ...args);
        document.getElementById("status").innerHTML = "error";
    }
    
    _onApiSession(state) {
        let token = "Token: " + ((typeof this.apiClient.token === "string") ? this.apiClient.token : "NULL") + "\n";
        document.getElementById("session").innerHTML = token + ((state === null) ? "none" : JSON.stringify(state, null, 2));  
        
        if (state !== null) {
            if (state.user === null) {
                document.getElementById("loginButton").disabled = false;
            } else {
                document.getElementById("loginButton").disabled = true;
            }
        }
        
        this.apiClient.request("usage", null, this._onUsage.bind(this));
    }
    
    _onUsage(data) {
        let output = "<h1>"+data.service+"</h1>";
        output += "<table><tr><th>Method</th><th>Parameters</th><th>Result</th><th>Public</th>";
        for (let method in data.methods) {
            let parameters = data.methods[method].parameters;
            let results = data.methods[method].result;
            output += "<tr>";
            output += "<td>" + method + "</td>";
            let paramOutput = "";
            for (let paramIndex = 0; paramIndex < parameters.length; paramIndex++) {
                let description = parameters[paramIndex].description;
                if (typeof description !== "string") description = "";
                let paramDesc = "<pre>" + JSON.stringify(parameters[paramIndex], null, 2) + "</pre>";
                if (parameters[paramIndex].type === "none") {
                    paramDesc = "None";
                }
                if (parameters[paramIndex].type === "string") {
                    paramDesc = "String: " + description.toLowerCase();
                }
                if (parameters[paramIndex].type === "boolean") {
                    paramDesc = "Boolean: " + description.toLowerCase();
                }
                if (parameters[paramIndex].type === "array") {
                    paramDesc = "Array of " + parameters[paramIndex].contains + "s: " + description.toLowerCase();
                }
                if (parameters[paramIndex].type === "object") {
                    paramDesc = "Object: " + description.toLowerCase();
                }
                paramOutput += "<tr><td>"+paramDesc+"</td></tr>";
            }
            output += "<td><table>" + paramOutput + "</table></td>";
            let resultOutput = "";
            for (let resultIndex = 0; resultIndex < results.length; resultIndex++) {
                let description = results[resultIndex].description;
                if (typeof description !== "string") description = "";
                let resultDesc = "<pre>" + JSON.stringify(results[resultIndex], null, 2) + "</pre>";
                if (results[resultIndex].type === "none") {
                    resultDesc = "None";
                }
                if (results[resultIndex].type === "string") {
                    resultDesc = "String: " + description.toLowerCase();
                }
                if (results[resultIndex].type === "boolean") {
                    resultDesc = "Boolean: " + description.toLowerCase();
                }
                if (results[resultIndex].type === "array") {
                    resultDesc = "Array of " + results[resultIndex].contains + "s: " + description.toLowerCase();
                }
                if (results[resultIndex].type === "object") {
                    resultDesc = "Object: " + description.toLowerCase();
                }
                resultOutput += "<tr><td>"+resultDesc+"</td></tr>";
            }
            output += "<td><table>" + resultOutput + "</table></td>";
            output += "<td>" + (data.methods[method].public ? "Yes" : "No") + "</td>";
            output += "</tr>";
        }
        output += "</table>";
        document.getElementById("methods").innerHTML = output;
        
    }
    
    ping() {
        try {
            this.apiClient.request("ping", null, (result, error) => {
                if (error !== null) {
                    console.log("Ping error:", error);
                    alert("Ping failed: " + error.message);
                }
                if (result !== null) {
                    alert(result);
                }
            });
        } catch (error) {
            console.log("Ping JS error:", error);
            alert("Ping failed and a Javascript error occured!");
        }
    }
    
    example() {
        try {
            this.apiClient.request("example", [1,1], (result, error) => {
                if (error !== null) {
                    console.log("Example error:", error);
                    alert("Executing the example method failed: " + error.message);
                }
                if (result !== null) {
                    alert(result);
                }
            });
        } catch (error) {
            console.log("Example JS error:", error);
            alert("A Javascript error occured when executing the example method!");
        }
    }
    
    logout() {
        try {
            this.apiClient.logout((result, error) => {
                if (error === null) {
                    console.log("Logout succesfull");
                } else {
                    console.log("Logout error:", error);
                }
            });
        } catch (error) {
            console.log("Logout request failed:", error);
        }
    }
    
    login() {
        try {
            let username = document.getElementById("username").value;
            let password = document.getElementById("password").value;
            this.apiClient.login(username, password, (result, error) => {
                if (error === null) {
                    console.log("Login succesfull");
                    document.getElementById("loginButton").disabled = true;
                } else {
                    console.log("Login error:", error);
                    document.getElementById("loginButton").disabled = false;
                    alert("Login error: " + error.message);
                }
                console.log(result, error);
            });
        } catch (error) {
            console.log("Login request failed:", error);
            document.getElementById("loginButton").disabled = false;
        }
    }
    
    call(method, parameters = null) {
        this.apiClient.request(method, parameters, (result, error) => {
            if (error === null) {
                console.log("Result:", result);
            } else {
                console.log("Error:", error);
            }
        });
    }
}
