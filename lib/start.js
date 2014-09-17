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
                e.stopPropagation();
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
        jqQuiz = $('#tw-quiz');

    // Do nothing if not on the right page
    if ($('body.quiz-start').length === 0) { return; }

    // Wire up quiz object
    twView = new StartView($);
    window.onerror = twView.errorHandler();
    quiz = new Quiz(localStorage);

    // Click on the select box opens / closes items
    jqQuiz.click(function (e) {
        var jqTarget = $(e.target);
        e.preventDefault();
        jqQuiz.find(".selected").removeClass("selected");
        twView.updateActions([]);

        if (jqTarget.parent().parent().hasClass('select-list')) {
            // A 1st level tutorial, Just open/close item
            jqTarget.parent().toggleClass("expanded");
        } else if (e.target.tagName === 'A' || e.target.tagName === 'SPAN') {
            // A quiz link, select it
            if (e.target.tagName === 'SPAN') {
                jqTarget = jqTarget.parent('a');
            }
            jqTarget.addClass("selected");
            twView.updateActions(['go-slides', 'go-drill']);
        }
    });

    // Start state machine
    twView.stateMachine(function updateState(curState, fallback) {
        switch (curState) {
        case 'initial':
            updateState('lecturemenu', fallback);
            break;
        case 'lecturemenu':
            quiz.getAvailableLectures(function (tutorials) {
                twView.renderChooseLecture(tutorials);

                // Get all lecture titles from unsynced lectures
                unsyncedLectures = [].concat.apply([], tutorials.map(function (t) {
                    return (t.lectures.filter(function (l) { return !l.synced; })
                                      .map(function (l) { return l.title; }));
                }));
            });
            break;
        case 'logout':
            if (unsyncedLectures.length === 0 || window.confirm("Your answers to " + unsyncedLectures[0] + " haven't been sent to the Tutor-Web server.\nIf you click okay some answers will be lost")) {
                localStorage.clear();
                window.location.href = quiz.portalRootUrl(document.location) + '/logout';
            }
            break;
        case 'go-slides':
        case 'go-drill':
            var search = jqQuiz.find('a.selected').attr('href');
            search = search.substring(search.indexOf('?'));
            window.location.href = (curState === 'go-slides' ? 'slide.html' : 'quiz.html') + search;
            break;
        case 'go-twhome':
            window.location.href = quiz.portalRootUrl(document.location);
            break;
        default:
            fallback(curState);
        }
    });

}(window, jQuery));
