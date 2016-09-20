/*jslint nomen: true, plusplus: true, browser:true, unparam: true */
/*global require */
var jQuery = require('jquery');
var View = require('./view.js');
var AjaxApi = require('./ajaxapi.js');
var parse_qs = require('../lib/parse_qs.js').parse_qs;

(function (window, $) {
    "use strict";
    var twView;

    // Generate a jQueried DOM element
    function el(name) {
        return $(document.createElement(name));
    }

    function promiseFatalError(err) {
        setTimeout(function () {
            throw err;
        }, 0);
        throw err;
    }

    function renderSlide(jqSlide) {
        twView.jqQuiz.empty().append(jqSlide);
        twView.renderMath();
        twView.jqQuiz.find('.slide-content figure').append(
            $('<button/>').attr('class', 'button').click(function () {
                $(this).parent().toggleClass('show-code');
            })
        );
    }

    function fetchItem(qs, ajaxApi) {
        if (qs.type === 'slide') {
            return ajaxApi.getHtml(qs.url).then(function (docString) {
                renderSlide($('<div class="slide-collection"/>').html(docString));
                twView.jqQuiz.find('section.slide-content').addClass('selected');
            });
        }

        if (qs.type === 'question') {
            return ajaxApi.getJson(qs.url).then(function (qn) {
                twView.jqQuiz.empty().append(twView.renderQuestion(qn, {
                    ordering: qn.choices.map(function (c, i) { return i; }),
                }));
                twView.jqQuiz.append(el('div').attr('class', 'alert explanation').html(jQuery.parseHTML(qn.answer.explanation)));
                twView.renderMath();
            });
        }

        throw new Error("Cannot fetch " + qs.type + " content");
    }

    if ($('body.page-preview').length === 0) { return; }
    twView = new View($);
    fetchItem(
        parse_qs(window.location),
        new AjaxApi($.ajax)
    ).then(function () {
        twView.jqQuiz.removeClass('busy');
    })['catch'](promiseFatalError);
}(window, jQuery));
