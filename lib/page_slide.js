/*jslint nomen: true, plusplus: true, browser:true, unparam: true */
/*global require */
var jQuery = require('jquery');
var Quiz = require('./quizlib.js');
var View = require('./view.js');
var AjaxApi = require('./ajaxapi.js');
var UserMenu = require('./usermenu.js');

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
        self.jqQuiz.find('.slide-content figure').append(
            $('<button/>').attr('class', 'button').click(function () {
                $(this).parent().toggleClass('show-code');
            })
        );
    };

    this.selectSlide = function (slideId) {
        var self = this, jqPrevId, jqNextId,
            jqPrevButton = self.jqQuiz.find('#tw-slide-prev'),
            jqNextButton = self.jqQuiz.find('#tw-slide-next'),
            jqCollection = self.jqQuiz.find('.slide-collection').children();

        if (jqCollection.length === 0) {
            throw new Error("tutorweb::error::This lecture has no slides");
        }

        jqCollection.map(function (i, sl) {
            var jqSl = $(sl);
            if ((slideId === "" && i === 0) || (slideId === jqSl.attr('id'))) {
                jqSl.addClass('selected');
                slideId = jqSl.attr('id');
                $("#tw-slide-title").text(jqSl.find('h2').text());

                jqPrevId = jqSl.prev().attr('id');
                jqPrevButton.attr('href', self.generateUrl({slide: (jqPrevId || slideId)}));
                jqPrevButton.toggleClass('disabled', jqPrevId === undefined);

                jqNextId = jqSl.next().attr('id');
                jqNextButton.attr('href', self.generateUrl({slide: (jqNextId || slideId)}));
                jqNextButton.toggleClass('disabled', jqNextId === undefined);
            } else {
                jqSl.removeClass('selected');
            }
        });
    };
}
SlideView.prototype = new View(jQuery);

(function (window, $) {
    "use strict";
    var quiz, twView, twMenu;

    // Do nothing if not on the right page
    if ($('body.page-slide').length === 0) { return; }

    // Wire up quiz object
    twView = new SlideView($);

    // Start state machine
    twView.states.initial = function () {
        twView.initialUrl = twView.curUrl;
        // Create Quiz model
        quiz = new Quiz(localStorage, new AjaxApi($.ajax));
        twMenu = new UserMenu($('#tw-usermenu'), quiz);
        twMenu.noop = 1; // NB: Keep JSLint quiet
        return 'fetch-slides';
    };

    twView.states['fetch-slides'] = function () {
        this.updateActions(['gohome', 'go-drill']);
        return quiz.setCurrentLecture({lecUri: twView.curUrl.lecUri}).then(function (args) {
            $("#tw-title").text(args.lecTitle);

            return quiz.fetchSlides();
        }).then(function (docString) {
            var doc = $('<div/>').html(docString);
            twView.renderSlides(doc.find('.slide-collection'));
            twView.selectSlide(twView.curUrl.slide || '');
        });
    };

    twView.states['hash-change'] = function () {
        if (twView.initialUrl.tutUri === twView.curUrl.tutUri ||
                twView.initialUrl.lecUri === twView.curUrl.lecUri) {
            twView.selectSlide(twView.curUrl.slide || '');
        } else {
            // Changed lecture, so reload
            // NB: Ideally this would use default hash-change
            window.location.reload(false);
        }
    };

    twView.stateMachine();
}(window, jQuery));
