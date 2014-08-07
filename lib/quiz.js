/*jslint nomen: true, plusplus: true, browser:true*/
/* global require, jQuery */
var Quiz = require('./quizlib.js');
var View = require('./view.js');
var AjaxApi = require('./ajaxapi.js');

/**
  * View class to translate data into DOM structures
  *    $: jQuery
  *    jqQuiz: jQuery-wrapped <form id="tw-quiz">
  *    jqActions: <ul> that contains action buttons
  */
function QuizView($) {
    "use strict";
    this.jqTimer = $('#tw-timer');
    this.jqDebugMessage = $('#tw-debugmessage');
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

    /** Render next question */
    this.renderNewQuestion = function (qn, a, onFinish) {
        var self = this, i, html = '';
        function el(name) {
            return $(document.createElement(name));
        }
        function previewTeX(jqEl) {
            var jqPreview = el('div').attr('class', 'tex-preview');
            function intelligentText(t) {
                return t.split("\n").map(function (line) { return el('p').text(line); });
            }

            jqPreview.empty().append(intelligentText(jqEl.val()));
            jqEl.change(function (e) {
                jqPreview.empty().append(intelligentText(e.target.value));
                self.renderMath();
            });
            return el('div').append([jqEl, jqPreview]);
        }

        self.updateDebugMessage(null, a.uri.replace(/.*\//, ''));
        if (qn._type === 'template') {
            self.jqQuiz.empty().append([
                el('h3').text(qn.title),
                el('p').html(qn.hints),
                previewTeX(el('textarea').attr('name', 'text').text(qn.example_text)),
                el('label').text("Write possible answers below. Check boxes for correct answers:"),
                el('table').attr('class', 'choices').append(qn.example_choices.map(function(text, i) {
                    return el('tr').append([
                        el('td').append(el('input').attr('type', 'checkbox')
                                     .attr('name', 'choice_' + i + '_correct')),
                        el('td').append(previewTeX(el('input').attr('type', 'text')
                                     .attr('name', 'choice_' + i)
                                     .attr('value', text)))
                    ]);
                })),
                el('label').text("Write an explanation below as to why it's a correct answer:"),
                previewTeX(el('textarea').attr('name', 'explanation').text(qn.example_explanation))
            ]);
        } else {
            self.jqQuiz.empty().append([
                (qn.text ? el('p').html(qn.text) : null),
                el('ol').attr('type', 'a').append(a.ordering.map(function(ord, i) {
                    return el('li').attr('id', 'answer_' + i).append([
                        el('label').attr('class', 'radio').html(qn.choices[ord]).prepend([
                            el('input').attr('type', 'radio').attr('name', 'answer').attr('value', i)
                        ])
                    ]);
                }))
            ]);
        }
        self.renderMath(onFinish);
    };

    /** Annotate with correct / incorrect selections */
    this.renderAnswer = function (a, answerData) {
        var self = this, i;
        self.jqQuiz.find('input,textarea').attr('disabled', 'disabled');

        if (a.question_type === 'template') {
            // No marking to do, just show a thankyou message
            answerData.explanation = answerData.explanation || (a.correct ?
                                     'Thankyou for submitting a question' :
                                     'Your question has not been saved');
        } else {
            self.jqQuiz.find('#answer_' + a.selected_answer).addClass('selected');
            // Mark all answers as correct / incorrect
            for (i = 0; i < a.ordering_correct.length; i++) {
                self.jqQuiz.find('#answer_' + i).addClass(a.ordering_correct[i] ? 'correct' : 'incorrect');
            }
        }

        if (a.hasOwnProperty('correct')) {
            self.jqQuiz.toggleClass('correct', a.correct);
            self.jqQuiz.toggleClass('incorrect', !a.correct);
        }

        if (answerData.explanation) {
            self.jqQuiz.append($('<div class="alert explanation">' + answerData.explanation + '</div>'));
            self.renderMath();
        }
    };

    /** Helper to turn the last item in an answerQueue into a grade string */
    this.renderGrade = function (a) {
        var self = this, out = "";

        if (!a) {
            self.jqGrade.text(out);
            return;
        }

        if (a.practice) {
            out = "Practice mode";
            if (a.hasOwnProperty('practice_answered')) {
                out += ": " + a.practice_answered + " practice questions, " + a.practice_correct + " correct.";
            }
            self.jqGrade.text(out);
            return;
        }

        if (a.hasOwnProperty('lec_answered') && a.hasOwnProperty('lec_correct')) {
            out += "\nAnswered " + (a.lec_answered - (a.practice_answered || 0)) + " questions, ";
            out += (a.lec_correct - (a.practice_correct || 0)) + " correctly.";
        }
        if (a.hasOwnProperty('grade_after') || a.hasOwnProperty('grade_before')) {
            out += "\nYour grade: ";
            out += a.hasOwnProperty('grade_after') ? a.grade_after : a.grade_before;
            if (a.hasOwnProperty('grade_next_right')) {
                out += ", if you get the next question right: " + a.grade_next_right;
            }
        }
        self.jqGrade.text(out);
    };

    /** Render previous answers in a list below */
    this.renderPrevAnswers = function (lastEight) {
        var self = this,
            jqList = $("#tw-previous-answers").find('ol');

        jqList.empty().append(lastEight.map(function (a) {
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

    this.renderStart = function (a, continuing, tutUri, tutTitle, lecUri, lecTitle) {
        var self = this;
        $("#tw-title").text(tutTitle + " - " + lecTitle);
        self.jqQuiz.empty().append($("<p/>").text(
            continuing ? "Click 'Continue question' to carry on" : "Click 'New question' to start"));
        self.updateDebugMessage(lecUri, '');
    };
}
QuizView.prototype = new View($);

(function (window, $, undefined) {
    "use strict";
    var quiz, twView;
    // Do nothing if not on the right page
    if ($('body.quiz-quiz').length === 0) { return; }

    // Wire up Quiz View
    twView = new QuizView($);
    window.onerror = twView.errorHandler();

    // Complain if there's no localstorage
    if (!window.localStorage) {
        throw "Sorry, we do not support your browser";
    }

    // Trigger reload if appCache needs it
    if (window.applicationCache) {
        window.applicationCache.addEventListener('updateready', function (e) {
            if (window.applicationCache.status !== window.applicationCache.UPDATEREADY) {
                return;
            }
            throw 'tutorweb::info::A new version is avaiable, click "Restart quiz"';
        });
    }

    // Create Quiz model
    quiz = new Quiz(localStorage, new AjaxApi($.ajax));

    /** Main state machine, perform actions and update what you can do next */
    twView.stateMachine(function updateState(curState, fallback) {
        $(document).data('tw-state', curState);
        twView.timerStop();

        switch (curState) {
        case 'initial':
            // Load the lecture referenced in URL, if successful hit the button to get first question.
            quiz.setCurrentLecture(quiz.parseQS(window.location), function (a, continuing) {
                twView.renderStart.apply(twView, arguments);
                twView.renderPrevAnswers(quiz.lastEight());
                twView.renderGrade(a);
                if (continuing == 'practice') {
                    updateState('quiz-practice');
                } else if (continuing == 'real') {
                    updateState('quiz-real');
                } else {
                    twView.updateActions(['gohome', 'quiz-practice', 'quiz-real']);
                }
            });
            break;
        case 'quiz-real':
        case 'quiz-practice':
            twView.updateActions([]);
            quiz.getNewQuestion(curState.endsWith('-practice'), function (qn, a) {
                var actions;
                if (qn._type === 'template') {
                    actions = ['cs-skip', 'cs-submit'];
                } else if (curState.endsWith('-practice')) {
                    actions = ['mark-practice'];
                } else {
                    actions = ['mark-real'];
                }
                twView.renderNewQuestion.call(twView, qn, a, function () {
                    // Once MathJax is finished, start the timer
                    twView.timerStart(updateState.bind(null, actions[0]), a.remaining_time);
                });
                twView.renderGrade(a);
                twView.updateActions(actions);
            });
            break;
        case 'mark-real':
        case 'mark-practice':
        case 'cs-skip':
        case 'cs-submit':
            // Disable all controls and mark answer
            twView.updateActions([]);
            quiz.setQuestionAnswer(curState === 'cs-skip' ? [] : $('form#tw-quiz').serializeArray(), function (a) {
                twView.renderAnswer.apply(twView, arguments);
                twView.renderPrevAnswers(quiz.lastEight());
                twView.renderGrade(a);
                $('#tw-sync').trigger('click', 'noforce');
                if (curState === 'mark-practice') {
                    twView.updateActions(['gohome', 'quiz-real', 'quiz-practice']);
                } else {
                    twView.updateActions(['gohome', 'quiz-practice', 'quiz-real']);
                }
            });
            break;
        default:
            fallback(curState);
        }
    });

    $('#tw-sync').bind('click', function (event, noForce) {
        var syncCall;

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
                twView.syncState('unauth');
            } else {
                twView.syncState('error');
            }
        }

        if (twView.syncState() === 'processing') {
            // Don't want to repeatedly sync
            return;
        }
        if (twView.syncState() === 'unauth') {
            // Only show dialog if user has explcitly clicked button
            if (!noForce) {
                window.open(quiz.portalRootUrl(document.location) +
                            '/login?came_from=' +
                            encodeURIComponent(document.location.pathname.replace(/\/\w+\.html$/, '/close.html')),
                            "loginwindow");
                twView.syncState('default');
            }
            return;
        }
        twView.syncState('processing');
        if (!window.navigator.onLine) {
            twView.syncState('offline');
            return;
        }

        // Fetch AJAX call
        syncCall = quiz.syncLecture(!noForce);
        if (syncCall === null) {
            // Sync says there's nothing to do
            twView.syncState('default');
            return;
        }

        // Sync current lecture and it's questions
        callAjax([syncCall], {error: onError}, null, function () {
            callAjax(quiz.syncQuestions(), {error: onError}, null, function () {
                twView.syncState('online');
            });
        });
    });
    twView.syncState('default');
}(window, jQuery));
