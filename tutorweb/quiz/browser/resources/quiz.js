(function (window, $, undefined) {
    "use strict";
    // Global AJAX error handling
    var quizLastError;
    $.ajaxSetup({
        error: function (x, status, error) {
            quizLastError = { error: "Server Error" }
            if (x.status == 403) {
                quizLastError.message = 'Access forbidden: Have you logged out?';
            } else {
                quizLastError.message = x.statusText;
            }
        }
    });

    var quiz = {
        _allocation: [],
        _questions: [],
        _curQuestion: null,
        lectureUrl: "",

        /** Fetch current allocation, either from LocalStorage or server */
        getAllocation: function() {
            quizLastError = null;
            quiz = this;
            $.ajax({
                async: false, //TODO: Can we thread the callbacks properly?
                url: this.lectureUrl + '/quiz-get-allocation',
                dataType: 'json',
                timeout: 3000,
                success: function(data) {
                    quiz._allocation = data.questions
                }
            });
            if (quizLastError) throw quizLastError;
        },

        /** Fetch question by id, either from LocalStorage or server */
        getQuestion: function(questionUid) {
            quizLastError = null;
            quiz = this;
            var questionData;
            $.ajax({
                async: false, //TODO: Can we thread the callbacks properly?
                url: this.lectureUrl + '/quiz-get-question/' + questionUid,
                dataType: 'json',
                timeout: 3000,
                success: function(data) {
                    quiz._curQuestion = data;
                }
            });
            if (quizLastError) throw quizLastError;
        },

        /** Choose a question out of the current allocation */
        chooseQuestion: function() {
            if (!this._allocation.length) {
                throw { error: "Error", message: "No questions allocated" };
            }

            return this._allocation[0].question_uid //TODO: Hi-tech IAA
        }

        /** Prefetch bunch of questions for going offline  */
        offlinePrefetch: function() {
        },

        /** Write back any scores to server, if possible */
        writeBack: function() {
        },
        
        /** Render next question */
        renderNewQuestion: function() {
            this.getAllocation();
            getQuestion(chooseQuestion());
            
            var html = '<p>The set of all rational numbers between 0 and 1 is</p>';
            html += '<ol type="a">';
            html += '<li id="answer_a"><label class="radio"><input type="radio" name="answer" value="a"/>A u B n C \ B = 0</label></li>';
            html += '<li id="answer_b"><label class="radio"><input type="radio" name="answer" value="b"/>A u B n C \ B = 0</label></li>';
            html += '<li id="answer_c"><label class="radio"><input type="radio" name="answer" value="c"/>A u B n C \ B = 0</label></li>';
            html += '</ol>';
            return $(html);
        },

        /** Decrypt answer and display */
        renderAnswer: function(selectedAnswer) {
            //TODO: implementation
            return {
                selectedId: 'answer_' + selectedAnswer,
                correctId: 'answer_' + 'c',
                explanation: "<p>Notice that C = A \\ B</p>",
            };
        },
    }

    $(function() {
        var quizEl = $('#tw-quiz');
        quiz.lectureUrl = quizEl.data('lecture-url');

        var doc = $(document);
        var twProceed = $('#tw-proceed');
        var twQuiz = $('#tw-quiz');
        function errorLabel(s) {
            $('<div class="alert alert-error">'+s+'</div>').insertBefore(twQuiz)
        }
        
        doc.data('tw-state', 'initial');
        twProceed.bind('click', function() {
            var curState = $(document).data('tw-state')
            try {
                switch(curState) {
                    case 'error':
                        window.location.reload(false);
                        break;
                    case 'initial':
                    case 'answered':
                        // User ready for next question
                        var html = quiz.renderNewQuestion();
    
                        twQuiz.attr('class', '');
                        twQuiz.html(html);
                        curState = 'interrogate';
                        break;
                    case 'interrogate':
                        // Disable all controls and mark answer
                        var ans = quiz.renderAnswer($('input:radio[name=answer]:checked').val());
    
                        // Add answer to page
                        twQuiz.find('input').attr('disabled', 'disabled');
                        twQuiz.find('#' + ans.selectedId).addClass('tw-selected');
                        twQuiz.find('#' + ans.correctId).addClass('tw-correct');
                        twQuiz.addClass(ans.selectedId === ans.correctId ? 'correct' : 'incorrect');
                        twQuiz.append($('<div class="alert tw-explanation">' + ans.explanation + '</div>'));
    
                        curState = 'answered';
                        break;
                    default:
                        throw { error: "Error", message: "Unkown state '"+curState+"'" }; 
                }
            } catch(e) {
                errorLabel(e.error + ": " + e.message);
                curState = 'error';
            }

            // Set button to match state
            doc.data('tw-state', curState);
            if (curState === 'initial' || curState === 'answered') {
                twProceed.html("New question >>>");
            } else if (curState === 'interrogate') {
                twProceed.html("Submit answer >>>");
            } else {
                twProceed.html("Restart quiz >>>");
            }
        });
    });
})(window, jQuery);