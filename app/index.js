"use strict";
/*jslint todo: true, regexp: true, browser: true, unparam: true */
/*global Promise */
var h = require('hyperscript');
var jQuery = require('jquery');
var AjaxApi = require('lib/ajaxapi.js');
var select_list = require('lib/select_list.js').select_list;

function page_load(e) {
    var ajaxApi = new AjaxApi(jQuery.ajax);

    return ajaxApi.getJson('/api/subscriptions/list').then(function (subscriptions) {
        var section = document.querySelector('main section');

        section.innerHTML = '';
        section.append(h('div', [
            h('h2', 'Your lectures'),
            select_list(subscriptions.children, function (data) {
                return h('a', {
                    href: data.href ? '/stage?path=' + encodeURIComponent(data.href) : '#',
                }, [
                    data.title,
                    h('span.grade', data.grade),
                ]);
            }),
        ]));
    }).then(function () {
        document.body.classList.remove('busy');
    });
}

if (window) {
    document.addEventListener('DOMContentLoaded', page_load);
}

