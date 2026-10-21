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

// ...and one that answers with (data), as jQuery's deferred does
function fakeJqAjaxReturning(capturedArgs, data) {
    return function (args) {
        capturedArgs.push(args);
        return {
            then: function (cb) {
                cb(data, 'success', { getResponseHeader: function () { return 'application/json'; } });
                return this;
            },
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

module.exports.test_ploneRedirect_setsLocationWithoutCordova = function (test) {
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' }, location: {} };
    new AjaxApi(function () {}).ploneRedirect('/foo');
    test.equal(global.window.location.href, 'https://tutor-web.example/foo');
    test.done();
};

module.exports.test_ploneRedirect_opensSystemBrowserUnderCordova = function (test) {
    var opened = [];
    global.window = {
        localStorage: fakeLocalStorage(),
        twConfig: { portalRoot: 'https://tutor-web.example/' },
        location: {},
        cordova: { InAppBrowser: { open: function (url, target) { opened.push([url, target]); } } }
    };
    new AjaxApi(function () {}).ploneRedirect('/foo');
    test.deepEqual(opened, [['https://tutor-web.example/foo', '_system']]);
    test.equal(global.window.location.href, undefined);
    test.done();
};

module.exports.test_relativeUrl_resolvedAgainstFullPath = function (test) {
    var captured = [];
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/++tw.quizdb++/' } };
    new AjaxApi(fakeJqAjax(captured)).getJson('@@stuff');
    test.equal(captured[0].url, 'https://tutor-web.example/++tw.quizdb++/@@stuff');
    test.done();
};

module.exports.test_syncLecture_defaultsToTheLectureItself = function (test) {
    var captured = [], lecture = {
        uri: '/tutorials/dept/12.json',
        answerQueue: [],
        questions: [{ uri: 'ut:question0' }],
        settings: { hist_sel: '0' },
    };
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };

    // No sync endpoint configured, so a lecture syncs to itself - which is
    // where the Plone backend expects it, and it wants the whole lecture:
    // what it hands back is built from what it was sent
    new AjaxApi(fakeJqAjax(captured)).syncLecture(lecture);
    test.equal(captured[0].url, 'https://tutor-web.example/tutorials/dept/12.json');
    test.equal(captured[0].type, 'POST');
    test.deepEqual(JSON.parse(captured[0].data), lecture);
    test.done();
};

module.exports.test_syncLecture_sendsTheSyncEndpointOnlyWhatItNeeds = function (test) {
    var captured = [];
    global.window = { localStorage: fakeLocalStorage(), twConfig: {
        portalRoot: 'https://tutor-web.example/',
        syncUri: '/sync',
    } };

    // One endpoint for every lecture, which is what lets the bundled content
    // keep the paths the dump gave it - so the lecture says which it is...
    new AjaxApi(fakeJqAjax(captured)).syncLecture({
        uri: '/tutorials/dept/12.json',
        answerQueue: [{ uri: 'ut:question0', answer_time: 1792403615 }],
        questions: [{ uri: 'ut:question0' }, { uri: 'ut:question1' }],
        settings: { hist_sel: '0' },
        title: 'A lecture',
        question_uri: '/tutorials/dept/12/all-questions',
    });
    test.equal(captured[0].url, 'https://tutor-web.example/sync');

    // ...and nothing else goes with it. The questions and the settings came
    // from a server in the first place.
    test.deepEqual(JSON.parse(captured[0].data), {
        uri: '/tutorials/dept/12.json',
        answerQueue: [{ uri: 'ut:question0', answer_time: 1792403615 }],
    });
    test.done();
};

module.exports.test_syncLecture_passesExtrasThrough = function (test) {
    var captured = [];
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };

    // A lecture sync is given longer than the five seconds everything else gets
    new AjaxApi(fakeJqAjax(captured)).syncLecture({ uri: 'ut:lecture0' }, { timeout: 60000 });
    test.equal(captured[0].timeout, 60000);
    test.done();
};

module.exports.test_syncLecture_fetchesALectureWeDontHoldFromTheBundle = function (test) {
    var captured = [];
    global.window = { localStorage: fakeLocalStorage(), twConfig: {
        portalRoot: 'https://tutor-web.example/',
        syncUri: '/sync',
    } };

    // No questions in it, so it's a lecture we have never seen: an app build
    // has the content of one bundled at the URI the dump gave it, and a GET
    // of that needs neither network nor login
    new AjaxApi(fakeJqAjax(captured)).syncLecture({ uri: '/tutorials/dept/12.json', answerQueue: [] });
    test.equal(captured[0].url, 'https://tutor-web.example/tutorials/dept/12.json');
    test.equal(captured[0].type, 'GET');
    test.equal(captured[0].data, undefined, 'nothing to send with it');
    test.done();
};

module.exports.test_syncSubscriptions_asksPloneForTheTable = function (test) {
    var captured = [];
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };

    // Nothing bundled, so the server is the only source there is - and it's
    // the server that decides what this student is subscribed to
    new AjaxApi(fakeJqAjax(captured)).syncSubscriptions({ del_lec: '/tutorials/dept/12.json' });
    test.equal(captured[0].url, 'https://tutor-web.example/@@quizdb-subscriptions');
    test.equal(captured[0].type, 'POST');
    test.deepEqual(JSON.parse(captured[0].data), { del_lec: '/tutorials/dept/12.json' });
    test.done();
};

