/*jslint nomen: true, plusplus: true, browser:true*/
/*global jQuery, MathJax*/
var Quiz = require('./quizlib.js');
var View = require('./view.js');
var QS = require("querystring");

/**
  * View class to translate data into DOM structures
  *    $: jQuery
  *    jqQuiz: jQuery-wrapped <form id="tw-quiz">
  *    jqActions: <ul> that contains action buttons
  */
function SlideView($) {
    "use strict";
    this.renderSlide = function (url) {
        var self = this,
            request = new XMLHttpRequest();

        request.open('GET', url, true);
        request.onload = function() {
          if (request.status >= 200 && request.status < 400){
            self.jqQuiz.html(request.responseText);
            self.jqQuiz.removeClass('busy');
          } else {
            throw "tutorweb::error::" + request.status + " whilst requesting " + url;
          }
        };
        request.onerror = function(event) {
             throw "tutorweb::error::Could not fetch " + url;
        };
        request.send();
    };
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
    twView.stateMachine(function updateState(curState, fallback) {
        switch (curState) {
        case 'initial':
            this.updateActions(['gohome']);
            var qs = QS.decode(window.location.search.replace(/^\?/, ''));
            if(qs.slideUrl) {
                twView.renderSlide(qs.slideUrl);
            }
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
