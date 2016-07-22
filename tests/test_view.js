"use strict";

var parse_qs = require('../lib/parse_qs.js').parse_qs;
var View = require('../lib/view.js');

// Do-nothing JQuery for where we're not using it.
var nullJq = function (x) {
    return x;
}

module.exports.testGenerateUrl = function (test) {
    function genUrl(origHref, origHash, newOpts) {
        var view = new View(nullJq);
        // Should start the state machine to do this, but meh
        view.curUrl = parse_qs({pathname: '', href: origHref, hash: origHash, search: ""});
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

module.exports.portalRootUrl = function (test) {
    function portalRootUrl(location, extra) {
        var view = new View(nullJq);

        global.window = { "location": location };
        return view.portalRootUrl(extra);
    }

    test.equal(
        portalRootUrl({"protocol": "http:", "host": "moo:8000"}),
        "http://moo:8000/"
    )

    test.equal(
        portalRootUrl({"protocol": "https:", "host": "oink"}, "pig"),
        "https://oink/pig"
    )

    test.done();
};
