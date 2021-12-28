"use strict";

const assert = require("assert");
const checkParameters = require("../checkParameters.js");

describe("Parameter checking", () => {
    it("handles situations without parameters, when the constraints are set to type 'none'", () => {
        let [result, reason] = checkParameters(null, {
            type: "none"
        });
        assert.strictEqual(result, true);
    });

    it("denies parameters when the constraints are set to type 'none'", () => {
        let [result, reason] = checkParameters("test", {
            type: "none"
        });
        assert.strictEqual(result, false);
    });

    it("handles situations without parameters, when the constraints are set to type 'null'", () => {
        let [result, reason] = checkParameters(null, {
            type: "null"
        });
        assert.strictEqual(result, true);
    });

    it("denies parameters when the constraints are set to type 'null'", () => {
        let [result, reason] = checkParameters("test", {
            type: "none"
        });
        assert.strictEqual(result, false);
    });

    it("accepts all parameters when constraint is set to type 'any'", () => {
        let [result, reason] = checkParameters({
            test1: "test",
            test2: 123,
            test3: [1,2,3]
        }, {
            type: "any"
        });
        assert.strictEqual(result, true);
    });

    it("handles the type constraint 'string' correctly", () => {
        let [result1, reason1] = checkParameters("test", {type: "string"});
        assert.strictEqual(result1, true);
        assert.strictEqual(reason1, "Constraints specify to accept a string (/)");
        let [result2, reason2] = checkParameters(123, {type: "string"});
        assert.strictEqual(result2, false);
        assert.strictEqual(reason2, "Constraints specify to accept a string (/)");
        let [result3, reason3] = checkParameters(null, {type: "string"});
        assert.strictEqual(result3, false);
        assert.strictEqual(reason3, "Constraints specify to accept a string (/)");
    });

    it("handles the type constraint 'number' correctly", () => {
        let [result1, reason1] = checkParameters(123, {type: "number"});
        assert.strictEqual(result1, true);
        assert.strictEqual(reason1, "Constraints specify to accept a number (/)");
        let [result2, reason2] = checkParameters("test", {type: "number"});
        assert.strictEqual(result2, false);
        assert.strictEqual(reason2, "Constraints specify to accept a number (/)");
        let [result3, reason3] = checkParameters(null, {type: "number"});
        assert.strictEqual(result3, false);
        assert.strictEqual(reason3, "Constraints specify to accept a number (/)");
        let [result4, reason4] = checkParameters(false, {type: "number"});
        assert.strictEqual(result4, false);
        assert.strictEqual(reason4, "Constraints specify to accept a number (/)");
        let [result5, reason5] = checkParameters(true, {type: "number"});
        assert.strictEqual(result5, false);
        assert.strictEqual(reason5, "Constraints specify to accept a number (/)");
    });

    it("handles the type constraint 'boolean' correctly", () => {
        let [result1, reason1] = checkParameters(false, {type: "boolean"});
        assert.strictEqual(result1, true);
        assert.strictEqual(reason1, "Constraints specify to accept a boolean (/)");
        let [result2, reason2] = checkParameters(true, {type: "boolean"});
        assert.strictEqual(result2, true);
        assert.strictEqual(reason2, "Constraints specify to accept a boolean (/)");
        let [result3, reason3] = checkParameters(123, {type: "boolean"});
        assert.strictEqual(result3, false);
        assert.strictEqual(reason3, "Constraints specify to accept a boolean (/)");
        let [result4, reason4] = checkParameters("test", {type: "boolean"});
        assert.strictEqual(result4, false);
        assert.strictEqual(reason4, "Constraints specify to accept a boolean (/)");
        let [result5, reason5] = checkParameters(null, {type: "boolean"});
        assert.strictEqual(result5, false);
        assert.strictEqual(reason5, "Constraints specify to accept a boolean (/)");
    });

    it("handles an array of multiple constraints by accepting the parameters if one constraint matches", () => {
        let [result1, reason1] = checkParameters(false, [{type: "boolean"}, {type: "number"}]);
        assert.strictEqual(result1, true);
        assert.strictEqual(reason1, "Constraints specify to accept a boolean ({0}/)");
        let [result2, reason2] = checkParameters(true, [{type: "boolean"}, {type: "number"}]);
        assert.strictEqual(result2, true);
        assert.strictEqual(reason2, "Constraints specify to accept a boolean ({0}/)");
        let [result3, reason3] = checkParameters(123, [{type: "boolean"}, {type: "number"}]);
        assert.strictEqual(result3, true);
        assert.strictEqual(reason3, "Constraints specify to accept a number ({1}/)");
        let [result4, reason4] = checkParameters("test", [{type: "boolean"}, {type: "number"}]);
        assert.strictEqual(result4, false);
        assert.strictEqual(reason4, "Supplied parameters don't match with any of the accepted types (/)");
        let [result5, reason5] = checkParameters(null, [{type: "boolean"}, {type: "number"}]);
        assert.strictEqual(result5, false);
        assert.strictEqual(reason5, "Supplied parameters don't match with any of the accepted types (/)");
    });

    it("handles the type constraint 'array' correctly when no further constraints are supplied", () => {
        let [result1, reason1] = checkParameters([], {type: "array"});
        assert.strictEqual(result1, true);
        assert.strictEqual(reason1, "Array contents match the constraints (/)");
        let [result2, reason2] = checkParameters("test", {type: "array"});
        assert.strictEqual(result2, false);
        assert.strictEqual(reason2, "Constraints specify to accept an array (/)");
    });
    it("handles the type constraint 'array' correctly when a minimum length is supplied", () => {
        let [result1, reason1] = checkParameters([], {type: "array", minlength: 2});
        assert.strictEqual(result1, false);
        assert.strictEqual(reason1, "Expected an array with at least 2 elements, found 0 elements (/)");
        let [result2, reason2] = checkParameters([1], {type: "array", minlength: 2});
        assert.strictEqual(result2, false);
        assert.strictEqual(reason2, "Expected an array with at least 2 elements, found 1 elements (/)");
        let [result3, reason3] = checkParameters([1,2], {type: "array", minlength: 2});
        assert.strictEqual(result3, true);
        assert.strictEqual(reason3, "Array contents match the constraints (/)");
        let [result4, reason4] = checkParameters([1,2,3], {type: "array", minlength: 2});
        assert.strictEqual(result4, true);
        assert.strictEqual(reason4, "Array contents match the constraints (/)");
    });
    it("handles the type constraint 'array' correctly when a maximum length is supplied", () => {
        let [result1, reason1] = checkParameters([], {type: "array", maxlength: 2});
        assert.strictEqual(result1, true);
        assert.strictEqual(reason1, "Array contents match the constraints (/)");
        let [result2, reason2] = checkParameters([1], {type: "array", maxlength: 2});
        assert.strictEqual(result2, true);
        assert.strictEqual(reason2, "Array contents match the constraints (/)");
        let [result3, reason3] = checkParameters([1,2], {type: "array", maxlength: 2});
        assert.strictEqual(result3, true);
        assert.strictEqual(reason3, "Array contents match the constraints (/)");
        let [result4, reason4] = checkParameters([1,2,3], {type: "array", maxlength: 2});
        assert.strictEqual(result4, false);
        assert.strictEqual(reason4, "Expected an array with at most 2 elements, found 3 elements (/)");
    });
    it("handles the type constraint 'array' correctly when an exact length is supplied", () => {
        let [result1, reason1] = checkParameters([], {type: "array", length: 2});
        assert.strictEqual(result1, false);
        assert.strictEqual(reason1, "Expected an array with 2 elements, found 0 elements (/)");
        let [result2, reason2] = checkParameters([1], {type: "array", length: 2});
        assert.strictEqual(result2, false);
        assert.strictEqual(reason2, "Expected an array with 2 elements, found 1 elements (/)");
        let [result3, reason3] = checkParameters([1,2], {type: "array", length: 2});
        assert.strictEqual(result3, true);
        assert.strictEqual(reason3, "Array contents match the constraints (/)");
        let [result4, reason4] = checkParameters([1,2,3], {type: "array", length: 2});
        assert.strictEqual(result4, false);
        assert.strictEqual(reason4, "Expected an array with 2 elements, found 3 elements (/)");
    });
    it("handles the type constraint 'array' correctly when a type is supplied", () => {
        let [result1, reason1] = checkParameters([1,2,3], {type: "array", contains: "number"});
        assert.strictEqual(result1, true, "array of numbers validates for type number");
        assert.strictEqual(reason1, "Array contents match the constraints (/)");
        let [result2, reason2] = checkParameters([1,"test",3], {type: "array", contains: "number"});
        assert.strictEqual(result2, false, "array of numbers and strings doesn't validate for type number");
        assert.strictEqual(reason2, "Constraints specify to accept a number ([1]/)");
        let [result3, reason3] = checkParameters([], {type: "array", contains: "number"});
        assert.strictEqual(result3, true);
        assert.strictEqual(reason3, "Array contents match the constraints (/)");
        let [result4, reason4] = checkParameters(["a", "b", "c"], {type: "array", contains: "string"});
        assert.strictEqual(result4, true);
        assert.strictEqual(reason4, "Array contents match the constraints (/)");
        let [result5, reason5] = checkParameters(["a", "b", 3], {type: "array", contains: "string"});
        assert.strictEqual(result5, false);
        assert.strictEqual(reason5, "Constraints specify to accept a string ([2]/)");
    });
    it("handles the type constraint 'array' correctly when an array of types is supplied", () => {
        let [result1, reason1] = checkParameters([1,2,3], {type: "array", contains: ["number", "boolean"]});
        assert.strictEqual(result1, true, "array of numbers validates for type [number, boolean]");
        assert.strictEqual(reason1, "Array contents match the constraints (/)");
        let [result2, reason2] = checkParameters([1,"test",3], {type: "array", contains: ["number", "boolean"]});
        assert.strictEqual(result2, false, "array of numbers and strings doesn't validate for type [number, boolean]");
        assert.strictEqual(reason2, "Constraints specify to accept any of number, boolean ([1]/)");
        let [result3, reason3] = checkParameters([], {type: "array", contains: ["number", "boolean"]});
        assert.strictEqual(result3, true);
        assert.strictEqual(reason3, "Array contents match the constraints (/)");
        let [result4, reason4] = checkParameters([true], {type: "array", contains: ["number", "boolean"]});
        assert.strictEqual(result4, true);
        assert.strictEqual(reason4, "Array contents match the constraints (/)");
        let [result5, reason5] = checkParameters(["a", "b", "c"], {type: "array", contains: ["string", "boolean"]});
        assert.strictEqual(result5, true);
        assert.strictEqual(reason5, "Array contents match the constraints (/)");
        let [result6, reason6] = checkParameters(["a", "b", 3], {type: "array", contains: ["string", "boolean"]});
        assert.strictEqual(result6, false);
        assert.strictEqual(reason6, "Constraints specify to accept any of string, boolean ([2]/)");
    });
    it("handles the type constraint 'object' correctly when no further constraints are supplied", () => {
        let [result1, reason1] = checkParameters({}, {type: "object"});
        assert.strictEqual(result1, true, "empty object validates for type object");
        assert.strictEqual(reason1, "Object has no further constraints (/)");
        let [result2, reason2] = checkParameters([], {type: "object"});
        assert.strictEqual(result2, false, "empty object validates for type object");
        assert.strictEqual(reason2, "Constraints specify to accept an object, not an array (/)");
    });
    it("handles the type constraint 'object' correctly when required keys are specified", () => {
        let [result1, reason1] = checkParameters({test: 123}, {type: "object", required: { "test": {} }});
        assert.strictEqual(result1, true, "object with key that matches the required key validates");
        assert.strictEqual(reason1, "Object matches the constraints (/)");
        let [result2, reason2] = checkParameters({}, {type: "object", required: { "test1": {} }});
        assert.strictEqual(result2, false, "object with without the required key doesn't validate");
        assert.strictEqual(reason2, "Object is missing required parameter 'test1' (/)");
        let [result3, reason3] = checkParameters({test1: 123, test2: 456}, {type: "object", required: { "test1": {} }});
        assert.strictEqual(result3, false, "object with key that doesn't match the required key doesn't validate");
        assert.strictEqual(reason3, "Found stray parameter test2 (/)");
    });
    it("handles the type constraint 'object' correctly when optional keys are specified", () => {
        let [result1, reason1] = checkParameters({test: 123}, {type: "object", optional: { "test": {} }});
        assert.strictEqual(result1, true, "object with key that matches the optional key validates");
        assert.strictEqual(reason1, "Object matches the constraints (/)");
    });
    it("handles the type constraint 'object' correctly when required and optional keys are specified", () => {
        let [result1, reason1] = checkParameters({test1: 123, test2: 456}, {type: "object", required: { "test1": {} }, optional: { "test2": {} }});
        assert.strictEqual(result1, true, "object with keys that matche the required and optional keys validates");
        assert.strictEqual(reason1, "Object matches the constraints (/)");
        let [result2, reason2] = checkParameters({test1: 123}, {type: "object", required: { "test1": {} }, optional: { "test2": {} }});
        assert.strictEqual(result2, true, "object with key that matches the required key validates");
        assert.strictEqual(reason2, "Object matches the constraints (/)");
        let [result3, reason3] = checkParameters({test2: 456}, {type: "object", required: { "test1": {} }, optional: { "test2": {} }});
        assert.strictEqual(result3, false, "object with without the required key doesn't validate");
        assert.strictEqual(reason3, "Object is missing required parameter 'test1' (/)");
        let [result4, reason4] = checkParameters({test1: 123, test2: 456, test3: 789}, {type: "object", required: { "test1": {} }, optional: { "test2": {} }});
        assert.strictEqual(result4, false, "object with key that doesn't match the required or optional keys doesn't validate");
        assert.strictEqual(reason4, "Found stray parameter test3 (/)");
    });
});
