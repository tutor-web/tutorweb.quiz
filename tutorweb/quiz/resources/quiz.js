/*jslint nomen: true, plusplus: true, browser:true*/
/*global $, jQuery*/

/**
  * $: jQuery
  * handleError: callback to of the form function (message) {..}
  */
function Quiz($, localStorage, handleError) {
    "use strict";
    this.handleError = handleError;
    this.lectureUrl = "";
    this._curQuestion = null;
    this._state = {
        allocation: [],
        answerQueue: []
    };

    /** Overridable error handler */
    this.handleError = function (message) {
        console.log("Error: " + message);
    };

    /** Common AJAX error parsing */
    this._ajaxError = function (jqXHR, textStatus, errorThrown) {
        if (textStatus === 'timeout') {
            quiz.handleError("Server Error: Could not contact server");
        } else if (textStatus === 'error' && jqXHR.status === 500) {
            try {
                var exception = JSON.parse(jqXHR.responseText);
                quiz.handleError(exception.error + ": " + exception.message);
            } catch (e) {
                quiz.handleError("Server Error: Unparsable internal server error");
            }
        } else if (textStatus === 'error' && jqXHR.statusText) {
            quiz.handleError("Server Error: " + jqXHR.statusText);
        } else if (exception === 'parsererror') {
            quiz.handleError("Server Error: Could not parse response");
        } else {
            quiz.handleError("Server Error: " + textStatus);
        }
    };

    /** See http://diveintohtml5.info/storage.html */
    this._supportsLocalStorage = function () {
        try {
            return 'localStorage' in window && window['localStorage'] !== null;
        } catch (e) {
            return false;
        }
    };

    /** Send onSuccess a deep structure representing available lectures */
    this.getAvailableLectures = function (onSuccess) {
        var lectures = [];
        //TODO, 
        lectures = [
            ['#!/Plone/high-school-mathematics', 'Calculating with integers', [
                ['#!/Plone/high-school-mathematics/lec050500', 'Calculating with integers'],
                ['#!/Plone/high-school-mathematics/lec050500', 'Calculating with integers'],
                ['#!/Plone/high-school-mathematics/lec050500', 'Calculating with integers'],
            ]],
            ['#!/Plone/high-school-mathematics/lec050500', 'Calculating with integers', []],
            ['#!/Plone/high-school-mathematics/lec050500', 'Calculating with integers', []],
        ];
        onSuccess(lectures);
    }

    /** Search Local storage for a quiz */
    this.findStoredQuiz = function () {
        var i, quiz = this;
        if (!quiz._supportsLocalStorage()) {
            return false;
        }
        for (i = 0; i < localStorage.length; i++) {
            if (localStorage.key(i).indexOf("/") == 0) {
                this.lectureUrl = localStorage.key(i);
                this.inOfflineMode = true;
                return true;
            }
        }
        return false;
    };

    /** Set lecture URL ready for starting a quiz */
    this.setLectureUrl = function (url) {
        this.lectureUrl = url;
    }

    /** Fetch current allocation, either from LocalStorage or server */
    this.getAllocation = function (count, onSuccess) {
        var allocString;

        if (quiz.inOfflineMode && count === null) {
            allocString = localStorage.getItem(quiz.lectureUrl);
            if (allocString === null) {
                quiz.handleError("Cannot find allocation in local storage");
            }
            quiz._state = JSON.parse(allocString);
            onSuccess(quiz._state.allocation);
            return;
        }
        var data = { answers: JSON.stringify(quiz._state.answerQueue) };
        if(count) {
            data.count = count;
        }
        $.ajax({
            type: "POST",
            url: this.lectureUrl + '/quiz-get-allocation',
            dataType: 'json',
            data: data,
            timeout: 3000,
            error: this._ajaxError,
            success: function (data) {
                quiz._state.answerQueue = []; //TODO: Inspect response to see if this happened
                if (!data.questions.length) {
                    quiz.handleError("No questions allocated");
                } else {
                    quiz._state.allocation = data.questions;
                    onSuccess(data.questions);
                }
            },
        });
    };

    /** Fetch question by id, either from LocalStorage or server */
    this.getQuestion = function (questionUid, onSuccess) {
        var qnString;
        // If there's localStorage, check that first
        if (quiz._supportsLocalStorage()) {
            qnString = localStorage.getItem(questionUid);
            if (qnString !== null) {
                onSuccess(JSON.parse(qnString));
                return;
            }
        }
        // Otherwise, fetch over HTTP
        $.ajax({
            url: this.lectureUrl + '/quiz-get-question',
            dataType: 'json',
            data: { 'uid' : questionUid },
            timeout: 3000,
            error: this._ajaxError,
            success: function (data) {
                onSuccess(data);
            }
        });
    };

    /** Choose a question out of the current allocation */
    this.chooseQuestion = function (allocation) {
        var curAllocation, i;
        // If the last item on the queue isn't answered, return that
        i = quiz._state.answerQueue.length - 1;
        if (i >= 0 && quiz._state.answerQueue[i].answer_time == null) {
            return quiz._state.answerQueue[i].question_uid;
        }

        //TODO: Hi-tech IAA
        curAllocation = allocation[Math.floor(Math.random()*allocation.length)];

        // Save allocation for later and return question
        quiz._state.answerQueue.push({
            allocation_id: curAllocation.allocation_id,
            question_uid: curAllocation.question_uid,
        });
        if (quiz.inOfflineMode) {
            // Write back to localStorage
            localStorage.setItem(quiz.lectureUrl, JSON.stringify(quiz._state));
        }
        return curAllocation.question_uid;
    };

    /** Prefetch bunch of questions for going offline  */
    this.offlinePrefetch = function (count, onProgress, onSuccess) {
        if (!quiz._supportsLocalStorage()) {
            quiz.handleError("Browser does not support offline storage");
            return; 
        }
        quiz.inOfflineMode = true;
        localStorage.clear();
        // GetAllocation of count
        quiz.getAllocation(count, function (alloc) {
            var a, i, downloaded = 0;
            localStorage.setItem(quiz.lectureUrl, JSON.stringify(quiz._state));
            for (i = 0; i < alloc.length; i++) {
                a = alloc[i];
                quiz.getQuestion(a.question_uid, function (qn) {
                    localStorage.setItem(qn.uid, JSON.stringify(qn));
                    downloaded += 1;
                    if (downloaded < alloc.length) {
                        onProgress(downloaded);
                    } else {
                        onSuccess();
                    }
                });
            }
        });
    };

    this.startOnlineQuiz = function (lectureUrl) {
        var quiz = this;
        quiz.inOfflineMode = false;
        quiz.lectureUrl = lectureUrl;
        localStorage.clear();
        //TODO: Can we write back to the server at this point?
    };

    /** Render next question */
    this.renderNewQuestion = function (onSuccess) {
        //+ Jonas Raoni Soares Silva
        //@ http://jsfromhell.com/array/shuffle [rev. #1]
        function shuffle(v) {
            var j, x, i;
            for (i = v.length; i; j = Math.floor(Math.random() * i), x = v[--i], v[i] = v[j], v[j] = x) {}
            return v;
        }

        quiz.getAllocation(null, function (alloc) {
            quiz.getQuestion(quiz.chooseQuestion(alloc), function (qn) {
                var i, html;
                html = '<p>' + qn.question.text + '</p>';
                html += '<ol type="a">';

                quiz._curQuestion = qn; // Save for answer
                i = quiz._state.answerQueue.length - 1;
                if (i < 0 || quiz._state.answerQueue[i].answer_time != null) {
                    quiz.handleError("Answer queue empty / out of sync");
                    return;
                }
                quiz._state.answerQueue[i].quiz_time = Math.round((new Date()).getTime() / 1000);
                qn.ordering = qn.question.fixed_order.concat(shuffle(qn.question.random_order));
                for (i = 0; i < qn.ordering.length; i++) {
                    html += '<li id="answer_' + i + '">';
                    html += '<label class="radio">';
                    html += '<input type="radio" name="answer" value="' + i + '"/>';
                    html += qn.question.choices[qn.ordering[i]];
                    html += '</label></li>';
                }
                html += '</ol>';
                onSuccess(html);
            });
        });
    };

    /** Decrypt answer and display */
    this.renderAnswer = function (selectedAnswer, onSuccess) {
        var answer, correctIds, correct, qn, i;
        qn = quiz._curQuestion;
        // Note answer in queue
        i = quiz._state.answerQueue.length - 1;
        if (i < 0 || quiz._state.answerQueue[i].answer_time != null) {
            quiz.handleError("Answer queue empty / out of sync");
            return;
        }
        quiz._state.answerQueue[i].answer_time = Math.round((new Date()).getTime() / 1000);
        quiz._state.answerQueue[i].student_answer =  qn.ordering[selectedAnswer];
        if (quiz.inOfflineMode) {
            // Write back to localStorage
            localStorage.setItem(quiz.lectureUrl, JSON.stringify(quiz._state));
        }

        answer = JSON.parse(window.atob(qn.answer));
        correctIds = [];
        correct = false;
        for (i = 0; i < qn.ordering.length; i++) {
            if ($.inArray(qn.ordering[i], answer.correct) >= 0) {
                // Correct, so add it to list
                correctIds.push('#answer_' + i);
                // If student ticked this one, they got it right.
                if (i === selectedAnswer) { correct = true; }
            }
        }
        onSuccess({
            correct: correct,
            selectedId: '#answer_' + selectedAnswer,
            correctId: correctIds.join(', '),
            explanation: answer.explanation,
        });
    };
};

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

    this.renderChooseLecture = function (items) {
        var jqSelect, self = this;

        // [[href, title, items], [href, title, items], ...] => markup
        function listToMarkup(items) {
            var i, jqUl = $('<ul/>');
            if (typeof items === 'undefined') {
                return null;
            }
            for (i=0; i < items.length; i++) {
                jqUl.append($('<li/>')
                        .append($('<a/>')
                            .attr('href', items[i][0])
                            .text(items[i][1]))
                        .append(listToMarkup(items[i][2]))
                        );
            }
            return jqUl;
        }
    
        // Create initial ul
        jqSelect = listToMarkup(items);
        jqSelect.addClass("select-list");
    
        // Bind click event to open items / select item.
        jqSelect.bind('click', function (e) {
            var jqTarget = $(e.target);
            e.preventDefault();
            $(this).find(".selected").removeClass("selected");
            self.twProceed.addClass("disabled");
            if(jqTarget.parent().parent()[0] === this ) {
                // Just open/close item
                jqTarget.parent().toggleClass("expanded");
            } else if (e.target.tagName === 'A') {
                jqTarget.addClass("selected");
                self.twProceed.removeClass("disabled");
            }
        });

        self.jqQuiz.empty().append(jqSelect);
    };
};

