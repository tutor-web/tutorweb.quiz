"use strict";

var parse_qs = require('../lib/parse_qs.js').parse_qs;

module.exports.testParseQS = function (test) {
    // Can parse both hash and search
    function parseQS(pathname, search, hash) {
        return parse_qs({
            pathname: pathname,
            hash: hash,
            search: search
        });
    }

    // Can use ; or & as separator
    test.deepEqual(parseQS('/quiz.html', '?moo=yes;oink=bleh&baa=maybe', '#boing'), {
        _doc: "quiz.html",
        _args: ["boing"],
        moo: "yes",
        oink: "bleh",
        baa: "maybe"
    })

    // Empty search still works
    test.deepEqual(parseQS('/host:000/animal.html', '', '#camel=alice;snake=sid'), {
        _doc: "animal.html",
        camel: "alice",
        snake: "sid"
    })

    // Hash wins if both defined
    test.deepEqual(parseQS('/host:000/animal.html', '?camel=george', '#camel=alice'), {
        _doc: "animal.html",
        camel: "alice",
    })

    // Strings decoded
    test.deepEqual(parseQS('/host:000/animal.html', '?camel=george', '#camel=alice%20the%20camel'), {
        _doc: "animal.html",
        camel: "alice the camel",
    })

    // Can get by with just a hash
    test.deepEqual(parseQS(undefined, undefined, '#camel=alice'), {
        camel: "alice",
    })

    test.done();
};

