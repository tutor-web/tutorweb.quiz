"use strict";

var getSetting = require('../lib/settings.js').getSetting;

module.exports.test_getSetting = function (test) {
    // Get default values if nothing there
    test.equal(getSetting({}, 'parp', 'ping'), 'ping');
    test.equal(getSetting({}, 'parp', 0.4), 0.4);

    // Otherwise get set value
    test.equal(getSetting({'parp': 'poot'}, 'parp', 'ping'), 'poot');
    test.equal(getSetting({'parp': 0.8}, 'parp', 0.4), 0.8);

    // Non-float values are ignored
    test.equal(getSetting({'parp': 'poot'}, 'parp', 0.4), 0.4);

    test.done();
};
