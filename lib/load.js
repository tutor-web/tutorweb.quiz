/*jslint nomen: true, plusplus: true, browser:true*/
/*global jQuery*/
var Quiz = require('./quizlib.js');

(function (window, $) {
    "use strict";
    var quiz, qs, handleError, updateState,
        jqQuiz = $('#tw-quiz'),
        jqBar = $('#load-bar');
    // Do nothing if not on the right page
    if ($('body.quiz-load').length === 0) { return; }

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

    updateState = function (curState, message, encoding) {
        var self = this, jqAlert;
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

    handleError = function (message, textStatus, errorThrown) {
        if (arguments.length === 3 && arguments[0].responseJSON &&
                                      arguments[0].responseJSON.error == 'Redirect') {
            // Redirect error
            updateState('error', 'You have not accepted the terms and conditions. Please ' +
                                 '<a href="'+arguments[0].responseJSON.location+'" target="_blank">Click here and click the accept button</a>. ' +
                                 'Reload this page when finished', 'html');
        } else if (arguments.length === 3) {
            // var jqXHR = message
            updateState('error', errorThrown + " (whilst requesting " + this.url + ")");
        } else {
            // Just a string
            updateState('error', message);
        }
    };

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

    // Wire up quiz object
    quiz = new Quiz(localStorage);

    /** Download a tutorial given by URL */
    function downloadTutorial(url) {
        $.ajax({
            type: "GET",
            cache: false,
            url: url,
            error: handleError,
            success: function (data) {
                var i, ajaxCalls, count = 0;
                function noop() { }

                if (!quiz.insertTutorial(data.uri, data.title, data.lectures)) {
                    // Write failed, give up
                    return;
                }

                // Housekeep, remove all useless questions
                updateState("active", "Removing old questions...");
                quiz.removeUnusedObjects();

                // Get all the calls required to have a full set of questions
                updateState("active", "Downloading questions...");
                ajaxCalls = [];
                for (i = 0; i < data.lectures.length; i++) {
                    quiz.setCurrentLecture({ "tutUri": url, "lecUri": data.lectures[i].uri }, noop);  //TODO: Erg
                    //NB: Merge quiz.syncQuestions()'s array with ajaxCalls
                    Array.prototype.push.apply(ajaxCalls, quiz.syncQuestions());
                }

                // Do the calls, updating our progress bar
                callAjax(ajaxCalls, {error: handleError}, function () {
                    //TODO: Are we genuinely capturing full localStorage?
                    count += 1;
                    updateProgress(count, ajaxCalls.length);
                }, function () {
                    if (count < ajaxCalls.length) { return; }
                    updateProgress(1, 1);
                    updateState("ready", "Press the button to start your quiz");
                });
            },
        });
        updateState("active", "Downloading lectures...");
    }

    qs = quiz.parseQS(window.location);
    if (!qs.tutUri || !qs.lecUri) {
        handleError("Missing tutorial or lecture URI!");
        return;
    }
    if (qs.clear) {
        // Empty localStorage first
        window.localStorage.clear();
    }
    $('#tw-proceed').attr('href', quiz.quizUrl(qs.tutUri, qs.lecUri));
    downloadTutorial(qs.tutUri);
}(window, jQuery));
