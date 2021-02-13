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
  }
  
    ping() {
        try {
            this.apiClient.request("ping", null, (result, error) => {
            if (error === null) {
                console.log("Ping succesfull");
                document.getElementById("ping").innerHTML = "OK";
            } else {
                console.log("Ping error:", error);
                document.getElementById("ping").innerHTML = error;
            }
            });
        } catch (error) {
            document.getElementById("ping").innerHTML = error;
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
