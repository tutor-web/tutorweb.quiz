/*jslint nomen: true, plusplus: true, browser:true, todo:true, regexp: true */
/*global require, module, Promise*/

/** If str is in settings hash and parsable as a float, return that.
  * Otherwise, return defValue
  */
module.exports.getSetting = function getSetting(settings, str, defValue) {
    "use strict";
    if (typeof defValue === 'string') {
        return settings[str] || defValue;
    }

    if (isNaN(parseFloat(settings[str]))) {
        return defValue;
    }

    return parseFloat(settings[str]);
};
