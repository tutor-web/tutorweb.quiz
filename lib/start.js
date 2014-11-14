/*jslint nomen: true, plusplus: true, browser:true */
/*global require */
var jQuery = require('jquery');
var Quiz = require('./quizlib.js');
var View = require('./view.js');
var Promise = require('es6-promise').Promise;
var AjaxApi = require('./ajaxapi.js');

function StartView($) {
    "use strict";

    // Generate a jQueried DOM element
    function el(name) {
        return $(document.createElement(name));
    }

    /** Generate expanding list for tutorials / lectures */
    this.renderChooseLecture = function (items) {
        var self = this;

        // [[href, title, items], [href, title, items], ...] => markup
        // items can also be {uri: '', title: ''}
        function listToMarkup(items, urlPartNames, urlPartBase) {
            if (items === undefined) {
                return null;
            }
            return el('ul').append(items.map(function (item) {
                var urlParts = $.extend({}, urlPartBase);
                urlParts[urlPartNames[0]] = item.uri;

                return (el('li').append([
                    el('a').attr('href', self.generateUrl(urlParts)).text(item.title).append([
                        item.grade ? el('span').addClass('grade').text(item.grade) : null
                    ]),
                    listToMarkup(item.lectures, urlPartNames.slice(1), urlParts),
                    null
                ]).toggleClass('expanded', items.length === 1)
                  .toggleClass('unsynced', item.hasOwnProperty('synced') && !item.synced));
            }));
        }

        // Recursively turn tutorials, lectures into a ul, populate existing ul.
        self.jqQuiz.empty().append([
            listToMarkup(items, ['tutUri', 'lecUri'], {}).attr('class', 'select-list'),
            el('button').addClass("show-grades").text("Show grades").click(function (e) {
                e.stopPropagation();
                self.jqQuiz.toggleClass('show-grades');
                $(e.target).text(self.jqQuiz.hasClass('show-grades') ? "Hide grades" : "Show grades");
            }),
            null
        ]);
    };

    /** Render a progress bar in the box */
    this.renderProgress = function (count, max, message) {
        var self = this,
            jqBar = self.jqQuiz.find('div.progress div.bar'),
            perc;
        if (!jqBar.length && count === 'increment') {
            throw new Error("Need existing bar to increment count");
        }

        if (jqBar.length) {
            perc = count === 'increment' ? parseInt(jqBar[0].style.width, 10) + Math.round((1 / max) * 100)
                                         : Math.round((count / max) * 100);
            jqBar.css({"width": perc + '%'});
            self.jqQuiz.find('p.message').text(message);
        } else {
            perc = Math.round((count / max) * 100);
            self.jqQuiz.empty().append([
                el('p').attr('class', 'message').text(message),
                el('div').attr('class', 'progress').append(el('div').attr('class', 'bar').css({"width": perc + '%'})),
                null
            ]);
        }
    };

    /** Render a progress bar from an array of promises */
    this.renderPromiseProgress = function (promises, messageProgress, messageFinish) {
        var self = this;
        if (promises.length === 0) {
            return Promise.resolve();
        }
        self.renderProgress(0, promises.length, messageProgress);
        return Promise.all(promises.map(function (p) {
            return p.then(function () {
                self.renderProgress('increment', promises.length, messageProgress);
            });
        })).then(function () {
            self.renderProgress(1, 1, messageFinish);
        });
    };
}
StartView.prototype = new View(jQuery);

(function (window, $) {
    "use strict";
    var quiz, twView,
        unsyncedLectures = [],
        jqQuiz = $('#tw-quiz');

    // Do nothing if not on the right page
    if ($('body.quiz-start').length === 0) { return; }

    // Wire up quiz object
    twView = new StartView($);

    // Click on the select box opens / closes items
    jqQuiz.click(function (e) {
        var jqTarget = $(e.target);
        if (jqTarget.parents(".select-list").length === 0) {
            // Outside the select list, let click carry on.
            return;
        }
        e.preventDefault();
        jqQuiz.find(".selected").removeClass("selected");
        twView.updateActions([]);

        if (jqTarget.parent().parent().hasClass('select-list')) {
            // A 1st level tutorial, Just open/close item
            jqTarget.parent().toggleClass("expanded");
        } else if (e.target.tagName === 'A' || e.target.tagName === 'SPAN') {
            // A quiz link, select it
            if (e.target.tagName === 'SPAN') {
                jqTarget = jqTarget.parent('a');
            }
            jqTarget.addClass("selected");
            twView.updateActions(['go-slides', 'go-drill']);
        }
    });

    // Start state machine
    twView.stateMachine(function updateState(curState, fallback) {
        function promiseFatalError(err) {
            setTimeout(function () {
                throw err;
            }, 0);
            throw err;
        }

        switch (curState) {
        case 'initial':
            // Create Quiz model
            quiz = new Quiz(localStorage, new AjaxApi($.ajax));
            updateState.call(this, 'sync-tutorials', fallback);
            break;
        case 'sync-tutorials':
        case 'sync-tutorials-force':
            twView.renderPromiseProgress(
                quiz.syncAllTutorials(curState === 'sync-tutorials-force'),
                "Syncing tutorials...",
                "Finished!"
            ).then(function () {
                updateState.call(this, 'lecturemenu', fallback);
            })['catch'](function (err) {
                updateState.call(this, 'lecturemenu', fallback);
                if (err.message.indexOf('tutorweb::') !== -1) {
                    var parts = err.message.split(/\:\:/).splice(1);
                    twView.showAlert(parts[0], 'Syncing failed: ' + parts[1], parts[2]);
                } else {
                    twView.showAlert('error', 'Syncing failed: ' + err.message);
                }
            })['catch'](promiseFatalError);
            break;
        case 'lecturemenu':
            quiz.getAvailableLectures(function (tutorials) {
                if (tutorials.length === 0) {
                    twView.showAlert('info', 'You have no tutorials loaded yet. Please click "Return to Tutor-Web site", and choose a department and tutorial');
                    twView.updateActions(['go-twhome']);
                } else {
                    twView.renderChooseLecture(tutorials);
                }

                // Get all lecture titles from unsynced lectures
                unsyncedLectures = [].concat.apply([], tutorials.map(function (t) {
                    return (t.lectures.filter(function (l) { return !l.synced; })
                                      .map(function (l) { return l.title; }));
                }));
            });
            break;
        case 'logout':
            if (unsyncedLectures.length === 0 || window.confirm("Your answers to " + unsyncedLectures[0] + " haven't been sent to the Tutor-Web server.\nIf you click okay some answers will be lost")) {
                localStorage.clear();
                window.location.href = twView.portalRootUrl('logout');
            }
            break;
        case 'go-slides':
        case 'go-drill':
            window.location.href = (curState === 'go-slides' ? 'slide.html' : 'quiz.html') +
                                   jqQuiz.find('a.selected').attr('href');
            break;
        case 'go-twhome':
            window.location.href = quiz.portalRootUrl();
            break;
        default:
            fallback(curState);
        }
    });

}(window, jQuery));
