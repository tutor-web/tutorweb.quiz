/*jslint nomen: true, plusplus: true, browser:true */
/*global require */
var jQuery = require('jquery');
var View = require('./view.js');

(function (window, $) {
    "use strict";
    var twView,
        jqQuiz = $('#tw-quiz');

    // Do nothing if not on the right page
    if ($('body.quiz-offline').length === 0) { return; }

    // Wire up quiz object
    twView = new View($);

    jqQuiz.text("Checking manifest...");

    window.applicationCache.addEventListener('cached', function () {
        jqQuiz.text("Offline support now enabled");
        twView.updateActions(['gohome']);
    }, false);

    window.applicationCache.addEventListener('updateready', function () {
        jqQuiz.text("Offline support enabled, latest version downloaded");
        twView.updateActions(['gohome']);
    }, false);

    window.applicationCache.addEventListener('noupdate', function () {
        jqQuiz.text("Offline support already enabled (no update)");
        twView.updateActions(['gohome']);
    }, false);
}(window, jQuery));
