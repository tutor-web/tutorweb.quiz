(function (window, $, undefined) {
    "use strict";
    var quiz = {
        _allocation: [],
        _questions: [],
        lectureUrl: "",

        /** Fetch current allocation, either from LocalStorage or server */
        getAllocation: function() {
            //Woo
        },

        /** Prefetch bunch of questions for going offline  */
        offlinePrefetch: function() {
        },

        /** Write back any scores to server, if possible */
        writeBack: function() {
        },
        
        /** Render next question */
        renderNewQuestion: function() {
            var html = '<p>The set of all rational numbers between 0 and 1 is</p>';
            html += '<ol type="a">';
            html += '<li id="answer_a"><label class="radio"><input type="radio" name="answer" value="a"/>A u B n C \ B = 0</label></li>';
            html += '<li id="answer_b"><label class="radio"><input type="radio" name="answer" value="b"/>A u B n C \ B = 0</label></li>';
            html += '<li id="answer_c"><label class="radio"><input type="radio" name="answer" value="c"/>A u B n C \ B = 0</label></li>';
            html += '</ol>';
            return $(html);
        },

        /** Decrypt answer and display */
        revealAnswer: function(selAnswer) {
            //TODO: implementation
            return {
                selectedId: 'answer_' + selAnswer,
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
            $('<div class="alert alert-error">Error: '+s+'</div>').insertBefore(twQuiz)
        }

        doc.data('tw-state', 'initial');
        twProceed.bind('click', function() {
            var curState = $(document).data('tw-state')
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
                    twQuiz.find('input').attr('disabled', 'disabled');
                    var ans = quiz.revealAnswer($('input:radio[name=answer]:checked').val());

                    // Add answer to page
                    twQuiz.addClass(ans.selectedId === ans.correctId ? 'correct' : 'incorrect');
                    twQuiz.find('#' + ans.selectedId).addClass('tw-selected');
                    twQuiz.find('#' + ans.correctId).addClass('tw-correct');
                    twQuiz.append($('<div class="alert tw-explanation">' + ans.explanation + '</div>'));

                    curState = 'answered';
                    break;
                default:
                    //TODO: Exception handler instead?
                    errorLabel("Unkown state '"+curState+"'");
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