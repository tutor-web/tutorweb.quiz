/*jslint nomen: true, plusplus: true, browser:true*/
/*global jQuery, Quiz*/
function StartView($, jqQuiz, jqSelect) {
    "use strict";
    this.jqQuiz = jqQuiz;
    this.jqSelect = jqSelect;

    /** Put an alert div at the top of the page */
    this.renderAlert = function (type, message) {
        var self = this;
        self.jqQuiz.children('div.alert').remove();
        self.jqQuiz.prepend($('<div class="alert">')
            .addClass("alert-" + type)
            .text(message));
    };

    /** Generate expanding list for tutorials / lectures */
    this.renderChooseLecture = function (quiz, items) {
        var self = this;
        self.jqSelect.empty();

        // Error message if there's no items
        if (!items.length) {
            self.renderAlert("info", 'You have no tutorials loaded yet. Please visit tutorweb by clicking "Get more tutorials", and choose a department and tutorial');
            return;
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
                        .append(jqA)
                        .append(listToMarkup(item.lectures))
                        );
            }
            return jqUl;
        }

        // Recursively turn tutorials, lectures into a ul, populate existing ul.
        self.jqSelect.append(listToMarkup(items).children());
    };
}

(function (window, $, undefined) {
    "use strict";
    var quiz, view,
        jqQuiz = $('#tw-quiz'),
        jqSelect = $('#tw-select'),
        jqProceed = $('#tw-proceed'),
        jqSync = $('#tw-sync'),
        jqDelete = $('#tw-delete');

    // Wire up quiz object
    view = new StartView($, jqQuiz, jqSelect);
    quiz = new Quiz(localStorage, function (message) {
        view.renderAlert("error", message);
    });

    // Refresh menu, both on startup and after munging quizzes
    function refreshMenu() {
        quiz.getAvailableLectures(function (lectures) {
            view.renderChooseLecture(quiz, lectures);
        });
    }
    refreshMenu();

    // Point to root of current site
    document.getElementById('tw-home').href = quiz.portalRootUrl(document.location);

    // If button is disabled, do nothing
    jqProceed.click(function (e) {
        if ($(this).hasClass("disabled")) {
            e.preventDefault();
            return false;
        }
    });

    // Sync all tutorials
    jqSync.click(function (e) {
        //TODO: Sync tutorials in turn
        e.preventDefault();
        return false;
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
    jqSelect.click(function (e) {
        var jqTarget = $(e.target);
        e.preventDefault();
        jqSelect.find(".selected").removeClass("selected");
        jqProceed.addClass("disabled");
        jqDelete.addClass("disabled");
        if (jqTarget.parent().parent()[0] === this) {
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
        }
    });

}(window, jQuery));
