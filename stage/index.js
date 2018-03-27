/*jslint nomen: true, plusplus: true, browser:true, regexp: true, unparam: true, todo: true */
/*global require, Promise */
var jQuery = require('jquery');
require('es6-promise').polyfill();
var Quiz = require('lib/quizlib.js');
var View = require('lib/view.js');
var AjaxApi = require('lib/ajaxapi.js');
var Timer = require('lib/timer.js');
var UserMenu = require('lib/usermenu.js');

/**
  * View class to translate data into DOM structures
  *    $: jQuery
  */
function QuizView($) {
    "use strict";
    this.jqDebugMessage = $('#tw-debugmessage');
    this.jqGrade = $('#tw-grade');
    this.jqAnswers = $('#tw-answers');
    this.ugQnRatings = [
        [100, "Very hard"],
        [75, "Hard"],
        [50, "Good"],
        [25, "Easy"],
        [0, "Too easy"],
        [-1, "Doesn't make sense"],
        [-2, "Superseded"],
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

    /** Render next question */
    this.renderNewQuestion = function (qn, a, actionsOnChange) {
        var self = this, jqForm = el('form');

        self.updateDebugMessage(null, a.uri.replace(/.*\//, ''));
        jqForm.append(self.renderQuestion(qn, a));

        jqForm.on('change', function () {
            self.updateActions(actionsOnChange);
        });

        self.jqQuiz.empty().append([
            qn._type === 'usergenerated' ? el('div').attr('class', 'usergenerated alert alert-info').text('This question is written by a fellow student. Your answer to this question will not count towards your grade.') : null,
            jqForm,
        ]);
        return self.renderMath();
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
            parsedExplanation = parsedExplanation || (a.student_answer && a.student_answer.text ?
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
                self.jqQuiz.children('form').toggleClass('correct', a.correct);
                self.jqQuiz.children('form').toggleClass('incorrect', !a.correct);
            }

            if (parsedExplanation) {
                self.jqQuiz.children('form').append(el('div').attr('class', 'alert explanation').html(parsedExplanation));
                self.renderMath();
            }

            // Add on the extra fields to evaluate the question
            if (a.question_type === 'usergenerated') {
                self.jqQuiz.children('form').append([
                    el('label').text("How did you find the question?"),
                    el('ul').append(self.ugQnRatings.map(function (rating) {
                        if (rating[0] < -1) {
                            // Can't select superseded
                            return null;
                        }
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

    this.renderGradeSummary = function (summary) {
        var self = this,
            jqGrade = self.jqGrade,
            jqStats = this.jqAnswers.find('.current'),
            jqList = this.jqAnswers.children('ol.previous');

        jqGrade.text(summary.practice || summary.grade || '');
        if (summary.encouragement) {
            jqGrade.text(jqGrade.text() + ' ~ ' + summary.encouragement);
        }
        jqStats.text(summary.practiceStats || summary.stats || '');
        jqList.empty().append((summary.lastEight || []).map(function (a) {
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

    this.renderStart = function (args) {
        var self = this;
        $("#tw-title").text(args.lecTitle);
        self.jqQuiz.empty().append($("<p/>").text(
            args.continuing ? "Click 'Continue question' to carry on" : "Click 'New question' to start"
        ));
        self.updateDebugMessage(args.lecUri, '');
    };

    this.renderReview = function (reviewData) {
        var self = this;

        function ratingDiv(rating) {
            if (typeof rating !== "number") {
                return el('div').addClass('rating').text('(not yet rated)');
            }

            rating = self.ugQnRatings.filter(function (r) {
                return r[0] <= rating;
            })[0];

            return el('div')
                .addClass('rating')
                .addClass('rating-' + rating[0])
                .html(rating[1]);
        }

        this.jqQuiz.empty().append([
            el('h3').text('Questions you have written'),
            (reviewData.length === 0 ? el('p').text("You haven't written any questions in this lecture") : null),
        ]);
        this.jqQuiz.append(el('ul').attr('class', 'select-list review').append(reviewData.map(function (qn) {
            var correct = qn.choices.filter(function (ans) { return ans.correct; });
            correct = correct.length > 0 ? el('div').attr('class', 'answer').html(correct[0].answer) : null;

            return el('li').append([
                el('a').attr('tabindex', 0).append([
                    el('div').html(qn.text),
                    correct,
                    ratingDiv(qn.verdict, 'overall'),
                ]).focus(function () {
                    self.selectedQn = qn.uri;
                    self.updateActions(['gohome', 'rewrite-question']);
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
    var quiz, twView, twTimer, twMenu;
    // Do nothing if not on the right page
    if (!window) { return; }

    // Make instructions box toggle open
    $(".instructions_box").hide();
    $('.instructions_heading').click(function () {
        $('.instructions_box').toggle();
    });

    // Wire up Quiz View
    twView = new QuizView($);
    twTimer = new Timer($('#tw-timer span'));

    // Create Quiz model
    twView.states.initial = function () {
        quiz = new Quiz(localStorage, new AjaxApi($.ajax));
        twMenu = new UserMenu($('#tw-usermenu'), quiz);
        return 'set-lecture';
    };

    // Load the lecture referenced in URL, if successful hit the button to get first question.
    twView.states['set-lecture'] = function () {
        twView.updateActions([]);
        return quiz.setCurrentLecture({lecUri: twView.curUrl.path}).then(function (args) {
            twView.renderStart(args);
            quiz.lectureGradeSummary(twView.curUrl.lecUri).then(twView.renderGradeSummary.bind(twView));
            if (args.material_tags.indexOf("type:template") > -1) {
                return 'review';
            }
            if (args.continuing === 'practice') {
                return 'quiz-practice';
            }
            if (args.continuing === 'real') {
                return 'quiz-real';
            }
            twView.updateActions(['gohome', 'review', (args.practiceAllowed > 0 ? 'quiz-practice' : null), 'quiz-real']);
        })['catch'](function (err) {
            if (err.message.indexOf("Unknown lecture: ") === 0) {
                twView.showAlert('info', 'You are not subscribed yet, you need to subscribe before taking drills. Do you wish to?');
                twView.updateActions(['subscription-add']);
                return;
            }

            if (err.message.indexOf("Subscriptions not yet downloaded") === 0) {
                twView.updateActions([]);
                return quiz.syncSubscriptions({}, function (opTotal, opSucceeded, message) {
                    twView.renderProgress(opSucceeded, opTotal, message);
                }).then(function () {
                    return 'set-lecture';
                });
            }

            throw err;
        })['catch'](function (err) {
            if (err.message.indexOf('tutorweb::unauth::') === 0) {
                return 'go-login';
            }
        });
    };

    twView.states['subscription-add'] = function () {
        twView.updateActions([]);
        return quiz.syncSubscriptions({ lectureAdd:  twView.curUrl.lecUri }, function (opTotal, opSucceeded, message) {
            twView.renderProgress(opSucceeded, opTotal, message);
        }).then(function () {
            return 'set-lecture';
        });
    };

    twView.states['quiz-real'] = twView.states['quiz-practice'] = twView.states['rewrite-question'] = function (curState, updateState) {
        twView.updateActions([]);
        return quiz.getNewQuestion({
            question_uri: curState === 'rewrite-question' ? twView.selectedQn : null,
            practice: curState.endsWith('-practice')
        }).then(function (args) {
            args.actions = args.qn._type === 'template' ? ['ug-skip', 'ug-submit'] : ['qn-skip', 'qn-submit'];

            quiz.lectureGradeSummary(twView.curUrl.lecUri).then(twView.renderGradeSummary.bind(twView));
            return twView.renderNewQuestion(args.qn, args.a, args.actions).then(function () {
                return args;
            });
        }).then(function (args) {
            var skipAction = args.actions[0];
            twView.updateActions([skipAction]);
            // Once MathJax is finished, start the timer
            if (args.a.remaining_time) {
                twTimer.start(function () {
                    twTimer.text("Out of time!");
                    updateState(skipAction);
                }, args.a.remaining_time);
            } else {
                twTimer.reset();
            }
        });
    };

    twView.states['qn-skip'] = twView.states['qn-submit'] = twView.states['ug-skip'] = twView.states['ug-submit'] = twView.states['ug-rate'] = function (curState) {
        // Disable all controls and mark answer
        twView.updateActions([]);
        return quiz.setQuestionAnswer(curState.endsWith('-skip') ? [] : twView.jqQuiz.children('form').serializeArray()).then(function (args) {
            twView.renderAnswer(args.a, args.answerData);
            quiz.lectureGradeSummary(twView.curUrl.lecUri).then(twView.renderGradeSummary.bind(twView));
            twMenu.syncAttempt(false);
            if (args.a.question_type === 'usergenerated' && !args.a.student_answer.hasOwnProperty('comments')) {
                // Go round again, to add rating to answerQueue
                twView.updateActions(['ug-rate']);
            } else {
                twView.updateActions([]);
                if (args.a.explanation_delay) {
                    twTimer.start(function () {
                        twTimer.reset();
                        twView.updateActions(['gohome', 'review', (args.practiceAllowed > 0 ? 'quiz-practice' : null), 'quiz-real']);
                    }, args.a.explanation_delay);
                } else {
                    twView.updateActions(['gohome', 'review', (args.practiceAllowed > 0 ? 'quiz-practice' : null), 'quiz-real']);
                }
            }
        });
    };

    twView.states.review = function () {
        twView.updateActions([]);
        return quiz.fetchReview().then(function (review) {
            twView.renderReview(review);
            twView.updateActions(['gohome', null]);
        });
    };

    twView.stateMachine(function updateState(curState, fallback) {
        twTimer.stop();
        fallback(curState);
    });
}(window, jQuery));
