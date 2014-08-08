/* global module, MathJax, window */
/**
  * View class for all pages
  */
module.exports = function View($) {
    "use strict";
    this.jqQuiz = $('#tw-quiz');
    this.jqActions = $('#tw-actions');
    this.locale = {
        "reload": "Restart",
        "gohome": "Back to main menu",
        "go-drill": "Take a drill",
        "quiz-practice": "Practice question",
        "quiz-real": "New question",
        "mark-practice": "Submit answer >>>",
        "mark-real": "Submit answer >>>",
        "cs-skip": "Skip question writing",
        "cs-submit": "Submit your question",
        "" : ""
    };

    /** Regenerate button collection to contain given buttons */
    this.updateActions = function (actions) {
        var self = this;

        self.jqActions.empty().append(actions.map(function (a, i) {
            return $('<button/>')
                .attr('data-state', a)
                .attr('class', 'button button-sm')
                .text(self.locale[a] || a);
        }));
    };

    /** Tell MathJax to render anything on the page */
    this.renderMath = function (onSuccess) {
        var jqQuiz = this.jqQuiz;
        jqQuiz.addClass("busy");
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, this.jqQuiz[0]]);
        MathJax.Hub.Queue(function () {
            jqQuiz.removeClass("busy");
        });
        if (onSuccess) {
            MathJax.Hub.Queue(onSuccess);
        }
    };

    /** Add a message to the page */
    this.showAlert = function (state, message, encoding) {
        var jqQuiz = this.jqQuiz,
            jqAlert = $('<div class="alert">').addClass(state === 'error' ? ' alert-error' : 'alert-info');

        if (encoding === 'html') {
            jqAlert.html(message);
        } else {
            jqAlert.text(message);
        }
        jqQuiz.children('div.alert').remove();
        jqQuiz.prepend(jqAlert);
    };

    /** Return an error handler to attach to window.onerror */
    this.errorHandler = function () {
        var self = this;
        return function (message, url, linenumber) {
            self.jqQuiz.removeClass('busy');
            if (message.toLowerCase().indexOf('quota') > -1) {
                self.showAlert("error", 'No more local storage available. Please <a href="start.html">return to the menu</a> and delete some tutorials you are no longer using.', 'html');
            } else if (message.indexOf('tutorweb::') !== -1) {
                self.showAlert.apply(self, message.split(/\:\:/).splice(1));
            } else {
                self.showAlert("error", "Internal error: " + message + " (" + url + ":" + linenumber + ")");
            }
            // The only action now should be to reload the page
            $('.tw-action').remove();
            self.updateActions(['gohome', 'reload']);
        };
    };

    /** Initalise and start a state machine to control the page */
    this.stateMachine = function (updateState) {
        var self = this;
        // State machine to use when nothing else works
        function fallback(curState) {
            switch (curState) {
            case 'processing':
                break;
            case 'request-reload':
                self.updateActions(['reload']);
                break;
            case 'reload':
                window.location.reload(false);
                break;
            case 'gohome':
                window.location.href = 'start.html';
                break;
            case 'go-drill':
                window.location.href = 'quiz.html' + window.location.search;
                break;
            default:
                throw "tutorweb::error::Unknown state '" + curState + "'";
            }
        }

        // Hitting the button moves on to the next state in the state machine
        $('#tw-actions, .tw-action').bind('click', function (event) {
            var newState = event.target.getAttribute('data-state');
            if (!newState) {
                return;
            }

            event.preventDefault();
            updateState.call(self, newState, fallback);
        });
        updateState.call(self, "initial", fallback);
    };
};
