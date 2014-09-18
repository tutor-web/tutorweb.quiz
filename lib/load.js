/*jslint nomen: true, plusplus: true, browser:true*/
/* global require, jQuery, window */
var Quiz = require('./quizlib.js');
var Promise = require('es6-promise').Promise;
var AjaxApi = require('./ajaxapi.js');

(function (window, $) {
    "use strict";
    var quiz, qs, updateState,
        jqQuiz = $('#tw-quiz'),
        jqBar = $('#load-bar');
    // Do nothing if not on the right page
    if ($('body.quiz-load').length === 0) { return; }

    updateState = function (curState, message, encoding) {
        var jqAlert;
        // Add message to page if we need to
        if (message) {
            jqAlert = $('<div class="alert">').addClass(curState === 'error' ? ' alert-error' : 'alert-info');
            if (encoding === 'html') {
                jqAlert.html(message);
            } else {
                jqAlert.text(message);
            }
            jqQuiz.children('div.alert').remove();
            jqQuiz.prepend(jqAlert);
        }

        if (curState === 'ready') {
            $('#tw-proceed').addClass("ready");
        }
    };

    function updateProgress(cur, max) {
        if (max === 0) {
            jqBar.css({"width": '0%'});
        } else if (cur < max) {
            jqBar.css({"width": (cur / max) * 100 + '%'});
        } else {
            jqBar.css({"width": '100%'});
        }
    }

    // Catch any uncaught exceptions
    window.onerror = function (message, url, linenumber) {
        if (message.toLowerCase().indexOf('quota') > -1) {
            updateState("error", 'No more local storage available. Please <a href="start.html">return to the menu</a> and delete some tutorials you are no longer using.', 'html');
        } else {
            updateState("error", "Internal error: " +
                             message +
                             " (" + url + ":" + linenumber + ")");
        }
    };

    /** Download a tutorial given by URL */
    function downloadTutorial(url) {
        var count = 0,
            ajaxApi = new AjaxApi($.ajax);

        function promiseFatalError(err) {
            setTimeout(function() {
                throw err;
            }, 0);
            throw err;
        }

        updateState("active", "Downloading lectures...");
        ajaxApi.getJson(url).then(function (data) {
            quiz.insertTutorial(data.uri, data.title, data.lectures);

            // Housekeep, remove all useless questions
            updateState("active", "Removing old questions...");
            quiz.removeUnusedObjects();
            return data;
        }).then(function (data) {
            function noop() { }

            // Get all the calls required to have a full set of questions
            updateState("active", "Downloading questions...");
            return data.lectures.map(function (l) {
                // Get list of URLs to fetch
                quiz.setCurrentLecture({ "tutUri": url, "lecUri": l.uri }, noop);  //TODO: Erg
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
                    updateProgress(count, ajaxCalls.length);
                });
            }));
        }).then(function (ajaxCalls) {
            if (count < ajaxCalls.length) {
                throw new Error("Not all downloads finished");
            }
            updateProgress(1, 1);
            updateState("ready", "Press the button to start your quiz");
        })['catch'](promiseFatalError);
    }

    // Wire up quiz object
    quiz = new Quiz(localStorage);

    qs = quiz.parseQS(window.location);
    if (!qs.tutUri) {
        throw new Error("tutorweb::error::Missing tutorial URI!");
    }
    if (qs.clear) {
        // Empty localStorage first
        window.localStorage.clear();
    }
    $('#tw-proceed').attr('href', quiz.quizUrl(qs.tutUri, qs.lecUri));
    downloadTutorial(qs.tutUri);
}(window, jQuery));
