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

// localStorage stand-in, backed by a plain object
function fakeLocalStorage() {
    var store = {};
    return {
        getItem: function (k) { return store.hasOwnProperty(k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = v; },
        removeItem: function (k) { delete store[k]; }
    };
}

module.exports.test_portalRoot_defaultsToNull = function (test) {
    global.window = { localStorage: fakeLocalStorage() };
    test.equal(new AjaxApi(function () {}).portalRoot, null);
    test.done();
};

module.exports.test_rootRelativeUrl_resolvedAgainstPortalRoot = function (test) {
    var captured = [];
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/++tw.quizdb++/' } };
    new AjaxApi(fakeJqAjax(captured)).getJson('/@@quizdb-subscriptions');
    test.equal(captured[0].url, 'https://tutor-web.example/@@quizdb-subscriptions');
    test.done();
};

module.exports.test_rootRelativeUrl_trailingSlashNotDoubled = function (test) {
    var captured = [];
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example' } };
    new AjaxApi(fakeJqAjax(captured)).getJson('/@@quizdb-subscriptions');
    test.equal(captured[0].url, 'https://tutor-web.example/@@quizdb-subscriptions');
    test.done();
};

module.exports.test_absoluteUrl_leftUntouchedByPortalRoot = function (test) {
    var captured = [];
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };
    new AjaxApi(fakeJqAjax(captured)).getJson('https://elsewhere.example/foo');
    test.equal(captured[0].url, 'https://elsewhere.example/foo');
    test.done();
};

module.exports.test_rootRelativeUrl_leftUntouchedWithoutOverride = function (test) {
    var captured = [];
    global.window = { localStorage: fakeLocalStorage(), location: "http://tw.net/" };
    new AjaxApi(fakeJqAjax(captured)).getJson('/@@quizdb-subscriptions');
    test.equal(captured[0].url, 'http://tw.net/@@quizdb-subscriptions');
    test.done();
};

module.exports.test_relativeUrl_resolvedAgainstFullPath = function (test) {
    var captured = [];
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/++tw.quizdb++/' } };
    new AjaxApi(fakeJqAjax(captured)).getJson('@@stuff');
    test.equal(captured[0].url, 'https://tutor-web.example/++tw.quizdb++/@@stuff');
    test.done();
};

module.exports.test_token_notAttachedWhenAbsent = function (test) {
    var captured = [], api;
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };
    api = new AjaxApi(fakeJqAjax(captured));
    api.getJson('/@@quizdb-subscriptions');
    test.equal(captured[0].headers, undefined);
    test.done();
};

module.exports.test_token_attachedAsAuthorizationHeader = function (test) {
    var captured = [], api;
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };
    api = new AjaxApi(fakeJqAjax(captured));
    api.setToken('abc123');
    api.getJson('/@@quizdb-subscriptions');
    test.equal(captured[0].headers.Authorization, 'Bearer abc123');
    test.done();
};

module.exports.test_token_clearedTokenNotReused = function (test) {
    var captured = [], api;
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };
    api = new AjaxApi(fakeJqAjax(captured));
    api.setToken('abc123');
    api.clearToken();
    api.getJson('/@@quizdb-subscriptions');
    test.equal(captured[0].headers, undefined);
    test.done();
};

module.exports.test_login_postsCredentialsAndStoresToken = function (test) {
    var captured = [], api;
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };
    api = new AjaxApi(function (args) {
        captured.push(args);
        return {
            then: function (onSuccess) {
                onSuccess({token: 'xyz789'}, 'success', {getResponseHeader: function () { return null; }});
                return this;
            },
            fail: function () { return this; }
        };
    });

    api.login('alice', 'hunter2').then(function () {
        test.equal(captured[0].url, 'https://tutor-web.example/@@jwt-login');
        test.equal(JSON.parse(captured[0].data).login, 'alice');
        test.equal(JSON.parse(captured[0].data).password, 'hunter2');
        test.equal(api.getToken(), 'xyz789');
        test.done();
    })['catch'](function (err) {
        test.ok(false, err.message);
        test.done();
    });
};

