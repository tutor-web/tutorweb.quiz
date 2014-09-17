/*jslint nomen: true, plusplus: true, browser:true*/
/* global require, jQuery */
var Quiz = require('./quizlib.js');
var View = require('./view.js');

function StartView($) {
    "use strict";

    // Generate a jQueried DOM element
    function el(name) {
        return $(document.createElement(name));
    }

    /** Generate expanding list for tutorials / lectures */
    this.renderChooseLecture = function (items) {
        var self = this;

        // Error message if there's no items
        if (!items.length) {
            throw new Error('tutorweb::info::You have no tutorials loaded yet. Please visit tutorweb by clicking "Get more tutorials", and choose a department and tutorial');
        }

        // [[href, title, items], [href, title, items], ...] => markup
        // items can also be {uri: '', title: ''}
        function listToMarkup(items) {
            var i, jqA, item, jqUl = $('<ul/>');
            if (typeof items === 'undefined') {
                return null;
            }
            for (i = 0; i < items.length; i++) {
                item = items[i];
                jqA = $('<a/>').attr('href', item.uri).text(item.title);
                if (item.grade) {
                    jqA.append($('<span class="grade"/>').text(item.grade));
                }
                jqUl.append($('<li/>')
                        .toggleClass('expanded', items.length === 1)
                        .append(jqA)
                        .append(listToMarkup(item.lectures))
                        );
            }
            return jqUl;
        }

        // Recursively turn tutorials, lectures into a ul, populate existing ul.
        self.jqQuiz.empty().append([
            el('ul').attr('class', 'select-list')
                    .append(listToMarkup(items).children()),
            el('button').addClass("show-grades").text("Show grades").click(function (e) {
                self.jqQuiz.toggleClass('show-grades');
                $(e.target).text(self.jqQuiz.hasClass('show-grades') ? "Hide grades" : "Show grades");
            }),
            null
        ]);
    };
}
StartView.prototype = new View(jQuery);

(function (window, $, undefined) {
    "use strict";
    var quiz, twView,
        unsyncedLectures = [],
        jqQuiz = $('#tw-quiz'),
        jqLogout = $('#tw-logout'),
        jqProceed = $('#tw-proceed'),
        jqDelete = $('#tw-delete'),
        jqViewSlides = $('#tw-view-slides');

    // Do nothing if not on the right page
    if ($('body.quiz-start').length === 0) { return; }

    // Wire up quiz object
    twView = new StartView($);
    window.onerror = twView.errorHandler();
    quiz = new Quiz(localStorage);

    // Refresh menu, both on startup and after munging quizzes
    function refreshMenu() {
        quiz.getAvailableLectures(function (tutorials) {
            twView.renderChooseLecture(tutorials);

            // Get all lecture titles from unsynced lectures
            unsyncedLectures = [].concat.apply([], tutorials.map(function (t) {
                return (t.lectures.filter(function (l) { return !l.synced; })
                                  .map(function (l) { return l.title; }));
            }));
        });
    }

    // Point to root of current site
    document.getElementById('tw-home').href = quiz.portalRootUrl(document.location);

    // If button is disabled, do nothing
    $('#tw-actions > *').click(function (e) {
        if ($(this).hasClass("disabled")) {
            e.preventDefault();
            return false;
        }
    });

    // Logout should log out of Plone, but after asking first
    jqLogout.attr('href', quiz.portalRootUrl(document.location) + '/logout');
    jqLogout.click(function (e) {
        var unSyncedLecture = unsyncedLectures[0];

        if (unSyncedLecture && !window.confirm("Your answers to " + unSyncedLecture + " haven't been sent to the Tutor-Web server.\nIf you click okay some answers will be lost")) {
            e.preventDefault();
            return false;
        }

        localStorage.clear();
        return true;
    });

    // Remove selected tutorial
    jqDelete.click(function (e) {
        var self = this;
        if ($(this).hasClass("disabled")) {
            e.preventDefault();
            return false;
        }
        //TODO: Sync first
        quiz.removeTutorial($(self).data('tutUri'));
        refreshMenu();
        jqProceed.addClass("disabled");
        jqDelete.addClass("disabled");
    });

    // Click on the select box opens / closes items
    jqQuiz.click(function (e) {
        var jqTarget = $(e.target);
        e.preventDefault();
        jqQuiz.find(".selected").removeClass("selected");
        jqProceed.addClass("disabled");
        jqDelete.addClass("disabled");
        jqViewSlides.addClass("disabled");
        if (jqTarget.parent().parent().hasClass('select-list')) {
            // A 1st level tutorial, Just open/close item
            jqTarget.parent().toggleClass("expanded");
            if (jqTarget.parent().hasClass("expanded")) {
                jqDelete.data('tutUri', e.target.href);
                jqDelete.removeClass("disabled");
            }
        } else if (e.target.tagName === 'A' || e.target.tagName === 'SPAN') {
            if (e.target.tagName === 'SPAN') {
                jqTarget = jqTarget.parent('a');
            }
            // A quiz link, select it
            jqTarget.addClass("selected");
            jqProceed.removeClass("disabled");
            jqDelete.removeClass("disabled");
            jqProceed.attr('href', jqTarget.attr('href'));
            jqViewSlides.removeClass("disabled");
            jqViewSlides.attr('href', jqTarget.attr('href').replace(/quiz\.html/, 'slide.html'));
        }
    });

    refreshMenu();

}(window, jQuery));
