/*jslint nomen: true, plusplus: true, browser:true, regexp: true, unparam: true */
/*global require */
var jQuery = require('jquery');
var Quiz = require('./quizlib.js');
var View = require('./view.js');
var AjaxApi = require('./ajaxapi.js');
var Timer = require('./timer.js');

/**
  * View class to translate data into DOM structures
  *    $: jQuery
  *    jqQuiz: jQuery-wrapped <form id="tw-quiz">
  *    jqActions: <ul> that contains action buttons
  */
function QuizView($) {
    "use strict";
    this.jqDebugMessage = $('#tw-debugmessage');
    this.jqGrade = $('#tw-grade');
    this.jqAnswered = $('#tw-answered');
    this.jqPractice = $('#tw-practice');
    this.ugQnRatings = [
        [100, "Very hard"],
        [75, "Hard"],
        [50, "Good"],
        [25, "Easy"],
        [0, "Too easy"],
        [-1, "Doesn't make sense"],
    ];

    // Generate a jQueried DOM element
    function el(name) {
        return $(document.createElement(name));
    }

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
            return jqSync[0].className === 'button active' ? 'processing'
                    : jqSync[0].className === 'button button-danger btn-unauth' ? 'unauth'
                    : jqSync[0].className === 'button button-success' ? 'online'
                         : 'unknown';
        }

        // Setting the state
        if (curState === 'processing') {
            jqSync[0].className = 'button active';
            jqSync.text("Syncing...");
        } else if (curState === 'online') {
            jqSync[0].className = 'button button-success';
            jqSync.text("Scores saved.");
        } else if (curState === 'offline') {
            jqSync[0].className = 'button button-info';
            jqSync.text("Currently offline. Sync once online");
        } else if (curState === 'unauth') {
            jqSync[0].className = 'button button-danger btn-unauth';
            jqSync.text("Click here to login, so your scores can be saved");
        } else if (curState === 'error') {
            jqSync[0].className = 'button button-danger';
            jqSync.text("Syncing failed!");
        } else {
            jqSync[0].className = 'button';
            jqSync.text("Sync answers");
        }
        return curState;
    };


    /** Render next question */
    this.renderNewQuestion = function (qn, a, onFinish) {
        var self = this;
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
                previewTeX(el('textarea').attr('name', 'text').attr('placeholder', qn.example_text)),
                el('label').text("Write the correct answer below"),
                previewTeX(el('input').attr('type', 'text')
                                      .attr('name', 'choice_' + '0')
                                      .attr('placeholder', qn.example_choices[0] || "")
                                      .attr('maxlength', '1000')
                                      .attr('value', '')),
                el('input').attr('type', 'hidden').attr('name', 'choice_' + '0' + '_correct').attr('value', 'on'),
                el('label').text("Fill the rest of the boxes with incorrect answers:"),
                el('div').append(qn.example_choices.slice(1).map(function (text, i) {
                    return previewTeX(el('input').attr('type', 'text')
                                      .attr('name', 'choice_' + (i + 1).toString())
                                      .attr('placeholder', text)
                                      .attr('maxlength', '1000')
                                      .attr('value', ''));
                })),
                el('label').text("Write an explanation below as to why it's a correct answer:"),
                previewTeX(el('textarea').attr('name', 'explanation').attr('placeholder', qn.example_explanation))
            ]);
        } else {
            self.jqQuiz.empty().append([
                (qn.text ? el('p').html(qn.text) : null),
                el('ol').attr('type', 'a').append(a.ordering.map(function (ord, i) {
                    return el('li').attr('id', 'answer_' + i).append([
                        el('label').attr('class', 'radio').html(qn.choices[ord]).prepend([
                            el('input').attr('type', 'radio').attr('name', 'answer').attr('value', i)
                        ])
                    ]);
                }))
            ]);
            if (qn._type === 'usergenerated') {
                self.jqQuiz.prepend([
                    el('div').attr('class', 'usergenerated alert alert-info').text('This question is written by a fellow student. Your answer to this question will not count towards your grade.')
                ]);
            }
        }
        self.renderMath(onFinish);
    };

      /** Annotate with correct / incorrect selections */
    this.renderAnswer = function (a, answerData) {
        var self = this, i,
            parsedExplanation = $(jQuery.parseHTML(answerData.explanation));
        self.jqQuiz.find('input,textarea').attr('disabled', 'disabled');

        // If text in explanation is equivalent to nothing, then don't put anything out
        if ($.trim(parsedExplanation.text()) === "") {
            parsedExplanation = null;
        }

        if (a.question_type === 'template') {
            // No marking to do, just show a thankyou message
            parsedExplanation = parsedExplanation || (a.correct ?
                                     'Thankyou for submitting a question' :
                                     'Your question has not been saved');
            self.jqQuiz.append(el('div').attr('class', 'alert explanation').html(parsedExplanation));
            self.renderMath();

        } else if (a.question_type === 'usergenerated' && a.student_answer.hasOwnProperty('comments')) {
            // Rated the question as well as answered it, just say thankyou
            self.jqQuiz.find('div.alert.usergenerated').remove();
            self.jqQuiz.append(el('div').attr('class', 'alert alert-info').text("Thank you for trying this question!"));

        } else {
            self.jqQuiz.find('#answer_' + a.selected_answer).addClass('selected');
            // Mark all answers as correct / incorrect
            for (i = 0; i < a.ordering_correct.length; i++) {
                self.jqQuiz.find('#answer_' + i).addClass(a.ordering_correct[i] ? 'correct' : 'incorrect');
            }

            if (a.hasOwnProperty('correct')) {
                self.jqQuiz.toggleClass('correct', a.correct);
                self.jqQuiz.toggleClass('incorrect', !a.correct);
            }

            if (parsedExplanation) {
                self.jqQuiz.append(el('div').attr('class', 'alert explanation').html(parsedExplanation));
                self.renderMath();
            }

            // Add on the extra fields to evaluate the question
            if (a.question_type === 'usergenerated') {
                self.jqQuiz.append([
                    el('label').text("How did you find the question?"),
                    el('ul').append(self.ugQnRatings.map(function (rating) {
                        return el('li').append([
                            el('label').attr('class', 'radio').text(rating[1]).prepend([
                                el('input').attr('type', 'radio').attr('name', 'rating').attr('value', rating[0])
                            ])
                        ]);
                    })),
                    el('label').text("Any other comments?"),
                    el('textarea').attr('name', 'comments')
                ]);
            }
        }
    };
    /** Helper to turn the last item in an answerQueue into a grade string */
    this.renderGrade = function (a) {
        var self = this, out = "", out_grade = "";

        if (!a) {
            self.jqGrade.text(out);
            return;
        }

        if (a.practice) {
            out = "Practice mode";
            if (a.hasOwnProperty('practice_answered')) {
                out += ": " + a.practice_answered + " practice questions, " + a.practice_correct + " correct.";
            }
            self.jqPractice.text(out);
            self.jqAnswered.text("");
            self.jqGrade.text("");
            return;
        }

        if (a.hasOwnProperty('lec_answered') && a.hasOwnProperty('lec_correct')) {
            out += "\nAnswered " + (a.lec_answered - (a.practice_answered || 0)) + " questions, ";
            out += (a.lec_correct - (a.practice_correct || 0)) + " correctly.";
            self.jqAnswered.text(out);
        }
        if (a.hasOwnProperty('grade_after') || a.hasOwnProperty('grade_before')) {
            out_grade += "\nYour grade: ";
            out_grade += a.hasOwnProperty('grade_after') ? a.grade_after : a.grade_before;
            if (a.hasOwnProperty('grade_next_right')) {
                out_grade += ", if you get the next question right: " + a.grade_next_right;
            }
            self.jqGrade.text(out_grade);
        }
        self.jqPractice.text("");
    };

    /** Render previous answers in a list below */
    this.renderPrevAnswers = function (lastEight) {
        var jqList = $("#tw-previous-answers").find('ol');

        jqList.empty().append(lastEight.map(function (a) {
            var t = new Date(0),
                title = '';
            t.setUTCSeconds(a.answer_time);

            if (a.selected_answer) {
                title += 'You chose ' + String.fromCharCode(97 + a.selected_answer) + '\n';
            }
            title += 'Answered ' + t.toLocaleDateString() + ' ' + t.toLocaleTimeString();

            if (a.correct === true) {
                return $('<li/>').attr('title', title)
                                 .addClass('correct')
                                 .append($('<span/>').text("✔"));
            }
            if (a.correct === false) {
                return $('<li/>').attr('title', title)
                                 .addClass('incorrect')
                                 .append($('<span/>').text("✗"));
            }
            return $('<li/>').attr('title', title).append($('<span/>').text("-"));
        }));
    };

    this.renderStart = function (a, continuing, tutUri, tutTitle, lecUri, lecTitle) {
        var self = this;
        $("#tw-title").text(tutTitle + " - " + lecTitle);
        self.jqQuiz.empty().append($("<p/>").text(
            continuing ? "Click 'Continue question' to carry on" : "Click 'New question' to start"
        ));
        self.updateDebugMessage(lecUri, '');
    };

    this.renderReview = function (reviewData) {
        var self = this;

        function ratingDiv(rating, extraClass) {
            if (typeof rating !== "number") {
                return null;
            }

            rating = self.ugQnRatings.filter(function (r) {
                return r[0] <= rating;
            })[0];

            return el('div')
                .attr('class', extraClass || '')
                .addClass('rating')
                .addClass('rating-' + rating[0])
                .html(rating[1]);
        }

        this.jqQuiz.empty().append(el('ul').attr('class', 'select-list review').append(reviewData.map(function (qn) {
            var correct = qn.choices.filter(function (ans) { return ans.correct; });
            correct = correct.length > 0 ? el('div').attr('class', 'answer').html(correct[0].answer) : null;

            return el('li').append([
                el('a').attr('tabindex', 0).append([
                    el('div').html(qn.text),
                    correct,
                    ratingDiv(qn.verdict, 'overall'),
                ]).focus(function () {
                    self.updateActions(['gohome', 'initial', 'rewrite-question']);
                }).blur(function () {
                    self.updateActions(['gohome', 'initial', null]);
                }),
                el('dl').append([
                    el('dt').text("Incorrect answers"),
                ].concat(qn.choices.filter(function (ans) { return !ans.correct; }).map(function (choice) {
                    return el('dd').append([
                        el('div').attr('class', 'answer').html(choice.answer)
                    ]);
                })).concat([
                    el('dt').text("Explanation"),
                    el('dd').append([
                        el('b'),
                        el('div').html(qn.explanation),
                    ]),
                    el('dt').text("Reviews"),
                ]).concat(qn.answers.map(function (ans) {
                    return el('dd').append([
                        ratingDiv(ans.rating),
                        el('div').attr('class', 'comments').html(ans.comments),
                    ]);
                }))),
            ]);
        })));
        this.renderMath();
    };

}
QuizView.prototype = new View(jQuery);

