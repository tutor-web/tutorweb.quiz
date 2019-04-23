/*jslint nomen: true, plusplus: true, browser:true, unparam: true */
/*global require, Promise */
"use strict";
var jQuery = require('jquery');
var View = require('./view.js');
var AjaxApi = require('./ajaxapi.js');
var parse_qs = require('../lib/parse_qs.js').parse_qs;

var $ = jQuery;

// Generate a jQueried DOM element
function el(name) {
    return $(document.createElement(name));
}

function fetchItem(twView, qs, ajaxApi) {
    if (qs.type === 'slide') {
        return ajaxApi.getHtml(qs.url).then(function (docString) {
            twView.jqQuiz.empty().append($('<div class="slide-collection"/>').html(docString));
            twView.jqQuiz.find('.slide-content figure').append(
                $('<button/>').attr('class', 'button').click(function () {
                    $(this).parent().toggleClass('show-code');
                })
            );
            twView.jqQuiz.find('section.slide-content').addClass('selected');
            twView.renderMath();
        });
    }

    if (qs.type === 'question') {
        return ajaxApi.getJson(qs.url).then(function (qn) {
            twView.jqQuiz.empty().append(twView.renderQuestion(qn, {
                ordering: (qn.choices || []).map(function (c, i) { return i; }),
            }));
            if (qn.answer && qn.answer.explanation) {
                twView.jqQuiz.append(el('div').attr('class', 'alert explanation').html(jQuery.parseHTML(qn.answer.explanation)));
            }
            twView.renderMath();
        });
    }

    throw new Error("Cannot fetch " + qs.type + " content");
}

function main(twView) {
    return Promise.resolve().then(function () {
        twView.jqQuiz.addClass('busy');
        return fetchItem(
            twView,
            parse_qs(window.location),
            new AjaxApi($.ajax)
        );
    }).then(function () {
        twView.jqQuiz.removeClass('busy');
    }).catch(function (err) {
        twView.showAlert('error', err.message + ' (retrying in 5 seconds)');
        twView.jqQuiz.removeClass('busy');

        // Wait a bit, try again
        window.setTimeout(main.bind(null, twView), 5000);
        throw err;
    });
}
if (document.body.classList.contains('page-preview')) { main(new View($)); }

