/*jslint nomen: true, plusplus: true, browser:true*/
/*global jQuery, MathJax*/
var Quiz = require('./quizlib.js');
var View = require('./view.js');

/**
  * View class to translate data into DOM structures
  *    $: jQuery
  *    jqQuiz: jQuery-wrapped <form id="tw-quiz">
  *    jqActions: <ul> that contains action buttons
  */
function SlideView($) {
    "use strict";
}
SlideView.prototype = new View($);

(function (window, $, undefined) {
    "use strict";
    var twView;

    // Do nothing if not on the right page
    if ($('body.page-slide').length === 0) { return; }

    // Wire up quiz object
    twView = new SlideView($);
    window.onerror = twView.errorHandler();

    // Start state machine
    twView.stateMachine(function (curState, fallback) {
        switch (curState) {
        case 'initial':
            this.updateActions(['camel']);
            break;
        case 'camel':
            throw "Don't press that!";
        case 'next-slide':
        case 'prev-slide':
            break;
        default:
            fallback(curState);
        }
    });
}(window, jQuery));
