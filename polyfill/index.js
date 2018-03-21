"use strict";
/*jslint todo: true, regexp: true, browser: true, unparam: true */
/*global Promise */
require('es6-promise').polyfill();
require('whatwg-fetch');
require('custom-event-polyfill');

// https://developer.mozilla.org/en-US/docs/Web/API/Element/matches
if (!Element.prototype.matches) {
    Element.prototype.matches = Element.prototype.msMatchesSelector;
}
