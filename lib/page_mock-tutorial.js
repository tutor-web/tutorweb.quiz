/*jslint nomen: true, plusplus: true, browser:true*/
/*global require */
var jQuery = require('jquery');
var Quiz = require('./quizlib.js');
var AjaxApi = require('./ajaxapi.js');

(function (window, $) {
    "use strict";
    var quiz, ajaxApi;

    // Do nothing if not on the right page
    if ($('body.page-mocktutorial').length === 0) { return; }

    function fieldValue(id) {
        return document.getElementById(id).value;
    }

    ajaxApi = new AjaxApi($.ajax);
    quiz = new Quiz(window.localStorage, ajaxApi);

    $('#tw-proceed').on('click', function () {
        var lecPath = fieldValue('mock-lecture-uri'),
            questions = window.questions || {};

        if (Object.keys(questions).length === 0) {
            window.alert("error: No mock questions defined on this page");
            return;
        }

        quiz.insertTutorial(
            'testfixture:' + fieldValue('mock-tutorial-uri'),
            fieldValue('mock-tutorial-title'),
            [
                {
                    "uri": 'testfixture:' + lecPath,
                    // NB: Nothing ever fetches this - insertTutorial injects
                    // the questions into the ajaxApi cache under it - but that
                    // cache constrains it twice over. It can't be a
                    // testfixture: URI like the lecture is, since Cache Storage
                    // only accepts http(s) keys; and it has to be absolute, or
                    // removeUnusedObjects() won't match it against the absolute
                    // URLs listCached() reports and will garbage collect the
                    // questions we just injected. ploneUrl() is what the cache
                    // resolves with itself, so it matches by construction.
                    "question_uri": ajaxApi.ploneUrl('mock-questions' + lecPath + '/quizdb-all-questions'),
                    "title": fieldValue('mock-lecture-title'),
                    "questions": Object.keys(questions).map(function (uri) {
                        return {
                            "uri": uri,
                            // Give a question "_type": "historical" in
                            // mock-tutorial.html to make the historical
                            // selection probability do something
                            "_type": questions[uri]._type || 'regular',
                            "chosen": 45,
                            "correct": 20
                        };
                    }),
                    "answerQueue": [],
                    "settings": {
                        "hist_sel": fieldValue('mock-histsel')
                    }
                }
            ],
            questions
        ).then(function () {
            window.alert("Inserted mock tutorial, return to the menu to use it");
        })['catch'](function (err) {
            window.alert("error: " + err.message);
        });
    });
}(window, jQuery));
