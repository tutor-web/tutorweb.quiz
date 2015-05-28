/*jslint nomen: true, plusplus: true, browser:true, todo: true, unparam: true*/
/*global require, window */
var jQuery = require('jquery');
var Quiz = require('./quizlib.js');
var View = require('./view.js');
var Promise = require('es6-promise').Promise;
var AjaxApi = require('./ajaxapi.js');

function LoadView($) {
    "use strict";

    this.updateState = function (curState, message, encoding) {
        var jqAlert;
        // Add message to page if we need to
        if (message) {
            jqAlert = $('<div class="alert">').addClass(curState === 'error' ? ' alert-error' : 'alert-info');
            if (encoding === 'html') {
                jqAlert.html(message);
            } else {
                jqAlert.text(message);
            }
            this.jqQuiz.children('div.alert').remove();
            this.jqQuiz.prepend(jqAlert);
        }

        if (curState === 'ready') {
            $('#tw-proceed').addClass("ready");
        }
    };

    this.updateProgress = function (cur, max) {
        var jqBar = this.jqQuiz.find('#load-bar');

        if (max === 0) {
            jqBar.css({"width": '0%'});
        } else if (cur < max) {
            jqBar.css({"width": (cur / max) * 100 + '%'});
        } else {
            jqBar.css({"width": '100%'});
        }
    };
}
LoadView.prototype = new View(jQuery);

(function (window, $) {
    "use strict";
    var quiz, twView;

    /** Download a tutorial given by URL */
    function downloadTutorial(qs) {
        var count = 0;

        if (!qs.tutUri) {
            throw new Error("tutorweb::error::Missing tutorial URI!");
        }

        if (qs.clear) {
            // Empty localStorage first
            window.localStorage.clear();
        }

        twView.updateState("active", "Downloading lectures...");
        return quiz.syncTutorial(qs.tutUri, true).then(function () {
            // Housekeep, remove all useless questions
            twView.updateState("active", "Removing old questions...");
            quiz.removeUnusedObjects();
        }).then(function () {
            // Fetch all questions required for tutorial, show on progress bar
            twView.updateState("active", "Downloading questions...");
            return Promise.all(quiz.syncTutorialQuestions(qs.tutUri).map(function (p, i, arr) {
                return p.then(function () {
                    count += 1;
                    twView.updateProgress(count, arr.length);
                });
            }));
        }).then(function (qnPromises) {
            if (count < qnPromises.length) {
                throw new Error("Not all downloads finished");
            }
            twView.updateProgress(1, 1);
        });
    }

    // Do nothing if not on the right page
    if ($('body.quiz-load').length === 0) { return; }

    // Wire up view
    twView = new LoadView($);

    // Start state machine
    twView.stateMachine(function updateState(curState, fallback) {
        function promiseFatalError(err) {
            setTimeout(function () {
                throw err;
            }, 0);
            throw err;
        }

        switch (curState) {
        case 'initial':
            // Create Quiz model
            quiz = new Quiz(localStorage, new AjaxApi($.ajax));
            updateState.call(this, 'download-tutorial', fallback);
            break;

        case 'download-tutorial':
            downloadTutorial(twView.parseQS(window.location)).then(function () {
                twView.updateState("ready", "Press the button to start your quiz");
                twView.updateActions(['gohome', 'go-drill']);
            })['catch'](promiseFatalError);
            break;

        default:
            fallback(curState);
        }
    });

}(window, jQuery));
