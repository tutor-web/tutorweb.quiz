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
            var i, item, jqUl = $('<ul/>');
            if (typeof items === 'undefined') {
                return null;
            }
            for (i = 0; i < items.length; i++) {
                item = items[i];
                jqUl.append($('<li/>')
                        .append($('<a/>')
                            .attr('href', item[0] || item.uri)
                            .text(item[1] || item.title))
                        .append(listToMarkup(item[2]))
                        );
            }
            return jqUl;
        }

        // Create initial ul
        jqSelect = listToMarkup(items);
        jqSelect.addClass("select-list");

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

    // Initial state, show menu of lectures
    quiz.getAvailableLectures(function (lectures) {
        view.renderChooseLecture(quiz, lectures, function (tutUri, lecUri) {
            window.alert(tutUri + '&' + lecUri);
        });
    });
}(window, jQuery));
