/*jslint nomen: true, plusplus: true, browser:true, todo: true*/
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
        var count = 0,
            ajaxApi = new AjaxApi($.ajax);

        function promiseFatalError(err) {
            setTimeout(function () {
                throw err;
            }, 0);
            throw err;
        }

        if (!qs.tutUri) {
            throw new Error("tutorweb::error::Missing tutorial URI!");
        }

        if (qs.clear) {
            // Empty localStorage first
            window.localStorage.clear();
        }

        twView.updateState("active", "Downloading lectures...");
        return ajaxApi.getJson(qs.tutUri).then(function (data) {
            quiz.insertTutorial(data.uri, data.title, data.lectures);

            // Housekeep, remove all useless questions
            twView.updateState("active", "Removing old questions...");
            quiz.removeUnusedObjects();
            return data;
        }).then(function (data) {
            function noop() { return; }

            // Get all the calls required to have a full set of questions
            twView.updateState("active", "Downloading questions...");
            return data.lectures.map(function (l) {
                // Get list of URLs to fetch
                quiz.setCurrentLecture({ "tutUri": qs.tutUri, "lecUri": l.uri }, noop);  //TODO: Erg
                return quiz.syncQuestions();
            }).reduce(function (prev, next) {
                // Squash array-of-arrays
                return prev.concat(next);
            });
        }).then(function (ajaxCalls) {
            // Start call for each
            return Promise.all(ajaxCalls.map(function (c) {
                return ajaxApi.ajax(c).then(function () {
                    count += 1;
                    twView.updateProgress(count, ajaxCalls.length);
                });
            }));
        }).then(function (ajaxCalls) {
            if (count < ajaxCalls.length) {
                throw new Error("Not all downloads finished");
            }
            twView.updateProgress(1, 1);
            twView.updateState("ready", "Press the button to start your quiz");
            twView.updateActions(['gohome', 'go-drill']);
        })['catch'](promiseFatalError);
    }

    // Do nothing if not on the right page
    if ($('body.quiz-load').length === 0) { return; }

    // Wire up view
    twView = new LoadView($);

    // Start state machine
    twView.stateMachine(function updateState(curState, fallback) {
        switch (curState) {
        case 'initial':
            // Create Quiz model
            twView.configureWindow(window);
            quiz = new Quiz(localStorage, new AjaxApi($.ajax));
            updateState.call(this, 'download-tutorial', fallback);
            break;
        case 'download-tutorial':
            downloadTutorial(quiz.parseQS(window.location));
            break;
        default:
            fallback(curState);
        }
    });

}(window, jQuery));