(function (window, $, undefined) {
    "use strict";
    var quiz, quizView;

    // Wire up quiz object
    quizView = new QuizView($, $('#tw-quiz'), $('#tw-proceed'));
    quiz = new Quiz($, localStorage, function (message) {
        quizView.updateState("error", message);
    });

    // Complain if there's no localstorage
    if (!('localStorage' in window) || window['localStorage'] === null) {
        quizView.updateState("error", "Sorry, we do not support your browser");
        return false;
    }

    // Trigger reload if needed
    window.applicationCache.addEventListener('updateready', function(e) {
        if (window.applicationCache.status !== window.applicationCache.UPDATEREADY) {
            return;
        }
        quizView.updateState("reload", 'A new version is avaiable, click "Restart quiz"');
    });

    quiz.getAvailableLectures(function (lectures) {
        quizView.renderChooseLecture(lectures);
        quizView.updateState('nextqn');
    });

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
            quiz.getNewQuestion(function (qn) {
                quizView.renderNewQuestion('qn');
                quizView.updateState('interrogate');
            });
            break;
        case 'interrogate':
            // Disable all controls and mark answer
            quizView.updateState("processing");
            quiz.renderAnswer(parseInt($('input:radio[name=answer]:checked').val(), 10), function (ans) {
                var jqQuiz = $('#tw-quiz');
                // Add answer to page
                jqQuiz.find('input').attr('disabled', 'disabled');
                jqQuiz.find(ans.selectedId).addClass('tw-selected');
                jqQuiz.find(ans.correctId).addClass('tw-correct');
                jqQuiz.addClass(ans.correct ? 'correct' : 'incorrect');
                jqQuiz.append($('<div class="alert tw-explanation">' + ans.explanation + '</div>'));

                quizView.updateState('nextqn');
            });
            break;
        default:
            quizView.updateState('error', "Error: Quiz in unkown state");
        }
    });
}(window, jQuery));
