"use strict";
/*jslint todo: true, regexp: true, browser: true, unparam: true */
/*global Promise */
var jQuery = require('jquery');
var View = require('lib/view.js');
var renderTex = require('lib/rendertex.js').renderTex;
var AjaxApi = require('lib/ajaxapi.js');
var parse_qs = require('lib/parse_qs.js').parse_qs;

function page_load(e) {
    var twView = new View(jQuery),
        ajaxApi = new AjaxApi(jQuery.ajax),
        qs = parse_qs(window.location);

    return ajaxApi.getJson('/api/material/render?path=' + encodeURIComponent(qs.path) + '&permutation=' + encodeURIComponent(qs.permutation)).then(function (material) {
        console.log(material);
        twView.jqQuiz.html(material.content);
        twView.renderMath();
    }).then(function () {
        twView.jqQuiz.removeClass('busy');
    });
}

if (window) {
    document.addEventListener('DOMContentLoaded', page_load);
}