(function (window, $) {
    "use strict";
    var quiz, twView, twTimer;
    // Do nothing if not on the right page
    if ($('body.quiz-quiz').length === 0) { return; }

    // Make instructions box toggle open
    $(".instructions_box").hide();
    $('.instructions_heading').click(function () {
        $('.instructions_box').toggle();
    });

    // Wire up Quiz View
    twView = new QuizView($);
    twTimer = new Timer($('#tw-timer span'));

    /** Main state machine, perform actions and update what you can do next */
    twView.stateMachine(function updateState(curState, fallback) {
        function promiseFatalError(err) {
            setTimeout(function () {
                throw err;
            }, 0);
            throw err;
        }

        twTimer.stop();

        twView.updateActions([]);
        switch (curState) {
        case 'initial':
            // Create Quiz model
            quiz = new Quiz(localStorage, new AjaxApi($.ajax));
            updateState.call(this, 'set-lecture', fallback);
            break;
        case 'set-lecture':
            // Load the lecture referenced in URL, if successful hit the button to get first question.
            quiz.setCurrentLecture(twView.parseQS(window.location), function (a, continuing) {
                twView.renderStart.apply(twView, arguments);
                twView.renderPrevAnswers(quiz.lastEight());
                twView.renderGrade(a);
                if (continuing === 'practice') {
                    updateState('quiz-practice');
                } else if (continuing === 'real') {
                    updateState('quiz-real');
                } else {
                    twView.updateActions(['gohome', 'review', 'quiz-practice', 'quiz-real']);
                }
            });
            break;
        case 'quiz-real':
        case 'quiz-practice':
            quiz.getNewQuestion(curState.endsWith('-practice'), function (qn, a) {
                var actions;
                if (qn._type === 'template') {
                    actions = ['ug-skip', 'ug-submit'];
                } else if (curState.endsWith('-practice')) {
                    actions = ['mark-practice'];
                } else {
                    actions = ['mark-real'];
                }
                twView.renderNewQuestion(qn, a, function () {
                    // Once MathJax is finished, start the timer
                    if (a.remaining_time) {
                        twTimer.start(updateState.bind(null, actions[0]), a.remaining_time);
                    } else {
                        twTimer.reset();
                    }
                });
                twView.renderGrade(a);
                twView.updateActions(actions);
            });
            break;
        case 'mark-real':
        case 'mark-practice':
        case 'ug-skip':
        case 'ug-submit':
        case 'ug-rate':
            // Disable all controls and mark answer
            quiz.setQuestionAnswer(curState === 'ug-skip' ? [] : $('form#tw-quiz').serializeArray(), function (a) {
                twView.renderAnswer.apply(twView, arguments);
                twView.renderPrevAnswers(quiz.lastEight());
                twView.renderGrade(a);
                $('#tw-sync').trigger('click', 'noforce');
                if (a.question_type === 'usergenerated' && !a.student_answer.hasOwnProperty('comments')) {
                    // Go round again, to add rating to answerQueue
                    twView.updateActions(['ug-rate']);
                } else {
                    twView.updateActions(['gohome', 'quiz-practice', 'quiz-real']);
                }
            });
            break;
        case 'review':
            quiz.fetchReview().then(function (review) {
                twView.renderReview(review);
                twView.updateActions(['gohome', 'initial', null]);
            })['catch'](promiseFatalError);
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

        event.preventDefault();
        if (twView.syncState() === 'processing') {
            // Don't want to repeatedly sync
            return;
        }
        if (twView.syncState() === 'unauth') {
            // Only show dialog if user has explcitly clicked button
            if (!noForce) {
                window.open(
                    twView.portalRootUrl('login?came_from=' +
                            encodeURIComponent(document.location.pathname.replace(/\/\w+\.html$/, '/close.html')) +
                            '&login_name=' + encodeURIComponent(quiz.getCurrentLecture().user || "")),
                    "loginwindow"
                );
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
