/*jslint nomen: true, plusplus: true, browser:true*/
/* global require, jQuery */
var Quiz = require('./quizlib.js');
var View = require('./view.js');

/**
  * View class to translate data into DOM structures
  *    $: jQuery
  *    jqQuiz: jQuery-wrapped <form id="tw-quiz">
  *    jqActions: <ul> that contains action buttons
  */
function SlideView($) {
    "use strict";
    this.renderSlides = function (jqSlides) {
        var self = this;

        self.jqQuiz.find('.slide-collection').replaceWith(jqSlides);
        self.renderMath();
        self.jqQuiz.find('.slide-content figure').click(function () {
            $(this).toggleClass('show-code');
        });
    };

    this.selectSlide = function (slideId) {
        var self = this, jqPrevId, jqNextId,
            jqPrevButton = self.jqQuiz.find('#tw-slide-prev'),
            jqNextButton = self.jqQuiz.find('#tw-slide-next'),
            jqCollection = self.jqQuiz.find('.slide-collection').children();

        jqCollection.map(function (i, sl) {
            var jqSl = $(sl);
            if ((slideId === "" && i === 0) || (slideId === jqSl.attr('id'))) {
                jqSl.addClass('selected');
                slideId = jqSl.attr('id');
                $("#tw-slide-title").text(jqSl.find('h2').text());

                jqPrevId = jqSl.prev().attr('id');
                jqPrevButton.attr('href', '#' + (jqPrevId || slideId));
                jqPrevButton.toggleClass('disabled', typeof jqPrevId == 'undefined');

                jqNextId = jqSl.next().attr('id');
                jqNextButton.attr('href', '#' + (jqNextId || slideId));
                jqNextButton.toggleClass('disabled', typeof jqNextId == 'undefined');
            } else {
                jqSl.removeClass('selected');
            }
        });
    };
}
SlideView.prototype = new View(jQuery);

(function (window, $, undefined) {
    "use strict";
    var quiz, twView;

    /** Call an array of Ajax calls, splicing in extra options, onProgress called on each success, onDone at end */
    function callAjax(calls, extra, onProgress, onDone) {
        var handleError = function (jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 401 || jqXHR.status === 403) {
                throw "tutorweb::error::Unauthorized to fetch " + this.url;
            } else {
                throw "tutorweb::error::Could not fetch " + this.url;
            }
        };

        var dfds = calls.map(function (a) {
            return $.ajax($.extend({error: handleError}, a, extra));
        });
        if (dfds.length === 0) {
            onDone();
        } else {
            dfds.map(function (d) { d.done(onProgress); });
            $.when.apply(null, dfds).done(onDone);
        }
    }

    // Do nothing if not on the right page
    if ($('body.page-slide').length === 0) { return; }

    // Wire up quiz object
    twView = new SlideView($);
    window.onerror = twView.errorHandler();

    // Create Quiz model
    quiz = new Quiz(localStorage);

    // Start state machine
    twView.stateMachine(function updateState(curState, fallback) {
        switch (curState) {
        case 'initial':
            this.updateActions(['gohome', 'go-drill']);
            quiz.setCurrentLecture(quiz.parseQS(window.location), function (continuing, tutUri, tutTitle, lecUri, lecTitle) {
                $("#tw-title").text(tutTitle + " - " + lecTitle);
                updateState('fetch-slides');
            });
            break;
        case 'fetch-slides':
            callAjax([quiz.fetchSlides()], {}, function () {}, function (docString) {
                var doc = $('<div/>').html(docString);
                twView.renderSlides(doc.find('.slide-collection'));
                twView.selectSlide(window.location.hash.replace(/^#!?/, ""));
            });
            break;
        default:
            fallback(curState);
        }
    });

    window.onhashchange = function () {
        twView.selectSlide(window.location.hash.replace(/^#!?/, ""));
    };
}(window, jQuery));
