/*jslint nomen: true, plusplus: true, browser:true, todo:true, unparam: true */
/*global module, require, window, Promise, URL, Set */
require('es6-promise').polyfill();
var LZString = require('lz-string');

/**
  * Wrap already-compressed text as the cache entry getCachedJson expects.
  * The content-type is what tells the read side it has to decompress.
  */
function compressedResponse(text) {
    "use strict";
    return new window.Response(text, {
        status: 200,
        statusText: 'OK',
        headers: {
            'Content-Type': 'application/binary; charset=utf-16',
            'Content-Length': text.length,
        },
    });
}

/**
  * Promise-based AJAX API wrapping jQuery
  * Based on: https://gist.github.com/tobiashm/0a987db2f9ec8e5cdbb3
  */
module.exports = function AjaxApi(jqAjax) {
    "use strict";
    var self = this,
        urlBase = (window.twConfig || {}).portalRoot || window.location;

    /**
      * Return the Plone root with extra appended. Based on document
      * location, unless overridden - see AjaxApi's portalRoot.
      */
    this.ploneUrl = function (extra) {
        return (new URL(extra, urlBase)).toString();
    };

    /**
      * Redirect user back to a plone page (or open browser window if within app)
      */
    this.ploneRedirect = function (plonePath) {
        var url = this.ploneUrl(plonePath);
        if (window.cordova && window.cordova.InAppBrowser) {
            window.cordova.InAppBrowser.open(url, '_system');
            return;
        }
        window.location.href = url;
    };

    /** Fetch any URL, expect HTML back */
    this.getHtml = function (url, extras) {
        return this.ajax({
            type: 'GET',
            datatype: 'html',
            url: url
        }, extras);
    };

    /** Fetch any URL, expect JSON back */
    this.getJson = function (url, extras) {
        return this.ajax({
            type: 'GET',
            url: url
        }, extras).then(function (data) {
            if (typeof data !== 'object') {
                throw new Error('tutorweb::error::Got a ' + typeof data + ', not object whilst fetching ' + url);
            }
            return data;
        });
    };

    /**
      * The uuid of whoever is answering, or null until registration has
      * given us one. Sent as X-Student-Uuid on every request that has one.
      *
      * It lives here rather than in quizlib because this is what talks to the
      * server, and alongside the token because it is the same kind of thing -
      * though it is an identifier and not a credential: it goes over the wire
      * in clear, so anything that has seen a request can claim it. See
      * ANSWERCHAIN.rst 4.1, and the answer chains it roots.
      *
      * NB: Stored raw rather than through JSONLocalStorage, as the token is.
      * quizlib's removeUnusedObjects() knows to keep it.
      */
    this.studentUuid = function () {
        return window.localStorage.getItem('_student_uuid');
    };

    /** Get/set/clear the JWT used to authenticate against the (cross-domain) Plone backend */
    this.getToken = function () {
        return window.localStorage.getItem('tw-jwt-token');
    };
    this.setToken = function (token) {
        window.localStorage.setItem('tw-jwt-token', token);
    };
    this.clearToken = function () {
        window.localStorage.removeItem('tw-jwt-token');
    };

    /** Log in, storing the JWT returned by the server for use on subsequent requests */
    this.login = function (login, password) {
        return self.postJson('/@@jwt-login', {login: login, password: password}).then(function (data) {
            self.setToken(data.token);
        });
    };

    /**
      * Log out: ask the server to revoke this device's token (so it's no
      * good to anyone who's since copied it off this device) before
      * forgetting it locally. Best-effort - if the server call fails
      * (offline, token already expired, ...) we still forget it locally,
      * since there's nothing more we can do about a token we can't reach
      * the server to revoke, and there's no reason to strand the user
      * still "logged in" on this device because of it.
      */
    this.logout = function () {
        if (!self.getToken()) {
            return Promise.resolve();
        }
        return self.postJson('/@@jwt-logout', {})['catch'](function () {
            return null;
        }).then(function () {
            self.clearToken();
        });
    };

    /** Post data, encoded as JSON, to url */
    this.postJson = function (url, data, extras) {
        return this.ajax({
            data: JSON.stringify(data),
            contentType: 'application/json',
            type: 'POST',
            url: url
        }, extras).then(function (data) {
            if (typeof data !== 'object') {
                throw new Error('tutorweb::error::Got a ' + typeof data + ', not object whilst fetching ' + url);
            }
            return data;
        });
    };

    /**
      * Regiser existing user with backend
      *
      * This only makes sense for the app, the request gives us an identity
      * and settings to use. Plone users are already logged in by this point.
      */
    this.registerStudent = function (data, extras) {
        var registerUri = (window.twConfig || {}).syncUri ? "register" : null;

        if (registerUri) {
            return self.postJson(registerUri, data, extras).then(function (reg) {
                if (reg && reg.uuid) {
                    window.localStorage.setItem('_student_uuid', reg.uuid);
                }
                return reg;
            });
        }

        return Promise.resolve(null);
    };

    /**
      * Fetch the subscription table
      *
      * An app build has one bundled, named by twConfig.seedSubscriptions.
      * Fetching a file needs neither network nor login, which is what lets a
      * first run offer the tutorials it shipped with.
      *
      * Otherwise it's Plone's @@quizdb-subscriptions, which takes the
      * add_lec / del_lec it's given and answers with this student's table.
      */
    this.syncSubscriptions = function (postData, extras) {
        var seedUri = (window.twConfig || {}).seedSubscriptions;

        if (seedUri) {
            return self.getJson(seedUri, extras);
        }

        return self.postJson('/@@quizdb-subscriptions', postData, extras);
    };

    /**
      * Sync lecture, returning what the other end says about it
      *
      * Lecture goes to twConfig.syncUri where set (i.e. in app context), or
      * defaults to the lecture URI (Plone t-w behaviour). A lecture we don't
      * hold yet is the exception: an app build has the content of one, so
      * there is nothing to ask a server for.
      */
    this.syncLecture = function (lecture, extras) {
        var syncUri = (window.twConfig || {}).syncUri;

        if (syncUri) {
            if (!lecture.questions) {
                // A lecture we don't hold yet, and an app build has the
                // content of one in the bundle, at the URI the dump gave it.
                // A GET needs neither network nor login, and there is
                // nothing to send: a lecture we have never seen has no
                // answers in it.
                return self.getJson(lecture.uri, extras);
            }

            // Sending to a new-syle app-backend
            // The app backend only cares about the answerQueue, don't spam it with anything else
            return self.postJson(syncUri, {
                uri: lecture.uri,
                answerQueue: lecture.answerQueue
            }, extras);
        }

        // The Plone backend takes a lecture at its own URI
        return self.postJson(lecture.uri, lecture, extras);
    };

    /** Fetch URL, storing in cache if available */
    this.getCachedJson = function (url, opts) {
        var ac, token = self.getToken(), uuid = self.studentUuid(), fetch_opts = {};

        url = self.ploneUrl(url);

        if (!window.caches) {
            return this.getJson(url, opts);
        }

        if (token) {
            fetch_opts.headers = {Authorization: 'Bearer ' + token};
        }
        if (uuid) {
            fetch_opts.headers = fetch_opts.headers || {};
            fetch_opts.headers['X-Student-Uuid'] = uuid;
        }

        return window.caches.open('ajaxapi-v1').then(function (cache) {
            return cache.match(url).then(function (response) {
                if (response) {
                    // Already in cache, return that
                    return response.text().then(function (text) {
                        return JSON.parse(LZString.decompressFromUTF16(text));
                    });
                }

                if (opts.timeout > 0 && window.AbortController) {
                    ac = new window.AbortController();
                    setTimeout(ac.abort.bind(ac), opts.timeout);
                    fetch_opts.signal = ac.signal;
                }

                return window.fetch(url, fetch_opts).then(function (response) {
                    if (!response.ok) {
                        throw new Error("tutorweb::error::Server error whilst fetching " + url);
                    }
                    return response.clone().text().then(function (text) {
                        // NB: We're compressing it to obscure the contents, rather than it being a useful operation
                        if (response.headers.get('Content-Type') !== "application/binary; charset=utf-16") {
                            text = LZString.compressToUTF16(text);
                        }
                        return cache.put(url, compressedResponse(text));
                    }).catch(function (err) {
                        console.warn("Failed to cache " + url + ": " + err.name + " " + err.message + " - scrubbing cache");
                        // This is probably a QuotaExceededError. Scrub the cache, in theory it'll come back next time round.
                        return window.caches.delete('ajaxapi-v1');
                    }).then(function () {
                        if (response.headers.get('Content-Type') !== "application/binary; charset=utf-16") {
                            return response.json();
                        }
                        return response.text().then(function (x) {
                            return JSON.parse(LZString.decompressFromUTF16(x));
                        });
                    });
                });
            });
        });
    };

    /**
      * Pre-seed the cache for url with data, so a subsequent getCachedJson
      * resolves to it without ever hitting the network. Used to side-load
      * question data we already have (test fixtures, pre-baked tutorials).
      *
      * Rejects if there's no Cache Storage to put it in, rather than
      * resolving and leaving the caller to fail later on a fetch we know
      * can't succeed.
      */
    this.injectCache = function (url, data) {
        if (!window.caches) {
            return Promise.reject(new Error(
                "tutorweb::error::No cache available to inject " + url + " into"
            ));
        }

        url = self.ploneUrl(url);

        return window.caches.open('ajaxapi-v1').then(function (cache) {
            return cache.put(url, compressedResponse(
                LZString.compressToUTF16(JSON.stringify(data))
            ));
        });
    };

    /** Return URI of all currently cached URIs */
    this.listCached = function () {
        if (!window.caches) {
            return Promise.resolve([]);
        }

        return window.caches.open('ajaxapi-v1').then(function (cache) {
            return cache.keys().then(function (keys) {
                return new Set(keys.map(function (request) {
                    return request.url;
                }));
            });
        });
    };

    /** Remove entire cache */
    this.clearCache = function () {
        if (window.caches) {
            return window.caches.delete('ajaxapi-v1');
        }
    };

    /** Remove anything from the cache not in the set */
    this.removeUnusedCache = function (expected_uris) {
        if (!window.caches) {
            return Promise.resolve([]);
        }

        return window.caches.open('ajaxapi-v1').then(function (cache) {
            return cache.keys().then(function (keys) {
                keys.forEach(function (request) {
                    if (!expected_uris.has(request.url)) {
                        cache.delete(request);
                    }
                });
            });
        });
    };

    /** Call $.ajax with combined arguments, return promise-wrapped output */
    this.ajax = function (ajax_opts, extra_opts) {
        var token = self.getToken(),
            uuid = self.studentUuid(),
            args = {
                timeout: 5000,
            };
        Object.keys(ajax_opts || {}).map(function (k) { args[k] = ajax_opts[k]; });
        Object.keys(extra_opts || {}).map(function (k) { args[k] = extra_opts[k]; });
        args.url = self.ploneUrl(args.url);
        if (token) {
            args.headers = args.headers || {};
            args.headers.Authorization = 'Bearer ' + token;
        }
        if (uuid) {
            args.headers = args.headers || {};
            args.headers['X-Student-Uuid'] = uuid;
        }

        return new Promise(function (resolve, reject) {
            if (window.navigator && !window.navigator.onLine) {
                reject(new Error("tutorweb::neterror::Currently offline"));
            }

            jqAjax(args).then(function (data, unused, request) {
                if (request.getResponseHeader('Content-Type') === 'application/binary; charset=utf-16') {
                    resolve(JSON.parse(LZString.decompressFromUTF16(data)));
                }
                resolve(data);
            }).fail(function (jqXHR, textStatus, errorThrown) {
                if (jqXHR.responseJSON && jqXHR.responseJSON.error) {
                    // Response was JSON, so use what's inside
                    errorThrown = jqXHR.responseJSON.error;
                    textStatus = jqXHR.responseJSON.message;
                }

                if (errorThrown === 'Redirect') {
                    // Redirect error
                    reject(new Error('tutorweb::updatedetails::You have not accepted the terms and conditions.'));
                }

                if (jqXHR.status === 401 || jqXHR.status === 403) {
                    // Unauth / wrong user
                    reject(new Error("tutorweb::unauth::" + textStatus + ". Please " +
                                     '<a href="#" data-state="go-login">click here to log-in</a> before continuing.::html'));
                }

                if (textStatus === 'timeout') {
                    reject(new Error("tutorweb::neterror::Timeout whilst fetching " + args.url));
                }

                if (!errorThrown && jqXHR.status === 0 && textStatus === 'error') {
                    // Network error / request cancelled
                    reject(new Error("tutorweb::neterror::Failed to fetch " + args.url));
                }

                reject(new Error("tutorweb::error::" + errorThrown + " whilst fetching " + args.url + ": " + textStatus));
            });
        });
    };
};
