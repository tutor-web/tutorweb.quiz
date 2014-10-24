"use strict";

var View = require('../lib/view.js');

// Do-nothing JQuery for where we're not using it.
var nullJq = function (x) {
    return x;
}

module.exports.testParseQS = function (test) {
    // Can parse both hash and search
    function parseQS(href, search, hash) {
        return (new View(nullJq)).parseQS({
            href: href,
            hash: hash,
            search: search
        });
    }

    // Can use ; or & as separator
    test.deepEqual(parseQS('http://quiz.html', '?moo=yes;oink=bleh&baa=maybe', '#boing'), {
        _doc: "quiz.html",
        _opt: "boing",
        moo: "yes",
        oink: "bleh",
        baa: "maybe"
    })

    // Empty search still works
    test.deepEqual(parseQS('http://host:000/animal.html', '', '#camel=alice;snake=sid'), {
        _doc: "animal.html",
        camel: "alice",
        snake: "sid"
    })

    // Hash wins if both defined
    test.deepEqual(parseQS('http://host:000/animal.html', '?camel=george', '#camel=alice'), {
        _doc: "animal.html",
        camel: "alice",
    })

    // Strings decoded
    test.deepEqual(parseQS('http://host:000/animal.html', '?camel=george', '#camel=alice%20the%20camel'), {
        _doc: "animal.html",
        camel: "alice the camel",
    })

    test.done();
};

module.exports.testGenerateUrl = function (test) {
    function genUrl(origHref, origHash, newOpts) {
        var view = new View(nullJq);
        // Should start the state machine to do this, but meh
        view.curUrl = view.parseQS({href: origHref, hash: origHash, search: ""});
        return view.generateUrl(newOpts);
    }

    // Don't add the URL if we don't have to, override opts
    test.deepEqual(genUrl("http://test/quiz.html", "#!moo=yes;", {moo : "no"}),
        "#!moo=no")

    // Multiple options are separated by ;
    test.deepEqual(
        genUrl("http://test/quiz.html",
            "#!moo=yes;",
            {_doc: "start.html", oink : "maybe"}),
        "start.html#!moo=yes;oink=maybe")

    test.done();
};
