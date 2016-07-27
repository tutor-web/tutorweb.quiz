/*jslint nomen: true, plusplus: true, browser:true, todo: true, unparam: true*/
/*global require, window, Promise */
var jQuery = require('jquery');
var Quiz = require('./quizlib.js');
var View = require('./view.js');
require('es6-promise').polyfill();
var AjaxApi = require('./ajaxapi.js');

function LoadView($) {
    "use strict";

    // Generate a jQueried DOM element
    function el(name) {
        return $(document.createElement(name));
    }

    this.renderProgress = function (cur, max) {
        var jqBar = this.jqQuiz.find('#load-bar');

        if (jqBar.length === 0) {
            this.jqQuiz.empty().html('<div class="progress"><div class="bar" id="load-bar"></div></div>');
            jqBar = this.jqQuiz.find('#load-bar');
        }

        if (max === 0) {
            jqBar.css({"width": '0%'});
        } else if (cur < max) {
            jqBar.css({"width": (cur / max) * 100 + '%'});
        } else {
            jqBar.css({"width": '100%'});
        }
    };

    this.renderUserDetailsForm = function (data) {
        this.jqQuiz.empty().append([
            el('h3').text('Update your details'),
            el('label').text('Your username / official email address:'),
            el('input').attr('type', 'text').attr('name', 'username').attr('value', data.username).attr('readonly', true),
            el('label').text('Your full name:'),
            el('input').attr('type', 'text').attr('name', 'fullname').attr('value', data.fullname),
            el('label').text('Your preferred email address:'),
            el('input').attr('type', 'email').attr('name', 'email').attr('value', data.email),
            el('p').text("Note that by continuing, you agree to your"
                       + " grades being recorded into a database, these"
                       + " can be viewed by instructors in the"
                       + " appropriate courses and the grades can be"
                       + " used anonymously for research purposes."),
            el('input').attr('type', 'hidden').attr('name', 'accept').attr('value', true),
            null
        ]);
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

        twView.showAlert("info", "Downloading lectures...");
        return quiz.syncTutorial(qs.tutUri, true).then(function () {
            // Housekeep, remove all useless questions
            twView.showAlert("info", "Removing old questions...");
            quiz.removeUnusedObjects();
        }).then(function () {
            // Fetch all questions required for tutorial, show on progress bar
            twView.showAlert("info", "Downloading questions...");
            return Promise.all(quiz.syncTutorialQuestions(qs.tutUri).map(function (p, i, arr) {
                return p.then(function () {
                    count += 1;
                    twView.renderProgress(count, arr.length);
                });
            }));
        }).then(function (qnPromises) {
            if (count < qnPromises.length) {
                throw new Error("Not all downloads finished");
            }
            twView.renderProgress(1, 1);
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
            twView.renderProgress(0, 0);
            downloadTutorial(twView.curUrl).then(function () {
                twView.showAlert("info", "Press the button to start your quiz");
                twView.updateActions(['gohome', 'go-drill']);
            })['catch'](promiseFatalError);
            break;

        case 'error-updatedetails':
            twView.updateActions([]);
            quiz.updateUserDetails(twView.portalRootUrl(), null).then(function (data) {
                twView.renderUserDetailsForm(data);
                twView.updateActions(['go-twhome', 'userdetails-save']);
            })['catch'](promiseFatalError);
            break;

        case 'userdetails-save':
            twView.updateActions([]);
            quiz.updateUserDetails(twView.portalRootUrl(), $('form#tw-quiz').serializeArray()).then(function () {
                updateState.call(twView, "initial", fallback);
            })['catch'](function (e) {
                twView.showAlert("error", e.message);
                twView.updateActions(['go-twhome', 'userdetails-save']);
            })['catch'](promiseFatalError);
            break;

        default:
            fallback(curState);
        }
    });

}(window, jQuery));