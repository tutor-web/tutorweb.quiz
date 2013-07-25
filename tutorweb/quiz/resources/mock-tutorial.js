/*jslint nomen: true, plusplus: true, browser:true*/
/*global $, jQuery*/

(function (window, $) {
    "use strict";
    function handleError (message) {
        window.alert("error: " + message);
    };

    var quiz = new Quiz($.ajax, window.localStorage, handleError);
    $('#tw-proceed').bind('click', function (event) {
        var i, questions = {
            "testfixture:question-allocation/b55c2b163f836f0bd1f517ff44dcc791" : {
                "answer": "eyJleHBsYW5hdGlvbiI6ICI8ZGl2PlxuVGhlIHN5bWJvbCBmb3IgdGhlIHNldCBvZiBhbGwgaXJyYXRpb25hbCBudW1iZXJzXG48L2Rpdj4iLCAiY29ycmVjdCI6IFswXX0=",
                "text": '<div>The symbol for the set of all irrational numbers is...</div>',
                "choices": [
                    '<div>$\mathbb{R} \backslash \mathbb{Q}$</div>',
                    '<div>$\mathbb{Q} \backslash \mathbb{R}$</div>',
                    '<div>$\mathbb{N} \cap \mathbb{Q}$</div>' ],
                "fixed_order": [],
                "random_order": [0,1,2] }
            };

        quiz.insertTutorial(
            'testfixture:' + document.getElementById('mock-tutorial-uri').value,
            document.getElementById('mock-tutorial-title').value, [
                {
                    "uri": 'testfixture:' + document.getElementById('mock-lecture-uri').value,
                    "title": document.getElementById('mock-lecture-title').value,
                    "questions": Object.keys(questions).map(function(e) {
                        return {"uri": e, "chosen": 45, "correct": 20}
                    }),
                    "histsel": document.getElementById('mock-histsel').value }
            ]);
        quiz.insertQuestions(questions);
    });
})(window, jQuery);
