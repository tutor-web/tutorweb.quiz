/*jslint nomen: true, plusplus: true, browser:true*/
/*global jQuery, Quiz*/

(function (window, $) {
    "use strict";
    var quiz, jqStatus, jqBar;

    // Wire up quiz object
    quiz = new Quiz($, localStorage, function (message) {
        window.alert("error: " + message);
    });

    jqStatus = $('#load-status');
    jqBar = $('#load-bar');

    function updateState(state, message) {
        jqStatus[0].className = state;
        jqStatus.text(message);
        if (state === 'ready') {
            jqBar.css({"width": "100%"});
            $('#tw-proceed').addClass("ready");
        }
    }

    function handleError(message) {
        updateState('error', message);
    }

    /** Download all questions associated to lecture */
    function downloadQuestions(url) {
        updateState("active", "Downloading lectures...");
        $.ajax({
            type: "GET",
            cache: false,
            url: url,
            error: handleError,
            success: function (data) {
                quiz.insertQuestions(data);
                updateState("ready", "Press the button to start your quiz");
            },
        });
    }

    /** Download a lecture given by URL */
    function downloadLecture(url) {
        updateState("active", "Downloading questions...");
        $.ajax({
            type: "GET",
            cache: false,
            url: url,
            error: handleError,
            success: function (data) {
                quiz.insertTutorial('moo:TODO', 'Tutorial Title', [data]);
                $('#tw-proceed').attr('href', quiz.quizUrl('moo:TODO', url));
                if (data.question_uri) {
                    downloadQuestions(data.question_uri);
                } else {
                    updateState("error", "No link to questions");
                }
            },
        });
    }

    window.localStorage.clear(); //TODO: Hack!
    downloadLecture(window.location.search.replace(/^\??/, ""));
}(window, jQuery));
