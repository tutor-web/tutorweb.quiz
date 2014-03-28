/*jslint nomen: true, plusplus: true, browser:true*/
/*global jQuery, MathJax*/
var Quiz = require('./quizlib.js');

/**
  * View class to translate data into DOM structures
  *    $: jQuery
  *    jqQuiz: jQuery-wrapped <form id="tw-quiz">
  *    jqActions: <ul> that contains action buttons
  */
function QuizView($, jqQuiz, jqTimer, jqActions, jqDebugMessage) {
    "use strict";
    this.jqQuiz = jqQuiz;
    this.jqTimer = jqTimer;
    this.jqActions = jqActions;
    this.jqDebugMessage = jqDebugMessage;
    this.jqGrade = $('#tw-grade');
    this.timerTime = null;

    /** Start the timer counting down from startTime seconds */
    this.timerStart = function (onFinish, startTime) {
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
            self.jqTimer.show();
            self.jqTimer.children('span').text(formatTime(self.timerTime));
            window.setTimeout(self.timerStart.bind(self, onFinish), 1000);
        } else {
            // Wasn't asked to stop, so it's a genuine timeout
            self.jqTimer.show();
            self.jqTimer.children('span').text("Out of time");
            onFinish();
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

    /** Regenerate button collection to contain given buttons */
    this.updateActions = function (actions) {
        var self = this,
            locale = {
                "reload": "Restart drill",
                "gohome": "Finish this drill",
                "quiz-practice": "Practice question",
                "quiz-real": "New question",
                "mark-practice": "Submit answer >>>",
                "mark-real": "Submit answer >>>",
            };
        jqActions.empty().append(actions.map(function (a, i) {
            return $('<button/>')
                .attr('data-state', a)
                .attr('class', 'btn' + (i + 1 == actions.length ? ' btn-primary' : ''))
                .text(locale[a] || a);
        }));
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
    this.renderNewQuestion = function (qn, a, gradeString, onFinish) {
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
        self.jqGrade.text(gradeString);
        self.renderMath(function () {
            if (a.allotted_time && a.quiz_time) {
                // Already started, dock seconds since started
                self.timerStart(onFinish, a.allotted_time - (Math.round((new Date()).getTime() / 1000) - a.quiz_time));
            } else if (a.allotted_time) {
                self.timerStart(onFinish, a.allotted_time);
            }
        });
    };

    /** Annotate with correct / incorrect selections */
    this.renderAnswer = function (a, answerData, gradeString) {
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
                     (a.selected_answer ? 'You chose ' + String.fromCharCode(97 + a.selected_answer) + '\n' : '') +
                      'Answered ' + t.toLocaleDateString() + ' ' + t.toLocaleTimeString())
                .append($('<span/>').text(a.correct ? "✔" : '✗'));
        }));
    };

    this.renderStart = function (continuing, tutUri, tutTitle, lecUri, lecTitle, gradeString) {
        var self = this;
        $("#tw-title").text(tutTitle + " - " + lecTitle);
        self.jqQuiz.empty().append($("<p/>").text(
            continuing ? "Click 'Continue question' to carry on" : "Click 'New question' to start"));
        self.jqGrade.text(gradeString);
        self.updateDebugMessage(lecUri, '');
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

    /** Add a message to the page */
    function showAlert(state, message, encoding) {
        var jqQuiz = $('#tw-quiz'),
            jqAlert = $('<div class="alert">').addClass(state === 'error' ? ' alert-error' : 'alert-info');

        if (encoding === 'html') {
            jqAlert.html(message);
        } else {
            jqAlert.text(message);
        }
        jqQuiz.children('div.alert').remove();
        jqQuiz.prepend(jqAlert);
    }

    /** Main state machine, perform actions and update what you can do next */
    function updateState(curState) {
        $(document).data('tw-state', curState);
        quizView.timerStop();

        switch (curState) {
        case 'processing':
            break;
        case 'error':
        case 'request-reload':
            quizView.updateActions(['reload']);
            break;
        case 'reload':
            window.location.reload(false);
            break;
        case 'gohome':
            window.location.href = 'start.html';
            break;
        case 'initial':
            // Load the lecture referenced in URL, if successful hit the button to get first question.
            quiz.setCurrentLecture(quiz.parseQS(window.location), function (continuing) {
                quizView.renderStart.apply(quizView, arguments);
                quizView.renderPrevAnswers(quiz.lastEight());
                if (continuing == 'practice') {
                    updateState('quiz-practice');
                } else if (continuing == 'real') {
                    updateState('quiz-real');
                } else {
                    quizView.updateActions(['gohome', 'quiz-practice', 'quiz-real']);
                }
            });
            break;
        case 'quiz-real':
        case 'quiz-practice':
            quizView.updateActions([]);
            quiz.getNewQuestion(curState.endsWith('-practice'), function (qn, a, gradeString) {
                var markState = curState.endsWith('-practice') ? 'mark-practice' : 'mark-real';
                quizView.renderNewQuestion.call(quizView, qn, a, gradeString, updateState.bind(null, markState));
                quizView.updateActions([markState]);
            });
            break;
        case 'mark-real':
        case 'mark-practice':
            // Disable all controls and mark answer
            quizView.updateActions([]);
            quiz.setQuestionAnswer(parseInt($('input:radio[name=answer]:checked').val(), 10), function () {
                quizView.renderAnswer.apply(quizView, arguments);
                quizView.renderPrevAnswers(quiz.lastEight());
                $('#tw-sync').trigger('click', 'noforce');
                if (curState === 'mark-practice') {
                    quizView.updateActions(['gohome', 'quiz-real', 'quiz-practice']);
                } else {
                    quizView.updateActions(['gohome', 'quiz-practice', 'quiz-real']);
                }
            });
            break;
        default:
            updateState('error', "Error: Quiz in unkown state");
        }
    }


    // Catch any uncaught exceptions
    window.onerror = function (message, url, linenumber) {
        if (message.toLowerCase().indexOf('quota') > -1) {
            showAlert("error", 'No more local storage available. Please <a href="start.html">return to the menu</a> and delete some tutorials you are no longer using.', 'html');
        } else if (message.indexOf('tutorweb::') !== -1) {
            showAlert("error", message.substring(message.indexOf('tutorweb::') + 10));
        } else {
            showAlert("error", "Internal error: " + message + " (" + url + ":" + linenumber + ")");
        }
        updateState('error');
    };

    // Complain if there's no localstorage
    if (!window.localStorage) {
        showAlert("error", "Sorry, we do not support your browser");
        updateState('error');
        return false;
    }

    if (window.applicationCache) {
        // Trigger reload if needed
        window.applicationCache.addEventListener('updateready', function (e) {
            if (window.applicationCache.status !== window.applicationCache.UPDATEREADY) {
                return;
            }
            showAlert("info", 'A new version is avaiable, click "Restart quiz"');
            updateState('requestreload');
        });
    }

    // Wire up quiz object
    quizView = new QuizView($, $('#tw-quiz'), $('#tw-timer'), $('#tw-actions'), $('#tw-debugmessage'));
    quiz = new Quiz(localStorage);

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
            // Only show dialog if user has explcitly clicked button
            if (!noForce) {
                window.open(quiz.portalRootUrl(document.location) +
                            '/login?came_from=' +
                            encodeURIComponent(document.location.pathname.replace(/\/\w+\.html$/, '/close.html')),
                            "loginwindow");
                quizView.syncState('default');
            }
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

    // Hitting the button moves on to the next state in the state machine
    $('#tw-actions').bind('click', function (event) {
        event.preventDefault();
        updateState(event.target.getAttribute('data-state'));
    });
    updateState("initial");

}(window, jQuery));
