/*jslint nomen: true, plusplus: true, browser:true*/
/*global jQuery, Quiz*/

(function (window, $) {
    "use strict";
    function handleError(message) {
        window.alert("error: " + message);
    }

    var jqStatus = $('#load-status'),
        jqBar = $('#load-bar'),
        quiz = new Quiz($.ajax, window.localStorage, handleError);

    function updateState(state, message) {
        jqStatus[0].className = state;
        jqStatus.text(message);
        if (state === 'ready') {
            jqBar.css({"width": "100%"});
            $('#tw-proceed').addClass("ready");
        }
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