module.exports.test_syncSubscriptions_readsTheBundledTableWhereThereIsOne = function (test) {
    var captured = [];
    global.window = { localStorage: fakeLocalStorage(), twConfig: {
        portalRoot: 'https://tutor-web.example/',
        seedSubscriptions: '/subscriptions.json',
        syncUri: '/sync',
    } };

    // The table an app build ships with, which is all of what it ships and
    // nothing about what the student subscribed to - so the add / del it was
    // given go nowhere
    new AjaxApi(fakeJqAjax(captured)).syncSubscriptions({ del_lec: '/tutorials/dept/12.json' });
    test.equal(captured[0].url, 'https://tutor-web.example/subscriptions.json');
    test.equal(captured[0].type, 'GET');
    test.equal(captured[0].data, undefined);
    test.done();
};

module.exports.test_registerStudent_needsSomewhereToRegister = function (test) {
    var captured = [];
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };

    // Plone knows who we are from the login, and there is no /register on
    // it: nothing is sent, and nothing comes back to keep
    return new AjaxApi(fakeJqAjax(captured)).registerStudent({ uuid: 'ut:uuid' }).then(function (reg) {
        test.equal(reg, null);
        test.deepEqual(captured, []);
        test.done();
    });
};

module.exports.test_relativeUrl_isHowRegisterFindsTheServer = function (test) {
    var captured = [];
    global.window = { localStorage: fakeLocalStorage(), twConfig: {
        portalRoot: 'https://tutor-web.example/++tw.quizdb++/',
        syncUri: '/sync',
    } };

    // quizlib says who to register and leaves the rest to us, so a build is
    // pointed at a backend by portalRoot alone
    new AjaxApi(fakeJqAjax(captured)).registerStudent({ uuid: 'x' });
    test.equal(captured[0].url, 'https://tutor-web.example/++tw.quizdb++/register');
    test.equal(captured[0].type, 'POST');
    test.deepEqual(JSON.parse(captured[0].data), { uuid: 'x' });
    test.done();
};

module.exports.test_studentAward_asksPloneWhereThereIsNoBackend = function (test) {
    var captured = [];
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };

    new AjaxApi(fakeJqAjax(captured)).studentAward({ walletId: 'B1234', captchaResponse: 'ok' });
    test.equal(captured[0].url, 'https://tutor-web.example/@@quizdb-student-award');
    test.equal(captured[0].type, 'POST');
    test.deepEqual(JSON.parse(captured[0].data), { walletId: 'B1234', captchaResponse: 'ok' });
    test.done();
};

module.exports.test_studentAward_hasItsOwnEndpointOnTheBackend = function (test) {
    var captured = [];
    global.window = { localStorage: fakeLocalStorage(), twConfig: {
        portalRoot: 'https://tutor-web.example/++tw.quizdb++/',
        syncUri: '/sync',
    } };

    // Its own endpoint rather than part of a lecture sync: a claim is about
    // a student rather than any one lecture, and it moves coin
    new AjaxApi(fakeJqAjax(captured)).studentAward({ walletId: null, captchaResponse: null });
    test.equal(captured[0].url, 'https://tutor-web.example/++tw.quizdb++/award');
    test.equal(captured[0].type, 'POST');
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

module.exports.test_studentUuid_comesFromRegistering = function (test) {
    var captured = [], api, uuid = '6f9619ff-8b86-4011-b42d-00c04fc964ff';
    global.window = { localStorage: fakeLocalStorage(), twConfig: {
        portalRoot: 'https://tutor-web.example/',
        syncUri: '/sync',
    } };
    api = new AjaxApi(fakeJqAjaxReturning(captured, { uuid: uuid, settings: {} }));

    // Nobody until the server says who we are: nothing on the client mints
    // an identity, so talking to it carries none either
    test.equal(api.studentUuid(), null);
    api.getJson('/@@quizdb-subscriptions');
    test.equal(captured[0].headers, undefined);

    return api.registerStudent({ client_time: 1792403610 }).then(function (reg) {
        // Registering says when, and nothing about who - that comes back
        test.deepEqual(JSON.parse(captured[1].data), { client_time: 1792403610 });
        test.equal(reg.uuid, uuid);

        // ...and is who we are from here on, stored raw so anything else
        // reading the key gets a uuid and not JSON
        test.equal(api.studentUuid(), uuid);
        test.equal(window.localStorage.getItem('_student_uuid'), uuid);
        test.done();
    });
};

module.exports.test_studentUuid_notKeptWithoutOne = function (test) {
    var captured = [], api;
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };
    api = new AjaxApi(fakeJqAjaxReturning(captured, {}));

    // Nowhere to register, so nobody to be: a Plone deployment knows who we
    // are from the login, and an answer there is chained to nothing
    return api.registerStudent({ client_time: 1792403610 }).then(function (reg) {
        test.equal(reg, null);
        test.deepEqual(captured, [], 'nothing sent');
        test.equal(api.studentUuid(), null);
        test.done();
    });
};

