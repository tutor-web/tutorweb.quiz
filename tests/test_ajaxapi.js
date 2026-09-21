"use strict";

var AjaxApi = require('../lib/ajaxapi.js');

// jqAjax stand-in that just records what it was called with
function fakeJqAjax(capturedArgs) {
    return function (args) {
        capturedArgs.push(args);
        return {
            then: function () { return this; },
            fail: function () { return this; }
        };
    };
}

module.exports.test_portalRoot_defaultsToNull = function (test) {
    global.window = {};
    test.equal(new AjaxApi(function () {}).portalRoot, null);
    test.done();
};

module.exports.test_rootRelativeUrl_resolvedAgainstPortalRoot = function (test) {
    var captured = [];
    global.window = { twConfig: { portalRoot: 'https://tutor-web.example/++tw.quizdb++/' } };
    new AjaxApi(fakeJqAjax(captured)).getJson('/@@quizdb-subscriptions');
    test.equal(captured[0].url, 'https://tutor-web.example/@@quizdb-subscriptions');
    test.done();
};

module.exports.test_rootRelativeUrl_trailingSlashNotDoubled = function (test) {
    var captured = [];
    global.window = { twConfig: { portalRoot: 'https://tutor-web.example' } };
    new AjaxApi(fakeJqAjax(captured)).getJson('/@@quizdb-subscriptions');
    test.equal(captured[0].url, 'https://tutor-web.example/@@quizdb-subscriptions');
    test.done();
};

module.exports.test_absoluteUrl_leftUntouchedByPortalRoot = function (test) {
    var captured = [];
    global.window = { twConfig: { portalRoot: 'https://tutor-web.example/' } };
    new AjaxApi(fakeJqAjax(captured)).getJson('https://elsewhere.example/foo');
    test.equal(captured[0].url, 'https://elsewhere.example/foo');
    test.done();
};

module.exports.test_rootRelativeUrl_leftUntouchedWithoutOverride = function (test) {
    var captured = [];
    global.window = { location: "http://tw.net/" };
    new AjaxApi(fakeJqAjax(captured)).getJson('/@@quizdb-subscriptions');
    test.equal(captured[0].url, 'http://tw.net/@@quizdb-subscriptions');
    test.done();
};

module.exports.test_relativeUrl_resolvedAgainstFullPath = function (test) {
    var captured = [];
    global.window = { twConfig: { portalRoot: 'https://tutor-web.example/++tw.quizdb++/' } };
    new AjaxApi(fakeJqAjax(captured)).getJson('@@stuff');
    test.equal(captured[0].url, 'https://tutor-web.example/++tw.quizdb++/@@stuff');
    test.done();
};

