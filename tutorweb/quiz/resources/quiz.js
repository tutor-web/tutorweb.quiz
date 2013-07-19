/*jslint nomen: true, plusplus: true, browser:true*/
/*global $, jQuery*/

(function (window, $, undefined) {
    "use strict";
    var quiz = {
        /**
         * Quiz singleton: Handles fetching / storing / answering questions
         */
        lectureUrl: "",
        _curQuestion: null,
        _state: {
            allocation: [],
            answerQueue: [],
        },

        /** Overridable error handler */
        handleError: function (message) {
            console.log("Error: " + message);
        },

        /** Common AJAX error parsing */
        _ajaxError: function (jqXHR, textStatus, errorThrown) {
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
        },

        /** See http://diveintohtml5.info/storage.html */
        _supportsLocalStorage: function () {
            try {
                return 'localStorage' in window && window['localStorage'] !== null;
            } catch (e) {
                return false;
            }
        },

        /** Search Local storage for a quiz */
        findStoredQuiz: function () {
            var i;
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
        },

        /** Fetch current allocation, either from LocalStorage or server */
        getAllocation: function (count, onSuccess) {
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
        },

        /** Fetch question by id, either from LocalStorage or server */
        getQuestion: function (questionUid, onSuccess) {
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
        },

        /** Choose a question out of the current allocation */
        chooseQuestion: function (allocation) {
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
        },

        /** Prefetch bunch of questions for going offline  */
        offlinePrefetch: function (count, onProgress, onSuccess) {
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
        },

        startOnlineQuiz: function (lectureUrl) {
            quiz.inOfflineMode = false;
            quiz.lectureUrl = lectureUrl;
            localStorage.clear();
            //TODO: Can we write back to the server at this point?
        },

        /** Render next question */
        renderNewQuestion: function (onSuccess) {
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
        },

        /** Decrypt answer and display */
        renderAnswer: function (selectedAnswer, onSuccess) {
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
        },
    };

    $(function () {
        var twQuiz = $('#tw-quiz');
        var lectureUrl;

        /** Switch quiz state, optionally showing message */
        function updateState(curState, message) {
            var twProceed, twOffline, alertClass;
            $(document).data('tw-state', curState);

            // Add message to page if we need to
            if (message) {
                alertClass = (curState === 'error' ? ' alert-error' : '');
                $('<div class="alert' + alertClass + '">' + message + '</div>').insertBefore($('#tw-quiz'));
            }

            // Set button to match state
            twProceed = $('#tw-proceed');
            twOffline = $('#tw-offline');
            twProceed.removeAttr("disabled");
            twOffline.removeAttr("disabled");
            if (curState === 'nextqn') {
                twProceed.html("New question >>>");
            } else if (curState === 'interrogate') {
                twProceed.html("Submit answer >>>");
            } else if (curState === 'processing') {
                twProceed.attr("disabled", true);
                twOffline.attr("disabled", true);
            } else {
                twProceed.html("Restart quiz >>>");
            }
            if (quiz.inOfflineMode) {
                twOffline.html("Reconnect to server");
            } else {
                twOffline.html("Store questions for offline use");
            }
        }

        // Wire up quiz object
        quiz.handleError = function (message) {
            updateState("error", message);
        };
        if (quiz.findStoredQuiz()) {
            // There's a stored quiz, so we're in offline mode
            twQuiz.html($('<p>Click "New question" to continue your offline quiz.</p>'));
            updateState('nextqn');
        } else {
            lectureUrl = window.location.hash.replace(/^#/, '');
            if (!lectureUrl) {
                twQuiz.html($('<p>You do not have a quiz saved. Please follow a quiz link from a lecture.</p>'));
                updateState("error");
            } else {
                twQuiz.html($('<p>Click "New question" to start your quiz, or "Store questions" if you want to take a quiz later.</p>'));
                quiz.startOnlineQuiz(lectureUrl);
                updateState('nextqn');
            }
        }

        //TODO: Detect a new version of quiz.js?
        window.applicationCache.addEventListener('updateready', function(e) {
            if (window.applicationCache.status !== window.applicationCache.UPDATEREADY) {
                return;
            }
            updateState("reload", 'A new version is avaiable, click "Restart quiz"');
        });

        $('#tw-proceed').bind('click', function (event) {
            event.preventDefault();
            switch ($(document).data('tw-state')) {
            case 'processing':
                break;
            case 'error':
            case 'reload':
                window.location.reload(false);
                break;
            case 'nextqn':
                // User ready for next question
                updateState("processing");
                quiz.renderNewQuestion(function (html) {
                    twQuiz.attr('class', '');
                    twQuiz.html(html);
                    updateState('interrogate');
                });
                break;
            case 'interrogate':
                // Disable all controls and mark answer
                updateState("processing");
                quiz.renderAnswer(parseInt($('input:radio[name=answer]:checked').val(), 10), function (ans) {
                    // Add answer to page
                    twQuiz.find('input').attr('disabled', 'disabled');
                    twQuiz.find(ans.selectedId).addClass('tw-selected');
                    twQuiz.find(ans.correctId).addClass('tw-correct');
                    twQuiz.addClass(ans.correct ? 'correct' : 'incorrect');
                    twQuiz.append($('<div class="alert tw-explanation">' + ans.explanation + '</div>'));

                    updateState('nextqn');
                });
                break;
            default:
                updateState('error', "Error: Quiz in unkown state");
            }
        });
        $('#tw-offline').bind('click', function (event) {
            var twOfflineBar, lectureUrl;
            event.preventDefault();

            updateState("processing");
            if (quiz.inOfflineMode) {
                // Go back online
                //NB: Check URL first since a user might want to start a new quiz online
                lectureUrl = window.location.hash.replace(/^#/, '');
                if (!lectureUrl) {
                    // If there's no lecture, use whatever quiz is loaded
                    lectureUrl = quiz.lectureUrl;
                }
                quiz.startOnlineQuiz(lectureUrl);
                updateState('nextqn');
            } else {
                // Create progress bar
                twQuiz.html($('<p>Downloading...</p><div class="progress"><div class="bar" id="tw-offline-bar" style="width: 0%;"></div></div>'));
                twOfflineBar = $('#tw-offline-bar');

                // Fetch 20, updating progress as we go
                quiz.offlinePrefetch(20, function (count) {
                    twOfflineBar.width((count * 5) + '%');
                }, function (html) {
                    twOfflineBar.width('100%');
                    updateState('nextqn');
                });
            }
        });
        $('#tw-finish').bind('click', function (event) {
            var lectureUrl;
            event.preventDefault();

            lectureUrl = quiz.lectureUrl || window.location.hash.replace(/^#/, '');
            if (lectureUrl) {
                window.location.href = lectureUrl;
            }
        });
    });
}(window, jQuery));
