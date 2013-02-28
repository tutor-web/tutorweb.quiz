(function (window, $, undefined) {
    "use strict";
    var quiz = {
        _curQuestion: null,
        _qnStartTime: null,
        _answerQueue: [],
        lectureUrl: "",

        /** Overridable error handler */
        handleError: function(message) {
            console.log("Error: "+message);
        },

        /** Common AJAX error parsing */
        ajaxError: function(jqXHR, textStatus, errorThrown ) {
            quiz.handleError(jqXHR.status == 403
                ? "Server Error: Access forbidden. Are you logged in?"
                : "Server Error: " + textStatus);
        },

        /** Fetch current allocation, either from LocalStorage or server */
        getAllocation: function(onSuccess) {
            $.ajax({
                type: "POST",
                url: this.lectureUrl + '/quiz-get-allocation',
                dataType: 'json',
                contentType: 'application/json',
                processData: false,
                data: JSON.stringify(quiz._answerQueue),
                timeout: 3000,
                error: this.ajaxError,
                success: function(data) {
                    quiz._answerQueue = [];
                    if (!data.questions.length) {
                        quiz.handleError("No questions allocated");
                    } else {
                        onSuccess(data.questions);
                    }
                }
            });
        },

        /** Fetch question by id, either from LocalStorage or server */
        getQuestion: function(questionUid, onSuccess) {
            $.ajax({
                url: this.lectureUrl + '/quiz-get-question/' + questionUid,
                dataType: 'json',
                timeout: 3000,
                error: this.ajaxError,
                success: function(data) {
                    onSuccess(data);
                }
            });
        },

        /** Choose a question out of the current allocation */
        chooseQuestion: function(allocation) {
            return allocation[0].question_uid //TODO: Hi-tech IAA
        },

        /** Prefetch bunch of questions for going offline  */
        offlinePrefetch: function() {
        },

        /** Render next question */
        renderNewQuestion: function(onSuccess) {
            //+ Jonas Raoni Soares Silva
            //@ http://jsfromhell.com/array/shuffle [rev. #1]
            function shuffle(v){
                for(var j, x, i = v.length; i; j = parseInt(Math.random() * i), x = v[--i], v[i] = v[j], v[j] = x);
                return v;
            };
            quiz.getAllocation(function(alloc) {
                quiz.getQuestion(quiz.chooseQuestion(alloc), function(qn) {
                    var html = '<p>' + qn.question.text + '</p>';
                    html += '<ol type="a">';

                    quiz._curQuestion = qn; // Save for answer
                    quiz._qnStartTime = Math.round((new Date()).getTime() / 1000);
                    qn.ordering = qn.question.fixed_order.concat(shuffle(qn.question.random_order));
                    for ( var i = 0; i < qn.ordering.length; i++ ) {
                        html += '<li id="answer_'+i+'">';
                        html += '<label class="radio">';
                        html += '<input type="radio" name="answer" value="'+i+'"/>';
                        html += qn.question.choices[qn.ordering[i]];
                        html += '</label></li>';
                    }
                    html += '</ol>';
                    onSuccess(html);
                });
            });
        },

        /** Decrypt answer and display */
        renderAnswer: function(selectedAnswer, onSuccess) {
            var qn = quiz._curQuestion;
            // Note answer in queue
            quiz._answerQueue.push({
                question_uid: qn.uid,
                quiz_time: quiz._qnStartTime,
                answer_time: Math.round((new Date()).getTime() / 1000),
                student_answer: qn.ordering[selectedAnswer],
            });

            var answer = qn.answer; //TODO: This is where we'd deobsfucate
            var correctIds = [];
            var correct = false;
            for ( var i = 0; i < qn.ordering.length; i++ ) {
                if($.inArray(qn.ordering[i], answer.correct) >= 0) {
                    // Correct, so add it to list
                    correctIds.push('#answer_' + i);
                    // If student ticked this one, they got it right.
                    if(i === selectedAnswer) correct = true;
                }
            }
            onSuccess({
                correct: correct,
                selectedId: '#answer_' + selectedAnswer,
                correctId: correctIds.join(', '),
                explanation: "<p>Notice that C = A \\ B</p>",
            });
        },
    }

    $(function() {
        var twQuiz = $('#tw-quiz');

        /** Switch quiz state, optionally showing message */
        function updateState(curState, message) {
            $(document).data('tw-state', curState);

            // Add message to page if we need to
            if (message) {
                var alertClass = (curState === 'error' ? ' alert-error' : '');
                $('<div class="alert' + alertClass + '">' + message + '</div>').insertBefore($('#tw-quiz'));
            }

            // Set button to match state
            var twProceed = $('#tw-proceed');
            twProceed.removeAttr("disabled")
            if (curState === 'initial' || curState === 'answered') {
                twProceed.html("New question >>>");
            } else if (curState === 'interrogate') {
                twProceed.html("Submit answer >>>");
            } else if (curState === 'processing') {
                twProceed.attr("disabled", true);
            } else {
                twProceed.html("Restart quiz >>>");
            }
        }
        updateState('initial');

        // Wire up quiz object
        quiz.lectureUrl = twQuiz.data('lecture-url');
        quiz.handleError = function(message) {
            updateState("error", message);
        }
        //TODO: When / how do we send back cached requests?

        $('#tw-proceed').bind('click', function() {
            switch($(document).data('tw-state')) {
                case 'processing':
                    break;
                case 'error':
                    window.location.reload(false);
                    break;
                case 'initial':
                case 'answered':
                    // User ready for next question
                    updateState("processing");
                    quiz.renderNewQuestion(function(html) {
                        twQuiz.attr('class', '');
                        twQuiz.html(html);
                        updateState('interrogate');
                    });
                    break;
                case 'interrogate':
                    // Disable all controls and mark answer
                    updateState("processing");
                    quiz.renderAnswer(parseInt($('input:radio[name=answer]:checked').val()), function(ans) {
                        // Add answer to page
                        twQuiz.find('input').attr('disabled', 'disabled');
                        twQuiz.find(ans.selectedId).addClass('tw-selected');
                        twQuiz.find(ans.correctId).addClass('tw-correct');
                        twQuiz.addClass(ans.correct ? 'correct' : 'incorrect');
                        twQuiz.append($('<div class="alert tw-explanation">' + ans.explanation + '</div>'));

                        updateState('answered');
                    });
                    break;
                default:
                    updateState('error', "Error: Quiz in unkown state");
            }
        });
    });
})(window, jQuery);
