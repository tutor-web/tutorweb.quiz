/*jslint nomen: true, plusplus: true, browser:true, regexp: true, unparam: true, todo: true */
/*global module */

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
module.exports = function UserMenu(jqSync, portalRootUrl, quiz, window, $) {
    "use strict";
    var self = this;

    function promiseFatalError(err) {
        setTimeout(function () {
            throw err;
        }, 0);
        throw err;
    }

    /** Update sync button, curState one of 'processing', 'online', 'offline', 'unauth', '' */
    this.syncState = function (curState) {
        if (!curState) {
            // Want to know what the state is
            return jqSync[0].className === 'button active' ? 'processing'
                    : jqSync[0].className === 'button button-danger btn-unauth' ? 'unauth'
                    : jqSync[0].className === 'button button-success' ? 'online'
                         : 'unknown';
        }

        // Setting the state
        if (curState === 'processing') {
            jqSync[0].className = 'button active';
            jqSync.text("Syncing...");
        } else if (curState === 'online') {
            jqSync[0].className = 'button button-success';
            jqSync.text("Scores saved.");
        } else if (curState === 'offline') {
            jqSync[0].className = 'button button-info';
            jqSync.text("Currently offline. Sync once online");
        } else if (curState === 'unauth') {
            jqSync[0].className = 'button button-danger btn-unauth';
            jqSync.text("Click here to login, so your scores can be saved");
        } else if (curState === 'error') {
            jqSync[0].className = 'button button-danger';
            jqSync.text("Syncing failed!");
        } else {
            jqSync[0].className = 'button';
            jqSync.text("Sync answers");
        }
        return curState;
    };

    this.syncAttempt = function (force) {
        /** Call an array of Ajax calls, splicing in extra options, onProgress called on each success, onDone at end */
        function callAjax(calls, extra, onProgress, onDone) {
            var dfds = calls.map(function (a) {
                return $.ajax($.extend({}, a, extra));
            });
            if (dfds.length === 0) {
                onDone();
            } else {
                dfds.map(function (d) { d.done(onProgress); });
                $.when.apply(null, dfds).done(onDone);
            }
        }

        function onError(jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 401 || jqXHR.status === 403) {
                self.syncState('unauth');
            } else {
                self.syncState('error');
            }
        }

        if (self.syncState() === 'processing') {
            // Don't want to repeatedly sync
            return;
        }
        if (self.syncState() === 'unauth') {
            // Only show dialog if user has explcitly clicked button
            if (force) {
                window.open(
                    portalRootUrl('login?came_from=' +
                            encodeURIComponent(document.location.pathname.replace(/\/\w+\.html$/, '/close.html')) +
                            '&login_name=' + encodeURIComponent(quiz.getCurrentLecture().user || "")),
                    "loginwindow"
                );
                self.syncState('default');
            }
            return;
        }
        self.syncState('processing');
        if (!window.navigator.onLine) {
            self.syncState('offline');
            return;
        }

        // Do sync call
        quiz.syncLecture(null, force).then(function () {
            callAjax(quiz.syncQuestions(), {error: onError}, null, function () {
                self.syncState('online');
            });
        })['catch'](function (err) {
            if (err.message.indexOf('tutorweb::unauth::') === 0) {
                self.syncState('unauth');
            } else {
                self.syncState('error');
            }
        })['catch'](promiseFatalError);
    };

    // Wire click events to force-sync
    jqSync.bind('click', function (event) {
        event.preventDefault();
        self.syncAttempt(true);
    });

    // Set initial sync state
    self.syncState('default');
};