module.exports.test_logout_noTokenSkipsRequest = function (test) {
    var captured = [], api;
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };
    api = new AjaxApi(fakeJqAjax(captured));

    api.logout().then(function () {
        test.equal(captured.length, 0);
        test.done();
    })['catch'](function (err) {
        test.ok(false, err.message);
        test.done();
    });
};

module.exports.test_logout_revokesTokenServerSideThenClearsItLocally = function (test) {
    var captured = [], api;
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };
    api = new AjaxApi(function (args) {
        captured.push(args);
        return {
            then: function (onSuccess) {
                onSuccess({ok: true}, 'success', {getResponseHeader: function () { return null; }});
                return this;
            },
            fail: function () { return this; }
        };
    });
    api.setToken('xyz789');

    api.logout().then(function () {
        test.equal(captured[0].url, 'https://tutor-web.example/@@jwt-logout');
        test.equal(captured[0].headers.Authorization, 'Bearer xyz789');
        test.equal(api.getToken(), null);
        test.done();
    })['catch'](function (err) {
        test.ok(false, err.message);
        test.done();
    });
};

module.exports.test_logout_clearsTokenLocallyEvenIfServerCallFails = function (test) {
    var api;
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };
    api = new AjaxApi(function () {
        return {
            then: function () { return this; },
            fail: function (onFail) {
                onFail({status: 0}, 'error', undefined);
                return this;
            }
        };
    });
    api.setToken('xyz789');

    api.logout().then(function () {
        test.equal(api.getToken(), null);
        test.done();
    })['catch'](function (err) {
        test.ok(false, err.message);
        test.done();
    });
};

// window.caches/window.fetch stand-in for a cache-miss, capturing the fetch() call it makes
function fakeCachesAndFetch(capturedFetchOpts) {
    return {
        caches: {
            open: function () {
                return Promise.resolve({
                    match: function () { return Promise.resolve(undefined); },
                    put: function () { return Promise.resolve(); }
                });
            },
            delete: function () { return Promise.resolve(); }
        },
        fetch: function (url, opts) {
            capturedFetchOpts.push(opts);
            return Promise.resolve({
                ok: true,
                clone: function () { return this; },
                headers: {get: function () { return 'application/json'; }},
                json: function () { return Promise.resolve({ok: true}); },
                text: function () { return Promise.resolve('{}'); }
            });
        },
        Response: function (body, init) { return {body: body, init: init}; }
    };
}

module.exports.test_getCachedJson_notAttachedWhenAbsent = function (test) {
    var captured = [], api, extra;
    extra = fakeCachesAndFetch(captured);
    global.window = {
        localStorage: fakeLocalStorage(),
        twConfig: { portalRoot: 'https://tutor-web.example/' },
        caches: extra.caches,
        fetch: extra.fetch,
        Response: extra.Response
    };
    api = new AjaxApi(function () {});

    api.getCachedJson('/@@quizdb-subscriptions', {}).then(function () {
        test.equal(captured[0].headers, undefined);
        test.done();
    })['catch'](function (err) {
        test.ok(false, err.message);
        test.done();
    });
};

module.exports.test_getCachedJson_attachesAuthorizationHeader = function (test) {
    var captured = [], api, extra;
    extra = fakeCachesAndFetch(captured);
    global.window = {
        localStorage: fakeLocalStorage(),
        twConfig: { portalRoot: 'https://tutor-web.example/' },
        caches: extra.caches,
        fetch: extra.fetch,
        Response: extra.Response
    };
    api = new AjaxApi(function () {});
    api.setToken('abc123');

    api.getCachedJson('/@@quizdb-subscriptions', {}).then(function () {
        test.equal(captured[0].headers.Authorization, 'Bearer abc123');
        test.done();
    })['catch'](function (err) {
        test.ok(false, err.message);
        test.done();
    });
};

