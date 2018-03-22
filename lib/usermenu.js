/*jslint nomen: true, plusplus: true, browser:true, regexp: true, unparam: true, todo: true */
/*global module, Promise */
require('es6-promise').polyfill();
var parse_qs = require('../lib/parse_qs.js').parse_qs;

/**
  * User Menu widget (or at least will be)
  * 
  * States:
  * - Offline
  * - Online
  * - Not logged in
  * - Syncing with Plone
  * - Incoming student request
  * 
  * Menu items:
  * - Force sync
  * - Tutor registrations
  * - Change my details
  * - Logout
  */
module.exports = function UserMenu(jqUserMenu, quiz) {
    "use strict";
    var self = this,
        curUser = "",
        jqMenuLink = jqUserMenu.children('a'),
        jqMenuRoot = jqUserMenu.children('ul'),
        jqItemTemplate = jqMenuRoot.children('li').detach();

    function promiseFatalError(err) {
        setTimeout(function () {
            throw err;
        }, 0);
        throw err;
    }

    /** Fill the menu with selected items */
    function renderMenu(state) {
        function updateLink(jqLink, state) {
            var actionType;

            if (state.tooltip) {
                jqLink.attr('title', state.tooltip);
            } else {
                jqLink.removeAttr('title');
            }
            jqLink.text(state.text || '');

            // Decide what action this state takes
            if (!state.action) {
                actionType = 'none';
            } else if (typeof state.action === 'string') {
                actionType = state.action.slice(0, state.action.indexOf(':'));
                state.action = state.action.slice(state.action.indexOf(':') + 1);
            } else if (typeof state.action === 'object' && state.action.constructor === Array) {
                actionType = 'dropdown';
            }

            // Absolutely nothing
            if (actionType === 'none') {
                jqLink.removeAttr('href');
            }

            // State change for menu
            if (actionType === 'menustate') {
                jqLink.attr('data-menustate', state.action.replace(/^menustate:/, ''));
            } else {
                jqLink.removeAttr('data-menustate');
            }

            // State change for tutor-web
            if (actionType === 'twstate') {
                jqLink.attr('data-state', state.action.replace(/^twstate:/, ''));
            } else {
                jqLink.removeAttr('data-state');
            }

            // State change for tutor-web
            if (actionType === 'popup') {
                jqLink.attr('href', state.action.replace(/^popup:/, ''));
                jqLink.attr('target', state.action);
            }

            // Dropdown of sub-items
            if (actionType === 'dropdown') {
                jqLink.attr('data-toggle', 'dropdown');

                // NB: This won't recurse properly, but don't care yet
                jqMenuRoot.empty().append(state.action.map(function (itemState) {
                    var jqItem = jqItemTemplate.clone();
                    updateLink(jqItem.children('a'), itemState);
                    return jqItem;
                }));
            } else {
                jqLink.removeAttr('data-toggle');
                jqMenuRoot.empty();
            }
        }

        // Update main link
        updateLink(jqMenuLink, state);
    }

    // Dict of functions for how to get to that state, returning promises that optionally say which state to jump to next
    this.transitions = {
        'initial': function () {
            return Promise.resolve('appcache-check');
        },
        'connect': function () {
            var curUrl = parse_qs(window.location);

            renderMenu({
                text: "Connecting...",
                action: null,
            });
            return quiz.updateUserDetails(null).then(function (user) {
                var menu = {
                    text: user.username,
                    tooltip: "You are connected to tutor-web",
                    action: []
                };
                if (!document.location.pathname.match(/coin.html$/)) {
                    menu.action.push(
                        { text: "Redeem your smileycoins", action: "twstate:go-coin" }
                    );
                }

                if (curUrl.hasOwnProperty('lecUri')) {
                    menu.action.unshift(
                        { text: "Sync with server", action: "menustate:sync-force" },
                        { text: "Get some help on this lecture", action: "popup:chat.html#!lecUri=" + encodeURIComponent(curUrl.lecUri) }
                    );
                } else if (document.location.pathname.match(/start.html$/)) {
                    menu.action.unshift(
                        { text: "Sync all subscriptions", action: "twstate:subscription-sync-force" },
                        { text: "Become a tutor", action: "popup:chat.html" }
                    );
                    menu.action.push(
                        { text: "Get more tutorials", action: "twstate:go-twhome" },
                        { text: "Clear data and logout", action: "twstate:logout" }
                    );
                } else {
                    menu.action.push(
                        { text: "Back to main menu", action: "twstate:gohome" }
                    );
                }

                curUser = user.username;
                renderMenu(menu);
                return 'online';
            });
        },
        'online': function () {
            return Promise.resolve();
        },
        'uptodate': function () {
            var curUrl = parse_qs(window.location);

            renderMenu({
                text: "Saving your work...",
                action: null,
            });

            // Do sync call
            return quiz.syncLecture(null, false).then(function (promises) {
                return promises ? Promise.all(promises) : true;
            }).then(function () {
                renderMenu({
                    text: curUser,
                    tooltip: "All your answers have been saved",
                    action: [
                        { text: "Sync with server", action: "menustate:sync-force" },
                        { text: "Get some help on this lecture", action: "popup:chat.html#!lecUri=" + encodeURIComponent(curUrl.lecUri) },
                        { text: "Redeem your smileycoins", action: "twstate:go-coin" },
                    ],
                });
            });
        },
        'sync-force': function () {
            renderMenu({
                text: "Saving your work...",
                action: null,
            });

            // Do sync call
            return quiz.syncLecture(null, true).then(function (promises) {
                return promises ? Promise.all(promises) : true;
            }).then(function () {
                renderMenu({
                    text: curUser,
                    tooltip: "All your answers have been saved",
                    action: [
                        { text: "Sync with server", action: "menustate:sync-force" },
                    ],
                });
                return 'uptodate';
            });
        },
        'appcache-check': function () {
            var ac = window.applicationCache;
            if (!ac) {
                // No appcache available, move on
                return Promise.resolve('appcache-error');
            }

            if (ac.status === ac.CHECKING || ac.status === ac.DOWNLOADING) {
                renderMenu({
                    text: 'Loading...',
                    action: null,
                });
            } else {
                try {
                    ac.update();
                } catch (e) {
                    console.log("Failed to trigger appcache update(" + ac.status + "): " + e.message);
                    return Promise.resolve('appcache-error');
                }
            }
        },
        'appcache-reload': function () {
            renderMenu({
                text: 'Click to reload',
                action: 'twstate:reload',
            });
            return Promise.resolve();
        },
        'appcache-error': function () {
            renderMenu({
                text: 'Update failed!',
                tooltip: "Could not update tutor-web application",
                action: null,
            });
            window.setTimeout(self.updateState.bind(self, 'connect'), 1000);
        },
        'error-neterror': function () {
            renderMenu({
                text: 'Network error',
                tooltip: "Cannot connect to server. Scores won't be saved until we reconnect",
                action: [
                    { text: "Sync with server", action: "menustate:sync-force" },
                ],
            });
        },
        'error-unauth': function () {
            renderMenu({
                text: "Click to login",
                tooltip: "You need to log in to tutor-web again before your work can be saved",
                action: 'twstate:go-login',
            });
        },
        'default': function (newState) {
            throw "Unknown state " + newState;
        },
    };

    if (window.applicationCache) {
        window.applicationCache.addEventListener('checking', function () {
            renderMenu({
                text: 'Loading...',
                action: null,
            });
        }, false);
        window.applicationCache.addEventListener('noupdate', function () {
            self.updateState('connect');
        }, false);
        window.applicationCache.addEventListener('error', function (e) {
            self.updateState('appcache-error');
        }, false);
        window.applicationCache.addEventListener('obsolete', function () {
            self.updateState('connect');
        }, false);
        window.applicationCache.addEventListener('progress', function (e) {
            renderMenu({
                text: 'Loading (' + e.loaded + '/' + e.total + ')',
                action: null,
            });
        }, false);
        window.applicationCache.addEventListener('cached', function () {
            // First time, so no need to reload
            self.updateState('connect');
        }, false);
        window.applicationCache.addEventListener('updateready', function () {
            self.updateState('appcache-reload');
        }, false);
    }

    // State machine
    this.updateState = function (newState) {
        var p;

        function setState(s) {
            jqUserMenu.attr('class', 'dropdown ' + s);
        }

        // If already busy, return. Otherwise flag that we are.
        if (jqUserMenu.hasClass('processing')) {
            return;
        }
        setState('processing');

        // Call trasition / default transition
        p = (this.transitions[newState] || this.transitions.default).call(self, newState) || Promise.resolve();
        p['catch'](function (err) {
            // If the process failed, jump to an error state instead
            if (err.message.indexOf("tutorweb::neterror::") === 0) {
                return 'error-neterror';
            }
            if (err.message.indexOf("tutorweb::unauth::") === 0) {
                return 'error-unauth';
            }
            setState('error');
            throw err;
        }).then(function (nextState) {
            if (nextState) {
                // Going round again
                setState('next'); // NB: i.e. not "processing"
                self.updateState(nextState);
            } else {
                setState(newState);
            }
        })['catch'](promiseFatalError);
    };
    this.updateState('initial');

    window.addEventListener("beforeunload", function (e) {
        var unloadMessage = null;

        if (jqUserMenu.hasClass('processing')) {
            unloadMessage = 'We are still saving your work, please keep the page open until finished';
        }

        if (unloadMessage) {
            e.returnValue = unloadMessage;
            return e.returnValue;
        }
    });

    // Hitting something with a 'data-menustate' moves to next state
    jqMenuRoot.bind('click', function (event) {
        var newState = event.target.getAttribute('data-menustate');
        if (newState) {
            event.preventDefault();
            self.updateState(newState);
        }
    });

    /** Request a sync to the server */
    this.syncAttempt = function () {
        this.updateState('uptodate');
    };
};
