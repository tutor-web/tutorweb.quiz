"use strict";
/*jslint todo: true, regexp: true, nomen: true */

module.exports.parse_qs = function (location) {
    var out = {};

    if (location.pathname) {
        out._doc = location.pathname.replace(/^.*\//, '');
    }

    [].concat(
        (location.search || '').replace(/^\?/, '').split(/;|&/),
        (location.hash || '').replace(/^\#!?/, '').split(/;|&/)
    ).filter(function (str) {
        // Remove empty entries from an empty search/hash
        return str.length > 0;
    }).map(function (str) {
        var m = /(.*?)\=(.*)/.exec(str);

        if (m) {
            out[m[1]] = decodeURIComponent(m[2]);
        } else {
            if (!out._args) {
                out._args = [];
            }
            out._args.push(str);
        }
    });
    return out;
};
