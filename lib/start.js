/*jslint nomen: true, plusplus: true, browser:true */
/*global require */
var jQuery = require('jquery');
var Quiz = require('./quizlib.js');
var View = require('./view.js');
var AjaxApi = require('./ajaxapi.js');
var UserMenu = require('./usermenu.js');

function StartView($) {
    "use strict";

    // Generate a jQueried DOM element
    function el(name) {
        return $(document.createElement(name));
    }

    /** Generate expanding list for tutorials / lectures */
    this.renderChooseLecture = function (tutorials, unselectedActions, selectedActions) {
        var self = this;

        self.jqQuiz.empty().append([
            self.selectList(tutorials.map(function (tutorial) {
                return [
                    el('a').text(tutorial.title),
                    tutorial.lectures.map(function (l) {
                        return el('a').attr('href', self.generateUrl({
                            tutUri: tutorial.uri,
                            lecUri: l.uri,
                        })).text(l.title).append([
                            l.grade ? el('span').addClass('grade').text(l.grade) : null
                        ]);
                    })
                ];
            }), unselectedActions, selectedActions),
            el('button').addClass("show-grades").text("Show grades").click(function (e) {
                e.stopPropagation();
                self.jqQuiz.toggleClass('show-grades');
                $(e.target).text(self.jqQuiz.hasClass('show-grades') ? "Hide grades" : "Show grades");
            }),
            null
        ]);
    };
}
StartView.prototype = new View(jQuery);

(function (window, $) {
    "use strict";
    var quiz, twView, twMenu,
        unsyncedLectures = [];

    // Do nothing if not on the right page
    if ($('body.quiz-start').length === 0) { return; }

    // Wire up quiz object
    twView = new StartView($);

    // Start state machine
    twView.locale.logout = 'Clear data and logout';
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
            twMenu = new UserMenu($('#tw-usermenu'), quiz);
            twMenu.noop = 1; // NB: Keep JSLint quiet
            twView.updateActions(['logout', '']);
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
                    twView.showAlert('info', 'You have no tutorials loaded yet. Please click "Get more drill questions", and choose a department and tutorial from which you would like to learn.');
                    twView.updateActions(['logout', 'go-twhome']);
                } else {
                    twView.renderChooseLecture(
                        tutorials,
                        ['logout', ''],
                        ['logout', 'go-slides', 'go-drill']
                    );
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
                                   twView.selectListHref();
            break;
        default:
            fallback(curState);
        }
    });

}(window, jQuery));
