/*jslint nomen: true, plusplus: true, browser:true, todo:true, unparam: true */
/*global module, require, window, Promise, URL, Set */
require('es6-promise').polyfill();
var LZString = require('lz-string');

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

    /** Fetch URL, storing in cache if available */
    this.getCachedJson = function (url, opts) {
        var ac, token = self.getToken(), fetch_opts = {};

        url = self.ploneUrl(url);

        if (!window.caches) {
            return this.getJson(url, opts);
        }

        if (token) {
            fetch_opts.headers = {Authorization: 'Bearer ' + token};
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
                        return cache.put(url, new window.Response(text, {
                            status: 200,
                            statusText: 'OK',
                            headers: {
                                'Content-Type': 'application/binary; charset=utf-16',
                                'Content-Length': text.length,
                            },
                        }));
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
