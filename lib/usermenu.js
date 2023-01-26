/*jslint nomen: true, plusplus: true, browser:true, regexp: true, unparam: true, todo: true */
/*global module, navigator, Promise */
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
        curUserMenu = {},
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
                jqLink.attr('target', state.action.replace(/^popup:/, ''));
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
            renderMenu({
                text: "Loading...",
                action: null,
            });
        },
        'connect': function () {
            var curUrl = parse_qs(window.location);

            renderMenu({
                text: "Connecting...",
                action: null,
            });
            return quiz.updateUserDetails('//' + window.document.location.host + '/', null).then(function (user) {
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

                curUserMenu = menu;
                renderMenu(menu);
                return 'online';
            });
        },
        'online': function () {
            return Promise.resolve();
        },
        'uptodate': function (newState) {
            renderMenu({
                text: "Saving your work...",
                action: null,
            });

            // Do sync call
            return quiz.syncLecture(null, newState === 'sync-force').then(function (promises) {
                return promises ? Promise.all(promises) : true;
            }).then(function () {
                renderMenu(Object.assign({}, curUserMenu, {
                    tooltip: "All your answers have been saved"
                }));
            });
        },
        'sync-force': function () {
            // Same, but force the sync
            return this.transitions.uptodate('sync-force');
        },
        'app-reload': function () {
            renderMenu({
                text: 'Click to reload',
                action: 'twstate:reload',
            });
            return Promise.resolve();
        },
        'app-error': function () {
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

    if (window.actuallyenableserviceworker && navigator.serviceWorker) {
        navigator.serviceWorker.register('/++resource++tutorweb.quiz/serviceworker.js', {
            scope: '/',
        }).then(function (registration) {
            if (registration.installing) {
                // Installing a new serviceworker
                registration.installing.onstatechange = function (e) {
                    if (e.target.state === 'installed') {
                        // Might stop here if there's an old sw that needs replacing
                        this.updateState("app-reload");
                    } else if (e.target.state === 'activating') {
                        renderMenu({
                            text: 'Installing...',
                            action: null,
                        });
                    } else if (e.target.state === 'activated') {
                        this.updateState('connect');
                    }
                }.bind(this);
                renderMenu({
                    text: 'Installing...',
                    action: null,
                });
            } else if (registration.waiting) {
                // There's a new serviceworker waiting
                this.updateState("app-reload");
            } else if (registration.active) {
                // The serviceworker is already installed

                // Listen for any serviceworker updates, and display progress
                registration.addEventListener("updatefound", function (e) {
                    var new_registration = e.target;

                    if (new_registration.installing) {
                        new_registration.installing.onstatechange = function (e) {
                            if (e.target.state === 'activated') {
                                this.updateState("app-reload");
                            }
                        }.bind(this);

                        renderMenu({
                            text: 'Installing...',
                            action: null,
                        });
                    }
                }.bind(this));

                this.updateState('connect');
            }
        }.bind(this))['catch'](promiseFatalError);
    } else {
        // NB: Service workers are disabled in firefox private browsing
        console.warn('Service workers are not supported.');
        renderMenu({
            text: 'No offline mode',
            tooltip: "It is not possible to register Tutor-Web to work offline",
            action: null,
        });
        // NB: Wait a bit to see message, and let promise chain settle
        window.setTimeout(function () {
            this.updateState('connect');
        }.bind(this), 500);
    }

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