module.exports.test_studentUuid_attachedAsHeader = function (test) {
    var captured = [], api, uuid;
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };
    uuid = '6f9619ff-8b86-4011-b42d-00c04fc964ff';
    // As registering left it - see test_studentUuid_comesFromRegistering
    window.localStorage.setItem('_student_uuid', uuid);
    api = new AjaxApi(fakeJqAjax(captured));

    api.getJson('/@@quizdb-subscriptions');
    test.equal(captured[0].headers['X-Student-Uuid'], uuid);

    // ...and alongside the token rather than instead of it
    api.setToken('abc123');
    api.postJson('/@@quizdb-sync', {});
    test.equal(captured[1].headers.Authorization, 'Bearer abc123');
    test.equal(captured[1].headers['X-Student-Uuid'], uuid);
    test.done();
};

module.exports.test_studentUuid_survivesLogout = function (test) {
    var captured = [], api, uuid;
    global.window = { localStorage: fakeLocalStorage(), twConfig: { portalRoot: 'https://tutor-web.example/' } };
    uuid = '6f9619ff-8b86-4011-b42d-00c04fc964ff';
    window.localStorage.setItem('_student_uuid', uuid);
    api = new AjaxApi(fakeJqAjax(captured));

    // Forgetting a credential isn't forgetting who was answering: the answer
    // chain the uuid roots outlives any one login
    api.setToken('abc123');
    api.clearToken();
    api.getJson('/@@quizdb-subscriptions');
    test.equal(captured[0].headers.Authorization, undefined);
    test.equal(captured[0].headers['X-Student-Uuid'], uuid);
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


// window.caches stand-in with a real backing store, so a write can be read back
function fakeStatefulCaches(store) {
    return {
        caches: {
            open: function () {
                return Promise.resolve({
                    match: function (url) { return Promise.resolve(store[url]); },
                    put: function (url, response) { store[url] = response; return Promise.resolve(); }
                });
            },
            delete: function () { return Promise.resolve(); }
        },
        Response: function (body, init) {
            this.body = body;
            this.init = init;
            this.text = function () { return Promise.resolve(body); };
        }
    };
}

module.exports.test_injectCache_readBackByGetCachedJson = function (test) {
    var store = {}, fetched = [], api, extra;
    extra = fakeStatefulCaches(store);
    global.window = {
        localStorage: fakeLocalStorage(),
        twConfig: { portalRoot: 'https://tutor-web.example/' },
        caches: extra.caches,
        Response: extra.Response,
        fetch: function (url) { fetched.push(url); return Promise.reject(new Error('should not fetch')); }
    };
    api = new AjaxApi(function () {});

    api.injectCache('/dept1/lec1/quizdb-all-questions?abc123', {'ut:qn1': {title: 'Question 1'}}).then(function () {
        // Stored under the resolved URL, so getCachedJson's lookup finds it
        test.deepEqual(Object.keys(store), ['https://tutor-web.example/dept1/lec1/quizdb-all-questions?abc123']);
        return api.getCachedJson('/dept1/lec1/quizdb-all-questions?abc123', {});
    }).then(function (data) {
        test.deepEqual(data, {'ut:qn1': {title: 'Question 1'}});
        test.deepEqual(fetched, [], "Should be served from cache, not the network");
        test.done();
    })['catch'](function (err) {
        test.ok(false, err.message);
        test.done();
    });
};

module.exports.test_injectCache_rejectsWithoutCacheStorage = function (test) {
    global.window = {
        localStorage: fakeLocalStorage(),
        twConfig: { portalRoot: 'https://tutor-web.example/' }
    };

    new AjaxApi(function () {}).injectCache('/lec1/quizdb-all-questions?abc123', {}).then(function () {
        test.ok(false, "Should not have resolved");
        test.done();
    })['catch'](function (err) {
        test.ok(err.message.indexOf('tutorweb::error::') === 0, err.message);
        test.done();
    });
};
