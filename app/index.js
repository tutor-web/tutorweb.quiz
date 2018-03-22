"use strict";
/*jslint todo: true, regexp: true, browser: true, unparam: true */
/*global Promise */
var jQuery = require('jquery');
var View = require('lib/view.js');
var renderTex = require('lib/rendertex.js').renderTex;
var AjaxApi = require('lib/ajaxapi.js');
var parse_qs = require('lib/parse_qs.js').parse_qs;

var h = require('hyperscript');

function select_list(orig_data, item_fn) {
    var sl_el;

    function select_list_inner(data) {
        return h('li', [
            item_fn(data),
            (data.children || []).length ? h('ul', data.children.map(select_list_inner)) : null,
        ]);
    }

    function toggle(ul_el) {
        var parent_el = ul_el.parentNode;

        parent_el.classList.toggle('open');
        // NB: 3.5 is the padding around an item, count all possible items
        ul_el.style['max-height'] = parent_el.classList.contains('open') ? 3.5 * sl_el.querySelectorAll('li').length + "rem" : 0;
    }

    sl_el = h('ul.select-list', {onclick: function (e) {
        var link_el = e.target;

        // Find what was clicked on
        while (link_el.nodeName !== 'A') {
            link_el = link_el.parentNode;
        }

        // If this link has a sub-list, toggle that instead of being a link
        if (link_el.nextElementSibling.nodeName === 'UL') {
            e.preventDefault();
            e.stopPropagation();

            toggle(link_el.nextElementSibling);
        }
    }}, (orig_data || []).map(select_list_inner));
    toggle(sl_el.querySelectorAll('ul.select-list > li:first-child > ul')[0]);

    return sl_el;
}

function page_load(e) {
    var ajaxApi = new AjaxApi(jQuery.ajax);

    return ajaxApi.getJson('/api/subscriptions/list').then(function (subscriptions) {
        var section = document.querySelector('main section');

        section.innerHTML = '';
        section.append(h('div', [
            h('h2', 'Your lectures'),
            select_list(subscriptions, function (data) {
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

