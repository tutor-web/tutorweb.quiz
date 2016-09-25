/*jslint nomen: true, plusplus: true, browser:true, regexp: true, todo: true */
"use strict";

// Based on http://crocodillon.com/blog/always-catch-localstorage-security-and-quota-exceeded-errors
module.exports.isQuotaExceededError = function (e) {
    if (!e) {
        return false;
    }
    if (e.code === 22) {
        return true;
    }
    if (e.code === 1014 && e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        // Firefox
        return true;
    }
    if (e.number === -2147024882) {
        // IE8
        return true;
    }
    return false;
};
