/*jslint nomen: true, plusplus: true, browser:true*/
/*global jQuery, Quiz, MathJax*/

/**
  * View class to translate data into DOM structures
  *    $: jQuery
  *    jqQuiz: jQuery-wrapped <form id="tw-quiz">
  *    jqProceed: jQuery wrapped proceed button
  */
function QuizView($, jqQuiz, jqTimer, jqProceed, jqFinish, jqDebugMessage) {
    "use strict";
    this.jqQuiz = jqQuiz;
    this.jqTimer = jqTimer;
    this.jqProceed = jqProceed;
    this.jqFinish = jqFinish;
    this.jqDebugMessage = jqDebugMessage;
    this.jqGrade = $('#tw-grade');
    this.jqPractice = $('#tw-practice');
    this.timerTime = null;

    /** Start the timer counting down from startTime seconds */
    this.timerStart = function (startTime) {
        var self = this;
        function formatTime(t) {
            var out = "";
            function plural(i, base) {
                return i + " " + base + (i !== 1 ? 's' : '');
            }

            if (t > 60) {
                out = plural(Math.floor(t / 60), 'min') + ' ';
                t = t % 60;
            }
            out += plural(t, 'sec');
            return out;
        }

        if (startTime) {
            self.timerTime = startTime;
        } else {
            if (this.timerTime === null) {
                // Something called timerStop, so stop.
                return;
            }
            self.timerTime = self.timerTime - 1;
        }

        if (self.timerTime > 0) {
            self.jqTimer.text(formatTime(self.timerTime));
            window.setTimeout(self.timerStart.bind(self), 1000);
        } else {
            // Wasn't asked to stop, so it's a genuine timeout
            self.jqTimer.text("Out of time");
            self.jqProceed.trigger('click', 'timeout');
        }
    };

    /** Stop the timer at it's current value */
    this.timerStop = function () {
        var self = this;
        self.timerTime = null;
    };

    /** Update the debug message with current URI and an extra string */
    this.updateDebugMessage = function (lecUri, qn) {
        var self = this;
        if (lecUri) { self.jqDebugMessage[0].lecUri = lecUri; }
        self.jqDebugMessage.text(self.jqDebugMessage[0].lecUri + "\n" + qn);
    };

    /** Switch quiz state, optionally showing message */
    this.updateState = function (curState, message, encoding) {
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

        $(document).data('tw-state', curState);

        // Set button to match state
        self.jqProceed.removeAttr("disabled");
        self.jqPractice.removeAttr("disabled");
        self.jqFinish.removeAttr("disabled");
        if (curState === 'nextqn') {
            self.jqProceed.html("New question >>>");
        } else if (curState === 'interrogate') {
            self.jqProceed.html("Submit answer >>>");
            self.jqPractice.attr("disabled", true);
            self.jqFinish.attr("disabled", true);
        } else if (curState === 'processing') {
            self.jqProceed.attr("disabled", true);
        } else {
            self.jqProceed.html("Restart quiz >>>");
        }
    };

    /** Update sync button, curState one of 'processing', 'online', 'offline', 'unauth', '' */
    this.syncState = function (curState) {
        var jqSync = $('#tw-sync');

        if (!curState) {
            // Want to know what the state is
            return jqSync[0].className === 'btn active' ? 'processing'
                    : jqSync[0].className === 'btn btn-danger btn-unauth' ? 'unauth'
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
            jqSync[0].className = 'btn btn-danger btn-unauth';
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

    this.renderMath = function (onSuccess) {
        var jqQuiz = this.jqQuiz;
        jqQuiz.addClass("mathjax-busy");
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, this.jqQuiz[0]]);
        MathJax.Hub.Queue(function () {
            jqQuiz.removeClass("mathjax-busy");
        });
        if (onSuccess) {
            MathJax.Hub.Queue(onSuccess);
        }
    };

    /** Render next question */
    this.renderNewQuestion = function (qn, a) {
        var self = this, i, html = '';
        self.updateDebugMessage(null, a.uri.replace(/.*\//, ''));
        //TODO: Do some proper DOM manipluation?
        if (qn.text) { html += '<p>' + qn.text + '</p>'; }
        html += '<ol type="a">';
        for (i = 0; i < a.ordering.length; i++) {
            html += '<li id="answer_' + i + '">';
            html += '<label class="radio">';
            html += '<input type="radio" name="answer" value="' + i + '"/>';
            html += qn.choices[a.ordering[i]];
            html += '</label></li>';
        }
        html += '</ol>';
        self.jqQuiz.html(html);
        self.jqGrade.text("Answered " + a.lec_answered + " questions, " + a.lec_correct + " correctly."
                         + "\nYour grade: " + a.grade_before
                         + "\nYour grade if you get the next question right:" + a.grade_after_right);
        self.renderMath(function () {
            if (a.allotted_time && a.quiz_time) {
                // Already started, dock seconds since started
                self.timerStart(a.allotted_time - (Math.round((new Date()).getTime() / 1000) - a.quiz_time));
            } else if (a.allotted_time) {
                self.timerStart(a.allotted_time);
            }
        });
    };

    /** Annotate with correct / incorrect selections */
    this.renderAnswer = function (a, answerData, gradeString, lastEight) {
        var self = this, i;
        self.jqQuiz.find('input').attr('disabled', 'disabled');
        self.jqQuiz.find('#answer_' + a.selected_answer).addClass('selected');
        // Mark all answers as correct / incorrect
        for (i = 0; i < a.ordering_correct.length; i++) {
            self.jqQuiz.find('#answer_' + i).addClass(a.ordering_correct[i] ? 'correct' : 'incorrect');
        }
        self.jqQuiz.removeClass('correct');
        self.jqQuiz.removeClass('incorrect');
        self.jqQuiz.addClass(a.correct ? 'correct' : 'incorrect');
        if (answerData.explanation) {
            self.jqQuiz.append($('<div class="alert explanation">' + answerData.explanation + '</div>'));
            self.renderMath();
        }
        self.jqGrade.text(gradeString);
        this.renderPrevAnswers(lastEight);
    };

    /** Render previous answers in a list below */
    this.renderPrevAnswers = function (lastEight) {
        var self = this,
            jqList = $("#tw-previous-answers").find('ol');
        jqList.empty();
        jqList.append(lastEight.map(function (a) {
            var t = new Date(0);
            t.setUTCSeconds(a.answer_time);

            return $('<li/>')
                .addClass(a.correct ? 'correct' : 'incorrect')
                .attr('title',
                     (a.selected_answer ? 'You chose ' + String.fromCharCode(97 + a.selected_answer) + '\n' : '')
                     + 'Answered ' + t.toLocaleDateString() + ' ' + t.toLocaleTimeString())
                .append($('<span/>').text(a.correct ? "✔" : '✗'));
        }));
    };

    this.renderStart = function (tutUri, tutTitle, lecUri, lecTitle, gradeString, lastEight) {
        var self = this;
        $("#tw-title").text(tutTitle + " - " + lecTitle);
        self.jqQuiz.html($("<p>Click 'New question' to start your quiz</p>"));
        self.jqGrade.text(gradeString);
        this.renderPrevAnswers(lastEight);
    };
}

(function (window, $, undefined) {
    "use strict";
    var quiz, quizView;
    // Do nothing if not on the right page
    if ($('body.quiz-quiz').length === 0) { return; }

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

    // Catch any uncaught exceptions
    window.onerror = function (message, url, linenumber) {
        quizView.updateState("error", "Internal error: "
                                    + message
                                    + " (" + url + ":" + linenumber + ")");
    };

    // Wire up quiz object
    quizView = new QuizView($, $('#tw-quiz'), $('#tw-timer'), $('#tw-proceed'), $('#tw-finish'), $('#tw-debugmessage'));
    quiz = new Quiz(localStorage, function (message, encoding) {
        quizView.updateState("error", message, encoding);
    });

    // Complain if there's no localstorage
    if (!window.localStorage) {
        quizView.updateState("error", "Sorry, we do not support your browser");
        return false;
    }

    if (window.applicationCache) {
        // Trigger reload if needed
        window.applicationCache.addEventListener('updateready', function (e) {
            if (window.applicationCache.status !== window.applicationCache.UPDATEREADY) {
                return;
            }
            quizView.updateState("reload", 'A new version is avaiable, click "Restart quiz"');
        });
    }

    // Hitting the button moves on to the next state in the state machine
    $('#tw-proceed').bind('click', function (event) {
        event.preventDefault();
        quizView.timerStop();
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
            quiz.getNewQuestion($('#tw-practice').hasClass("active"), function (qn, ordering) {
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
                //TODO: Egh, must be a cleaner way
                quizView.syncState('default');
                $('#tw-sync').trigger('click', 'noforce');
            });
            break;
        default:
            quizView.updateState('error', "Error: Quiz in unkown state");
        }
    });

    $('#tw-practice').bind('click', function (event) {
        var self = this, jqThis = $(this);
        if (jqThis.attr("disabled")) {
            return false;
        }
        if (jqThis.hasClass("active")) {
            jqThis.removeClass("active");
            $('div.status').removeClass("practice");
        } else {
            jqThis.addClass("active");
            $('div.status').addClass("practice");
        }
    });

    $('#tw-finish').bind('click', function (event) {
        if ($(this).attr("disabled")) {
            return false;
        }
    });

    $('#tw-sync').bind('click', function (event, noForce) {
        var syncCall;

        function onError(jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 401 || jqXHR.status === 403) {
                quizView.syncState('unauth');
            } else {
                quizView.syncState('error');
            }
        }

        if (quizView.syncState() === 'processing') {
            // Don't want to repeatedly sync
            return;
        }
        if (quizView.syncState() === 'unauth') {
            window.open(quiz.portalRootUrl(document.location)
                       + '/login?came_from='
                       + encodeURIComponent(document.location.pathname.replace(/\/\w+\.html$/, '/close.html')),
                       "loginwindow");
            quizView.syncState('default');
            return;
        }
        quizView.syncState('processing');
        if (!window.navigator.onLine) {
            quizView.syncState('offline');
            return;
        }

        // Fetch AJAX call
        syncCall = quiz.syncLecture(!noForce);
        if (syncCall === null) {
            // Sync says there's nothing to do
            quizView.syncState('default');
            return;
        }

        // Sync current lecture and it's questions
        callAjax([syncCall], {error: onError}, null, function () {
            callAjax(quiz.syncQuestions(), {error: onError}, null, function () {
                quizView.syncState('online');
            });
        });
    });
    quizView.syncState('default');

    // Load the lecture referenced in URL, if successful hit the button to get first question.
    quiz.setCurrentLecture(quiz.parseQS(window.location), function (tutUri, tutTitle, lecUri, lecTitle, grade, lastEight) {
        quizView.updateDebugMessage(lecUri, '');
        quizView.renderStart.apply(quizView, arguments);
        quizView.updateState("nextqn");
    });

}(window, jQuery));
