/*jslint nomen: true, plusplus: true, browser:true, regexp: true, unparam: true, todo: true */
/*global module */
var Promise = require('es6-promise').Promise;

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
                text: "Connecting...",
                action: null,
            });
            return Promise.resolve('online');
        },
        'online': function () {
            return quiz.updateUserDetails('//' + window.document.location.host + '/', null).then(function (user) {
                curUser = user.username;
                renderMenu({
                    text: curUser,
                    tooltip: "You are connected to tutor-web",
                    action: [
                        { text: "Sync with server", action: "menustate:sync-force" },
                    ],
                });
            });
        },
        'uptodate': function () {
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
        'error-offline': function () {
            renderMenu({
                text: 'Offline',
                tooltip: "You are disconnected from the server. Scores won't be saved until we reconnect",
                action: null,
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
            if (err.message.indexOf("tutorweb::offline::") === 0) {
                return 'error-offline';
            }
            if (err.message.indexOf("tutorweb::neterror::") === 0) {
                return 'error-offline';
            }
            if (err.message.indexOf("tutorweb::unauth::") === 0) {
                return 'error-unauth';
            }
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
