"use strict";
/*jslint todo: true, regexp: true, browser: true */
/*global Promise */
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

module.exports.select_list = select_list;
