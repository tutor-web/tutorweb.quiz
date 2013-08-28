/*jslint nomen: true, plusplus: true, browser:true*/
/*global jQuery, Quiz*/
function StartView($, jqQuiz, jqProceed) {
    "use strict";
    this.jqQuiz = jqQuiz;
    this.twProceed = jqProceed;

    /** Generate expanding list for tutorials / lectures */
    this.renderChooseLecture = function (quiz, items, onSelect) {
        var jqSelect, self = this;

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
                if (item.answerQueue && item.answerQueue.length > 0) {
                    jqA.append($('<span class="grade"/>').text(
                        item.answerQueue[item.answerQueue.length - 1].grade_after ||
                             item.answerQueue[item.answerQueue.length - 1].grade_before
                    ));
                }
                jqUl.append($('<li/>')
                        .append(jqA)
                        .append(listToMarkup(item.lectures))
                        );
            }
            return jqUl;
        }

        // Create initial ul
        if (items.length) {
            jqSelect = listToMarkup(items);
            jqSelect.addClass("select-list");
        } else {
            jqSelect = $('<p>You have no tutorials loaded yet. Please visit tutorweb by clicking "Get more tutorials", and choose a department and tutorial</p>');
        }

        // Bind click event to open items / select item.
        jqSelect.bind('click', function (e) {
            var jqTarget = $(e.target);
            e.preventDefault();
            $(this).find(".selected").removeClass("selected");
            self.twProceed.addClass("disabled");
            if (jqTarget.parent().parent()[0] === this) {
                // A 1st level tutorial, Just open/close item
                jqTarget.parent().toggleClass("expanded");
            } else if (e.target.tagName === 'A') {
                // A quiz link, select it
                jqTarget.addClass("selected");
                self.twProceed.removeClass("disabled");
                self.twProceed.attr('href', quiz.quizUrl(jqTarget.parent().parent().prev('a').attr('href'), e.target.href));
            }
        });

        self.jqQuiz.empty().append(jqSelect);
    };
}

(function (window, $, undefined) {
    "use strict";
    var quiz, view;

    // Wire up quiz object
    view = new StartView($, $('#tw-quiz'), $('#tw-proceed'));
    quiz = new Quiz($, localStorage, function (message) {
        window.alert("error: " + message);
    });

    // Point to root of current site
    document.getElementById('tw-home').href = quiz.portalRootUrl(document.location);

    // If button is disabled, do nothing
    $('#tw-proceed').click(function (e) {
        if ($(this).hasClass("disabled")) {
            e.preventDefault();
            return false;
        }
    });

    // Sync all tutorials
    $('#tw-sync').click(function (e) {
        //TODO: Sync tutorials in turn
        e.preventDefault();
        return false;
    });

    // Initial state, show menu of lectures
    quiz.getAvailableLectures(function (lectures) {
        view.renderChooseLecture(quiz, lectures, function (tutUri, lecUri) {
            window.alert(tutUri + '&' + lecUri);
        });
    });
}(window, jQuery));
