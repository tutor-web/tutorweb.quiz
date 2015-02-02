/*jslint nomen: true, plusplus: true, browser:true, todo:true, regexp: true */
/*global require, module */
var LZString = require('lz-string');

// Wrapper to let localstorage take JSON
module.exports = function (backing, shouldCompress) {
    "use strict";
    this.backing = backing;

    this.removeItem = function (key) {
        return backing.removeItem(key);
    };

    this.getItem = function (key) {
        var value = backing.getItem(key);
        if (value === null || value === "" || value === 0) {
            return value;
        }
        if ('[{"0123456789'.indexOf(value.charAt(0)) === -1) {
            // Doesn't look like JSON, so decompress first
            value = LZString.decompressFromUTF16(value);
        }
        return JSON.parse(value);
    };

    this.setItem = function (key, value) {
        if (value === null || value === "" || value === 0) {
            backing.setItem(key, value);
        } else if (typeof shouldCompress === "function" && !shouldCompress(key)) {
            backing.setItem(key, JSON.stringify(value));
        } else {
            backing.setItem(key, LZString.compressToUTF16(JSON.stringify(value)));
        }
    };

    this.listItems = function () {
        var i, out = [];
        for (i = 0; i < backing.length; i++) {
            out.push(backing.key(i));
        }
        return out;
    };
};
