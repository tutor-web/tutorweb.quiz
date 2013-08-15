/*jslint nomen: true, plusplus: true, browser:true*/
/*global jQuery, Quiz, MathJax*/

/**
  * View class to translate data into DOM structures
  *    $: jQuery
  *    jqQuiz: jQuery-wrapped <form id="tw-quiz">
  *    jqProceed: jQuery wrapped proceed button
  */
function QuizView($, jqQuiz, jqProceed) {
    "use strict";
    this.jqQuiz = jqQuiz;
    this.twProceed = jqProceed;

    /** Switch quiz state, optionally showing message */
    this.updateState = function (curState, message) {
        var alertClass, self = this;
        $(document).data('tw-state', curState);

        // Add message to page if we need to
        if (message) {
            alertClass = (curState === 'error' ? ' alert-error' : '');
            $('<div class="alert' + alertClass + '">' + message + '</div>').insertBefore(self.jqQuiz);
        }

        // Set button to match state
        self.twProceed.removeAttr("disabled");
        if (curState === 'nextqn') {
            self.twProceed.html("New question >>>");
        } else if (curState === 'interrogate') {
            self.twProceed.html("Submit answer >>>");
        } else if (curState === 'processing') {
            self.twProceed.attr("disabled", true);
        } else {
            self.twProceed.html("Restart quiz >>>");
        }
    };

    /** Update sync button, curState one of 'processing', 'online', 'offline', 'unauth', '' */
    this.syncState = function (curState) {
        var jqSync = $('#tw-sync');

        if (!curState) {
            // Want to know what the state is
            return jqSync[0].className === 'btn active' ? 'processing'
                    : jqSync[0].className === 'btn btn-success' ? 'online'
                    : 'unknown';
        }

        // Setting the state
        if (curState === 'processing') {
            jqSync[0].className = 'btn active';
            jqSync.text("Syncing...");
        } else if (curState === 'online') {
            jqSync[0].className = 'btn btn-success';
            jqSync.text("Scores saved.");
        } else if (curState === 'offline') {
            jqSync[0].className = 'btn btn-info';
            jqSync.text("Currently offline. Sync once online");
        } else if (curState === 'unauth') {
            jqSync[0].className = 'btn btn-danger';
            jqSync.text("Click here to login, so your scores can be saved");
        } else if (curState === 'error') {
            jqSync[0].className = 'btn btn-danger';
            jqSync.text("Syncing failed!");
        } else {
            jqSync[0].className = 'btn';
            jqSync.text("Sync answers");
        }
        return curState;
    };

    this.renderMath = function () {
        var jqQuiz = this.jqQuiz;
        jqQuiz.addClass("mathjax-busy");
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, this.jqQuiz[0]]);
        MathJax.Hub.Queue(function () {
            jqQuiz.removeClass("mathjax-busy");
        });
    };

    /** Render next question */
    this.renderNewQuestion = function (qn, ordering) {
        var i, html = '';
        //TODO: Do some proper DOM manipluation?
        if (qn.title) { html += '<h3>' + qn.title + '</h3>'; }
        if (qn.text) { html += '<p>' + qn.text + '</p>'; }
        html += '<ol type="a">';
        for (i = 0; i < ordering.length; i++) {
            html += '<li id="answer_' + i + '">';
            html += '<label class="radio">';
            html += '<input type="radio" name="answer" value="' + i + '"/>';
            html += qn.choices[ordering[i]];
            html += '</label></li>';
        }
        html += '</ol>';
        this.jqQuiz.html(html);
        this.renderMath();
    };

    /** Annotate with correct / incorrect selections */
    this.renderAnswer = function (a, answerData, selectedAnswer) {
        var i;
        this.jqQuiz.find('input').attr('disabled', 'disabled');
        this.jqQuiz.find('#answer_' + selectedAnswer).addClass('selected');
        // Mark all answers as correct / incorrect
        for (i = 0; i < a.ordering_correct.length; i++) {
            this.jqQuiz.find('#answer_' + i).addClass(a.ordering_correct[i] ? 'correct' : 'incorrect');
        }
        this.jqQuiz.removeClass('correct');
        this.jqQuiz.removeClass('incorrect');
        this.jqQuiz.addClass(a.correct ? 'correct' : 'incorrect');
        if (answerData.explanation) {
            this.jqQuiz.append($('<div class="alert explanation">' + answerData.explanation + '</div>'));
            this.renderMath();
        }
    };

    this.renderStart = function (tutTitle, lecTitle) {
        this.jqQuiz.html($("<p>Click 'New question' to start your " + lecTitle + " (" + tutTitle + ") quiz</p>"));
    };
}

(function (window, $, undefined) {
    "use strict";
    var quiz, quizView;

    // Wire up quiz object
    quizView = new QuizView($, $('#tw-quiz'), $('#tw-proceed'));
    quiz = new Quiz($.ajax, localStorage, function (message) {
        quizView.updateState("error", message);
    });

    // Complain if there's no localstorage
    if (!window.localStorage) {
        quizView.updateState("error", "Sorry, we do not support your browser");
        return false;
    }

    // Trigger reload if needed
    window.applicationCache.addEventListener('updateready', function (e) {
        if (window.applicationCache.status !== window.applicationCache.UPDATEREADY) {
            return;
        }
        quizView.updateState("reload", 'A new version is avaiable, click "Restart quiz"');
    });

    // Hitting the button moves on to the next state in the state machine
    $('#tw-proceed').bind('click', function (event) {
        event.preventDefault();
        if ($(this).hasClass("disabled")) {
            return;
        }
        switch ($(document).data('tw-state')) {
        case 'processing':
            break;
        case 'error':
        case 'reload':
            window.location.reload(false);
            break;
        case 'nextqn':
            // User ready for next question
            quizView.updateState("processing");
            quiz.getNewQuestion(function (qn, ordering) {
                quizView.renderNewQuestion(qn, ordering);
                quizView.updateState('interrogate');
            });
            break;
        case 'interrogate':
            // Disable all controls and mark answer
            quizView.updateState("processing");
            quiz.setQuestionAnswer(parseInt($('input:radio[name=answer]:checked').val(), 10), function () {
                quizView.renderAnswer.apply(quizView, arguments);
                quizView.updateState('nextqn');
                $('#tw-sync').click();
            });
            break;
        default:
            quizView.updateState('error', "Error: Quiz in unkown state");
        }
    });

    $('#tw-sync').bind('click', function (event) {
        if (quizView.syncState() === 'processing') {
            // Don't want to repeatedly sync
            return;
        }
        quizView.syncState('processing');
        if (!window.navigator.onLine) {
            quizView.syncState('offline');
            return;
        }
        quiz.syncAnswers(function (state) {
            quizView.syncState(state);
        });
    });
    quizView.syncState('');

    // Load the lecture referenced in URL, if successful hit the button to get first question.
    quiz.setCurrentLecture(quiz.parseQS(window.location), function () {
        quizView.renderStart.apply(quizView, arguments);
        quizView.updateState("nextqn");
    });

}(window, jQuery));
