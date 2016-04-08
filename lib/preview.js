/*jslint nomen: true, plusplus: true, browser:true, unparam: true */
/*global require */
var jQuery = require('jquery');
var View = require('./view.js');
var AjaxApi = require('./ajaxapi.js');

(function (window, $) {
    "use strict";
    var twView;

    function promiseFatalError(err) {
        setTimeout(function () {
            throw err;
        }, 0);
        throw err;
    }

    function renderSlide(jqSlide) {
        twView.jqQuiz.empty().append(jqSlide);
        twView.renderMath();
        twView.jqQuiz.find('.slide-content figure').click(function () {
            $(this).toggleClass('show-code');
        });
    }

    function fetchItem(qs, ajaxApi) {
        if (qs.type === 'slide') {
            return ajaxApi.getHtml(qs.url).then(function (docString) {
                renderSlide($('<div class="slide-collection"/>').html(docString));
                twView.jqQuiz.find('section.slide-content').addClass('selected');
            });
        }

        throw new Error("Cannot fetch " + qs.type + " content");
    }

    if ($('body.page-preview').length === 0) { return; }
    twView = new View($);
    fetchItem(
        twView.parseQS(window.location),
        new AjaxApi($.ajax)
    ).then(function () {
        twView.jqQuiz.removeClass('busy');
    })['catch'](promiseFatalError);
}(window, jQuery));
