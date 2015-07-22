/*jslint nomen: true, plusplus: true, browser:true, regexp: true, unparam: true, todo: true */
/*global require */
var jQuery = require('jquery');
var Quiz = require('./quizlib.js');
var View = require('./view.js');
var AjaxApi = require('./ajaxapi.js');
var Timer = require('./timer.js');
var UserMenu = require('./usermenu.js');

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
    this.renderNewQuestion = function (qn, a, onFinish) {
        var self = this;
        function previewTeX(jqEl) {
            var jqPreview = el('div').attr('class', 'tex-preview parse-as-tex');
            function intelligentText(t) {
                return t.split(/(\n)/).map(function (part, i) {
                    return i % 2 === 1 ? $('<br/>') : document.createTextNode(part);
                });
            }

            jqPreview.empty().append(intelligentText(jqEl.val()));
            jqEl.change(function (e) {
                jqPreview.empty().append(intelligentText(e.target.value));
                self.renderMath();
            });
            return el('div').append([jqEl, jqPreview]);
        }

        /** Lookup value in object with default */
        function get(x, y, def) {
            return x === undefined || x[y] === undefined ? def : x[y];
        }

        self.updateDebugMessage(null, a.uri.replace(/.*\//, ''));
        if (qn._type === 'template') {
            qn.student_answer = qn.student_answer || {};
            self.jqQuiz.empty().append([
                el('h3').text(qn.title),
                el('p').html(qn.hints),
                previewTeX(el('textarea').attr('name', 'text').attr('placeholder', qn.example_text).text(qn.student_answer.text)),
                el('label').text("Write the correct answer below"),
                previewTeX(el('input').attr('type', 'text')
                                      .attr('name', 'choice_' + '0')
                                      .attr('placeholder', qn.example_choices[0] || "")
                                      .attr('maxlength', '1000')
                                      .attr('value', get(qn.student_answer.choices, 0, {}).answer)),
                el('input').attr('type', 'hidden').attr('name', 'choice_' + '0' + '_correct').attr('value', 'on'),
                el('label').text("Fill the rest of the boxes with incorrect answers:"),
                el('div').append(qn.example_choices.slice(1).map(function (text, i) {
                    return previewTeX(el('input').attr('type', 'text')
                                      .attr('name', 'choice_' + (i + 1).toString())
                                      .attr('placeholder', text)
                                      .attr('maxlength', '1000')
                                      .attr('value', get(qn.student_answer.choices, i + 1, {}).answer));
                })),
                el('label').text("Write an explanation below as to why it's a correct answer:"),
                previewTeX(el('textarea').attr('name', 'explanation').attr('placeholder', qn.example_explanation).text(qn.student_answer.explanation))
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
    /** Helper to turn the last item in an answerQueue into a grade string */
    this.renderGrade = function (a) {
        var self = this,
            out = "",
            out_grade = "",
            jqCurrent = this.jqAnswers.find('.current');

        if (!a) {
            self.jqGrade.text(out);
            return;
        }

        if (a.practice) {
            out = "Practice mode";
            if (a.hasOwnProperty('practice_answered')) {
                out += ": " + a.practice_answered + " practice questions, " + a.practice_correct + " correct.";
            }
            jqCurrent.text(out);
            self.jqGrade.text("");
            return;
        }

        if (a.hasOwnProperty('lec_answered') && a.hasOwnProperty('lec_correct')) {
            out += "\nAnswered " + (a.lec_answered - (a.practice_answered || 0)) + " questions, ";
            out += (a.lec_correct - (a.practice_correct || 0)) + " correctly.";
            jqCurrent.text(out);
        }
        if (a.hasOwnProperty('grade_after') || a.hasOwnProperty('grade_before')) {
            out_grade += "\nYour grade: ";
            out_grade += a.hasOwnProperty('grade_after') ? a.grade_after : a.grade_before;
            if (a.hasOwnProperty('grade_next_right')) {
                out_grade += ", if you get the next question right: " + a.grade_next_right;
            }
            self.jqGrade.text(out_grade);
        }
        jqCurrent.text(out);
    };

    /** Render previous answers in a list below */
    this.renderPrevAnswers = function (lastEight) {
        var jqList = this.jqAnswers.children('ol.previous');

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
                    self.updateActions(['gohome', 'initial', 'rewrite-question']);
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
            twMenu = new UserMenu($('#tw-usermenu'), quiz);
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
        case 'rewrite-question':
            quiz.getNewQuestion({
                question_uri: curState === 'rewrite-question' ? twView.selectedQn : null,
                practice: curState.endsWith('-practice')
            }, function (qn, a) {
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
                        twTimer.start(function () {
                            twTimer.text("Out of time!");
                            updateState(actions[0]);
                        }, a.remaining_time);
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
                twMenu.syncAttempt(false);
                if (a.question_type === 'usergenerated' && !a.student_answer.hasOwnProperty('comments')) {
                    // Go round again, to add rating to answerQueue
                    twView.updateActions(['ug-rate']);
                } else {
                    twView.updateActions([]);
                    if (a.explanation_delay) {
                        twTimer.start(function () {
                            twTimer.reset();
                            twView.updateActions(['gohome', 'review', 'quiz-practice', 'quiz-real']);
                        }, a.explanation_delay);
                    } else {
                        twView.updateActions(['gohome', 'review', 'quiz-practice', 'quiz-real']);
                    }
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
}(window, jQuery));
