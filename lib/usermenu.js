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
    var jqMenuLink = jqUserMenu.children('a'),
        jqMenuRoot = jqUserMenu.children('ul'),
        jqItemTemplate = jqMenuRoot.children('li').detach();

    function promiseFatalError(err) {
        setTimeout(function () {
            throw err;
        }, 0);
        throw err;
    }

    /** Fill the menu with selected items */
    function renderMenu(state, items) {
        if (state.tooltip !== undefined) {
            jqMenuLink.attr('title', state.tooltip);
        }
        if (state.text !== undefined) {
            jqMenuLink.text(state.text);
        }

        jqMenuRoot.empty().append(items.map(function (item) {
            var jqItem = jqItemTemplate.clone();
            if (item.text) {
                jqItem.text(item.text);
            }
            if (item.tooltip) {
                jqItem.attr('title', item.tooltip);
            }
            return jqItem;
        }));
    }

    // Dict of functions for how to get to that state, returning promises that optionally say which state to jump to next
    this.transitions = {
        'initial': function () {
            renderMenu({text: "Connecting..."}, []);
            return Promise.resolve('online');
        },
        'online': function () {
            return quiz.updateUserDetails('//' + window.document.location.host + '/', null).then(function (user) {
                renderMenu({
                    text: user.username,
                    tooltip: "You are connected to tutor-web"
                }, [
                ]);
            });
        },
        'uptodate': function () {
            renderMenu({tooltip: "Saving your work..."}, [
            ]);

            // Do sync call
            //TODO: What happened to force?
            return quiz.syncLecture(null, false).then(function (promises) {
                return Promise.all(promises);
            }).then(function () {
                renderMenu({
                    tooltip: "All your answers have been saved"
                }, [
                ]);
            });
        },
        'error-offline': function () {
            renderMenu({
                text: quiz.getExpectedStudent() || 'off-line',
                tooltip: "You are disconnected from the server. Scores won't be saved until we reconnect"
            }, [
            ]);
        },
        'error-unauth': function () {
            //TODO: Alternative for quiz.getCurrentLecture().user
            renderMenu({
                text: "Login again!",
                tooltip: "You need to log in to tutor-web again before your work can be saved",
                href: '//' + window.document.location.host + '/login'
                    + '?came_from=' + encodeURIComponent(document.location.pathname)
                    + '&login_name=' + encodeURIComponent(quiz.getCurrentLecture().user || ""),
            }, []);
        },
        'default': function (newState) {
            throw "Unknown state " + newState;
        },
    };

    // State machine
    this.updateState = function (newState) {
        var self = this, p;

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

    /** Request a sync to the server */
    this.syncAttempt = function () {
        this.updateState('uptodate');
    };
};