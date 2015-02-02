"use strict";

var JSONLocalStorage = require('../lib/jsonls.js');

function MockLocalStorage() {
    this.obj = {};
    this.length = 0;

    this.removeItem = function (key) {
        this.length--;
        return delete this.obj[key];
    };

    this.getItem = function (key) {
        var value = this.obj[key];
        return typeof value === 'undefined' ? null : value;
    };

    this.setItem = function (key, value) {
        this.length++;
        return this.obj[key] = value;
    };

    this.key = function (i) {
        return Object.keys(this.obj)[i];
    };
}

module.exports.testStorage = function (test) {
    var backing = new MockLocalStorage(),
        ls = new JSONLocalStorage(backing);

    // Nothing stored initially
    test.deepEqual(ls.listItems(), []);

    // Request for invalid item returns null
    test.deepEqual(ls.getItem("unkown-item"), null);

    // Store some things
    ls.setItem("cattle", {"cows": ["daisy", "fréda"], "bulls": ["mr beef"]});
    ls.setItem("pigs", ["george", "wilma"]);
    test.deepEqual(ls.listItems(), ["cattle", "pigs"]);

    // Can get them back again
    test.deepEqual(ls.getItem("cattle"), {"cows": ["daisy", "fréda"], "bulls": ["mr beef"]});
    test.deepEqual(ls.getItem("pigs"), ["george", "wilma"]);

    // Request for invalid item still returns null
    test.deepEqual(ls.getItem("unkown-item"), null);

    // Can remove one item
    ls.removeItem("pigs");
    test.deepEqual(ls.listItems(), ["cattle"]);
    test.deepEqual(ls.getItem("pigs"), null);

    test.done();
};

module.exports.testSelectiveCompression = function (test) {
    var backing = new MockLocalStorage(), ls;

    // By default everything is compressed
    ls = new JSONLocalStorage(backing);
    ls.setItem("cows", ["daisy", "fréda"]);
    ls.setItem("pigs", ["george", "wilma"]);
    ls.setItem("dogs", { "fido" : "sausage dog", "dora" : "jack russell"});
    test.notEqual(backing.getItem("cows").charAt(0), "[")
    test.notEqual(backing.getItem("pigs").charAt(0), "[")
    test.notEqual(backing.getItem("dogs").charAt(0), "{")

    // Only compress cows
    ls = new JSONLocalStorage(backing, function (k) { return k === "cows" });

    // Can still read compressed items in storage
    test.deepEqual(ls.getItem("cows"), ["daisy", "fréda"]);
    test.deepEqual(ls.getItem("pigs"), ["george", "wilma"]);
    test.deepEqual(ls.getItem("dogs"), { "fido" : "sausage dog", "dora" : "jack russell"});

    // Setting items now means cows is compressed
    ls.setItem("cows", ["daisy", "fréda"]);
    ls.setItem("pigs", ["george", "wilma"]);
    ls.setItem("dogs", { "fido" : "sausage dog", "dora" : "jack russell"});
    test.notEqual(backing.getItem("cows").charAt(0), "[")
    test.equal(backing.getItem("pigs").charAt(0), "[")
    test.equal(backing.getItem("dogs").charAt(0), "{")

    // Can still read compressed items in storage
    test.deepEqual(ls.getItem("cows"), ["daisy", "fréda"]);
    test.deepEqual(ls.getItem("pigs"), ["george", "wilma"]);
    test.deepEqual(ls.getItem("dogs"), { "fido" : "sausage dog", "dora" : "jack russell"});

    // So can compress-everything engine
    ls = new JSONLocalStorage(backing);
    test.deepEqual(ls.getItem("cows"), ["daisy", "fréda"]);
    test.deepEqual(ls.getItem("pigs"), ["george", "wilma"]);
    test.deepEqual(ls.getItem("dogs"), { "fido" : "sausage dog", "dora" : "jack russell"});

    test.done();
};

module.exports.testLoopback = function (test) {
    var backing = new MockLocalStorage(),
        ls = new JSONLocalStorage(backing);

    function doLoopbackTests(values) {
        values.map(function (value) {
            ls.setItem("x", value)
            test.deepEqual(ls.getItem("x"), value);
        });
    }

    // Can store and retrieve various falsy things
    doLoopbackTests([null, 0, ""]);

    // Can store raw numbers
    doLoopbackTests([22.4, .3, 0x99]);
    doLoopbackTests(Array.apply(null, {length: 50}).map(Number.call, Number));  // 0..49

    // Can store raw strings
    doLoopbackTests(["woo"]);

    test.done();
};
