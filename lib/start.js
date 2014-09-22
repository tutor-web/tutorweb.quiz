/*jslint nomen: true, plusplus: true, browser:true */
/*global require, jQuery */
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

    /** Show a nice informative message */
    this.showMessage = function (text) {
        var self = this;

        self.jqQuiz.empty().append([
            el('div').attr('class', 'alert alert-info').text(text),
            null
        ]);
    };

    /** Generate expanding list for tutorials / lectures */
    this.renderChooseLecture = function (items) {
        var self = this;

        // [[href, title, items], [href, title, items], ...] => markup
        // items can also be {uri: '', title: ''}
        function listToMarkup(items) {
            var i, jqA, item, jqUl = $('<ul/>');
            if (items === undefined) {
                return null;
            }
            for (i = 0; i < items.length; i++) {
                item = items[i];
                jqA = $('<a/>').attr('href', item.uri).text(item.title);
                if (item.grade) {
                    jqA.append($('<span class="grade"/>').text(item.grade));
                }
                jqUl.append($('<li/>')
                        .toggleClass('expanded', items.length === 1)
                        .append(jqA)
                        .append(listToMarkup(item.lectures))
                        );
            }
            return jqUl;
        }

        // Recursively turn tutorials, lectures into a ul, populate existing ul.
        self.jqQuiz.empty().append([
            el('ul').attr('class', 'select-list')
                    .append(listToMarkup(items).children()),
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
            twView.configureWindow(window);
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
                twView.showAlert('error', 'Syncing failed: ' + err.message);
            })['catch'](promiseFatalError);
            break;
        case 'lecturemenu':
            quiz.getAvailableLectures(function (tutorials) {
                if (tutorials.length === 0) {
                    twView.showMessage('You have no tutorials loaded yet. Please click "Return to Tutor-Web site", and choose a department and tutorial');
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
                window.location.href = quiz.portalRootUrl(document.location) + '/logout';
            }
            break;
        case 'go-slides':
        case 'go-drill':
            var search = jqQuiz.find('a.selected').attr('href');
            search = search.substring(search.indexOf('?'));
            window.location.href = (curState === 'go-slides' ? 'slide.html' : 'quiz.html') + search;
            break;
        case 'go-twhome':
            window.location.href = quiz.portalRootUrl(document.location);
            break;
        default:
            fallback(curState);
        }
    });

}(window, jQuery));
