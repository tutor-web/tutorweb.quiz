/*jslint nomen: true, plusplus: true, browser:true*/
/*global */
var jQuery = require('jquery');
var Quiz = require('./quizlib.js');

(function (window, $) {
    "use strict";
    function handleError(message) {
        window.alert("error: " + message);
    }

    // Do nothing if not on the right page
    if ($('body.page-mocktutorial').length === 0) { return; }

    var quiz = new Quiz(window.localStorage, handleError);
    $('#tw-proceed').bind('click', function () {
        quiz.insertTutorial(
            'testfixture:' + document.getElementById('mock-tutorial-uri').value,
            document.getElementById('mock-tutorial-title').value,
            [
                {
                    "uri": 'testfixture:' + document.getElementById('mock-lecture-uri').value,
                    "sync_uri": null,
                    "title": document.getElementById('mock-lecture-title').value,
                    "slide_uri": "http://localhost:8000/mock-slides.html",
                    "questions": Object.keys(window.questions).map(function (e) {
                        return {"uri": e, "chosen": 45, "correct": 20};
                    }),
                    "answerQueue": [],
                    "settings": {
                        "hist_sel": document.getElementById('mock-histsel').value
                    }
                }
            ]
        );
        quiz.insertQuestions(window.questions);
        window.alert("Finished!");
    });
}(window, jQuery));
