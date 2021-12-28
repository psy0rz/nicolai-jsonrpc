/**
 * Function for checking user input against a schema
 *
 * Copyright 2021 Renze Nicolai
 * This code is released under the MIT license.
 * SPDX-License-Identifier: MIT
 */

"use strict";

function checkParameters(parameters, constraints, path="/") {
    if (Array.isArray(constraints)) {
        for (let index = 0; index < constraints.length; index++) {
            let [result, reason] = checkParameters(parameters, constraints[index], "{" + index + "}" + path);
            if (result) {
                return [result, reason];
            }
        }
        return [false, "Supplied parameters don't match with any of the accepted types (" + path + ")"];
    } else {
        if (typeof constraints !== "object") {
            throw Error("Expected constraints to be an object");
        }
        if (Array.isArray(constraints.type)) {
            for (let typeIndex = 0; typeIndex < constraints.type.length; typeIndex++) {
                let [typeResult, typeReason] = checkParameters(parameters, {type: constraints.type[typeIndex]}, "<" + typeIndex + ">" + path);
                if (typeResult) {
                    return [typeResult, typeReason];
                }
            }
            return [false, "Constraints specify to accept any of " + constraints.type.join(", ") + " (" + path + ")"];
        } else if (typeof constraints.type === "undefined") {
            return [true, "Constraints don't specify a type"];
        } else if (typeof constraints.type !== "string") {
            throw Error("Expected constraints to contain a type (string)");
        }
        switch (constraints.type) {
            case "any":
                return [true, "Constraints specify to accept everything (" + path + ")"];
            case "none":
            case "null":
            case null:
                return [(parameters === null), "Constraints specify to accept no parameters (" + path + ")"];
            case "array":
                if (Array.isArray(parameters)) {
                    return checkArray(parameters, constraints, path);
                } else {
                    return [false, "Constraints specify to accept an array (" + path + ")"];
                }
            case "object":
                if (Array.isArray(parameters)) {
                    return [false, "Constraints specify to accept an object, not an array (" + path + ")"];
                } else if (typeof parameters === "object") {
                    return checkObject(parameters, constraints, path);
                } else {
                    return [false, "Constraints specify to accept an object (" + path + ")"];
                }
            case "string":
            case "number":
            case "boolean":
            default:
                return [(typeof parameters === constraints.type), "Constraints specify to accept a " + constraints.type + " (" + path + ")"];
        }
    }
}

function checkArray(parameters, constraints, path="/") {
    if ((typeof constraints.length === "number") && (parameters.length !== constraints.length)) {
        // Length is defined and does not match
        return [false, "Expected an array with " + constraints.length + " elements, found " +  parameters.length + " elements (" + path + ")"];
    }
    if ((typeof constraints.minlength === "number") && (parameters.length < constraints.minlength)) {
        // Minimum length is defined and does not match
        return [false, "Expected an array with at least " + constraints.minlength + " elements, found " +  parameters.length + " elements (" + path + ")"];
    }
    if ((typeof constraints.maxlength === "number") && (parameters.length > constraints.maxlength)) {
        // Maximum length is defined and does not match
        return [false, "Expected an array with at most " + constraints.maxlength + " elements, found " +  parameters.length + " elements (" + path + ")"];
    }
    if (typeof constraints.contains === "string") {
        for (let index = 0; index < parameters.length; index++ ) {
            let [result, reason] = checkParameters(parameters[index], { type: constraints.contains }, "[" + index + "]" + path);
            if (!result) {
                return [result, reason];
            }
        }
    } else if (Array.isArray(constraints.contains)) {
        for (let index = 0; index < parameters.length; index++ ) {
            let [result, reason] = checkParameters(parameters[index], { type: constraints.contains }, "[" + index + "]" + path);
            if (!result) {
                return [result, reason];
            }
        }
    } else if (typeof constraints.contains === "object") {
        for (let index = 0; index < parameters.length; index++ ) {
            let [result, reason] = checkParameters(parameters[index], { type: constraints.contains }, "[" + index + "]" + path);
            if (!result) {
                return [result, reason];
            }
        }
    } else if (typeof constraints.contains !== "undefined") {
        throw Error("Expected constraints.contains to be a string, an object or undefined (" + path + ")");
    }
    return [true, "Array contents match the constraints (" + path + ")"];
}

function checkObject(parameters, constraints, path="/") {
    if ((typeof constraints.contains === "object") && (typeof constraints.required === "undefined")) {
        constraints.required = constraints.contains;
    }

    if ((typeof constraints.required === "undefined") && (typeof constraints.optional === "undefined")) {
        // When the object has no constraints
        return [true, "Object has no further constraints (" + path + ")"];
    }
    
    // When the object has required parameters
    if (typeof constraints.required !== "undefined") {
        for (let item in constraints.required) {
            if (typeof parameters[item] === "undefined") {
                // And a required parameter is missing
                return [false, "Object is missing required parameter '" + item + "' (" + path + ")"];
            }
            if (typeof constraints.required[item] === "object") {
                // If constraints are set for the content of the required parameter
                let [result, subReason] = checkParameters(parameters[item], constraints.required[item], path + item + "/");
                if (!result) {
                    // The constraints of the parameter were not met
                    return [false, subReason];
                    break;
                }
            } else if (typeof item !== "string") {
                throw Error("Required fields of an object must be specified as an array of string keynames or objects with a type field");
            }
        }
    }

    // Check that the object does not contain stray parameters
    for (let item in parameters) {
        if (Array.isArray(constraints.required) && (constraints.required.indexOf(item) >= 0)) {
            // The parameter is a required parameter
            continue;
        } else if ((typeof constraints.required === "object") && (item in constraints.required)) {
            // The parameter is a required parameter
            continue;
        } else if ((typeof constraints.optional !== "undefined") && (item in constraints.optional)) {
            // The parameter is an optional parameter
            if (typeof constraints.optional[item].type !== "undefined") {
                // If constraints are set for the contents of the optional parameter
                let [result, subReason] = checkParameters(parameters[item], constraints.optional[item], path + item + "/");
                if (!result) {
                    // The constraints of the parameter were not met
                    return [false, subReason];
                }
            }
        } else {
            // The parameter is neither a required or an optional parameter
            return [false, "Found stray parameter " + item + " (" + path + ")"];
        }
    }
    
    return [true, "Object matches the constraints (" + path + ")"];
}

module.exports = checkParameters;
