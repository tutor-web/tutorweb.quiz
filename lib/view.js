/*jslint nomen: true, plusplus: true, browser:true, regexp: true, todo: true */
/*global module, Promise */
var renderTex = require('./rendertex.js').renderTex;
require('es6-promise').polyfill();
var parse_qs = require('../lib/parse_qs.js').parse_qs;
var AjaxApi = require('./ajaxapi.js');
var isQuotaExceededError = require('./ls_utils.js').isQuotaExceededError;

/**
  * View class for all pages
  */
module.exports = function View($) {
    "use strict";
    var twView = this;

    this.jqQuiz = $('#tw-quiz');
    this.jqActions = $('#tw-actions');
    this.locale = {
        "reload": "Restart",
        "initial": "Back",
        "gohome": "Back to main menu",
        "lecturemenu": "Main menu",
        "go-drill": "Take a drill",
        "go-slides": "View slides",
        "go-twhome": "Get more tutorials",
        "go-login": "Log-in to Tutor-Web",
        "quiz-practice": "Practice question",
        "quiz-real": "New question",
        "coinaward-donate": "Donate to EIAS",
        "coinaward-redeem": "Redeem your smileycoins",
        "qn-skip": "Skip this question",
        "qn-submit": "Submit answer",
        "ug-skip": "Skip question writing",
        "ug-submit": "Submit your question",
        "ug-rate": "Rate this question",
        "review": "Review your work",
        "rewrite-question": "Rewrite this question",
        "userdetails-save": "Save and continue",
        "subscription-remove": "Unsubscribe from this tutorial",
        "subscription-add": "Subscribe to this tutorial",
        "" : ""
    };

    // Generate a jQueried DOM element
    function el(name) {
        return $(document.createElement(name));
    }

    /** Render a question into HTML */
    this.renderQuestion = function (qn) {
        var previewTeX = this.previewTeX;

        /** Lookup value in object with default */
        function get(x, y, def) {
            return x === undefined || x[y] === undefined ? def : x[y];
        }

        if (qn._type === 'template') {
            qn.student_answer = qn.student_answer || {};
            return [
                el('h3').text(qn.title),
                el('p').html(qn.hints),
                previewTeX(el('textarea').attr('name', 'text').attr('placeholder', qn.example_text).text(qn.student_answer.text)),
                el('label').text("Write the correct answer below"),
                previewTeX(el('input').attr('type', 'text')
                                      .attr('name', 'choice_' + '0')
                                      .attr('placeholder', qn.example_choices[0] || "")
                                      .attr('maxlength', '1000')
                                      .attr('value', get(qn.student_answer.choices, 0, {}).answer)),
                el('input').attr('type', 'hidden').attr('name', 'choice_' + '0' + '_correct').attr('value', 'on'),
                el('label').text("Fill the rest of the boxes with incorrect answers:"),
                el('div').append(qn.example_choices.slice(1).map(function (text, i) {
                    return previewTeX(el('input').attr('type', 'text')
                                      .attr('name', 'choice_' + (i + 1).toString())
                                      .attr('placeholder', text)
                                      .attr('maxlength', '1000')
                                      .attr('value', get(qn.student_answer.choices, i + 1, {}).answer));
                })),
                el('label').text("Write an explanation below as to why it's a correct answer:"),
                previewTeX(el('textarea').attr('name', 'explanation').attr('placeholder', qn.example_explanation).text(qn.student_answer.explanation))
            ];
        }

        return qn.content;
    };

    /** Regenerate button collection to contain given buttons */
    this.updateActions = function (actions) {
        var self = this;

        self.jqActions.empty().append(actions.map(function (a) {
            if (!a) {
                return $('<span/>');
            }
            return $('<button/>')
                .attr('data-state', a)
                .attr('class', 'button')
                .text(self.locale[a] || a);
        }).reverse());
    };

    /** Tell MathJax to render anything on the page */
    this.renderMath = function () {
        return renderTex($, this.jqQuiz);
    };

    /** Place TeX preview box after given element */
    this.previewTeX = function (jqEl) {
        var jqPreview = el('div').attr('class', 'tex-preview parse-as-tex');
        function intelligentText(t) {
            return t.split(/(\n)/).map(function (part, i) {
                return i % 2 === 1 ? $('<br/>') : document.createTextNode(part);
            });
        }
        function renderPreview(text) {
            jqPreview.empty().append(intelligentText(text));
            jqPreview.removeClass('transformed');
            renderTex($, jqPreview);
        }

        jqEl.on('keyup paste', function (e) {
            window.clearTimeout(e.target.renderTimeout);
            e.target.renderTimeout = window.setTimeout(function () {
                renderPreview(e.target.value);
            }, 500);
        });
        jqEl.on('change', function (e) {
            // Render immediately if contents change
            window.clearTimeout(e.target.renderTimeout);
            renderPreview(e.target.value);
        });
        renderPreview(jqEl.val());
        return el('div').append([jqEl, jqPreview]);
    };

    /** Add a message to the page */
    this.showAlert = function (state, message, encoding) {
        var jqQuiz = this.jqQuiz,
            jqAlert = $('<div class="alert">').addClass(
                state === 'error' ? ' alert-error'
                    : state === 'warning' ? ' alert-warning'
                        : 'alert-info'
            );

        if (encoding === 'html') {
            jqAlert.html(message);
        } else {
            jqAlert.text(message);
        }
        jqQuiz.children('div.alert').remove();
        jqQuiz.prepend(jqAlert);
    };

    /** Return the contents of form as an object */
    this.formAsDict = function (jqForm) {
        var rv = {};

        if (!jqForm) {
            if (this.jqQuiz.get(0).tagName === 'FORM') {
                jqForm = this.jqQuiz;
            } else {
                jqForm = this.jqQuiz.children('form');
            }
        }

        jqForm.serializeArray().map(function (x) {
            if (rv.hasOwnProperty(x.name)) {
                throw new Error("Form element " + x.name + " repeated");
            }
            rv[x.name] = x.value;
        });
        return rv;
    };

    /**
      * Generate a select list from [[title, [el('a'), ...]], ...] items
      * Call updateActions with the relevant list when items are selected/unselected
      */
    this.selectList = function (items, unselectedActions, selectedActions) {
        var self = this,
            jqSelectList = el('ul').attr('class', 'select-list');

        function toggleExpand(element, elRest) {
            var i;

            if (!element) {
                return;
            }

            if (!element.style.height || element.style.height === '0px') {
                element.style.height = Array.prototype.reduce.call(element.childNodes, function (p, c) {
                    return p + (c.offsetHeight || 0);
                }, 0) + 'px';
            } else {
                element.style.height = '0px';
            }

            for (i = 0; i < elRest.length; i++) {
                elRest[i].style.height = '0px';
            }
        }

        function selectListInner(items) {
            if (Object.prototype.toString.call(items) === '[object Array]') {
                return el('li').append([
                    items[0],
                    el('ul').append(items[1].map(selectListInner)),
                ]);
            }
            return el('li').append(items);
        }

        jqSelectList.append(items.map(selectListInner));
        jqSelectList.click(function (e) {
            var jqTarget = $(e.target);

            e.preventDefault();
            jqSelectList.find(".selected").removeClass("selected");
            self.updateActions(unselectedActions);

            if (jqTarget.closest('ul').hasClass('select-list')) {
                // Top-level item, open/close it
                toggleExpand(
                    jqTarget.closest('li').children('ul')[0],
                    jqTarget.closest('li').siblings('li').children('ul')
                );
            } else {
                // A second level item, select it
                jqTarget.closest('a').addClass("selected");
                self.updateActions(selectedActions);
            }
        });

        self.updateActions(unselectedActions);
        return jqSelectList;
    };

    /** Return the href for the selected item */
    this.selectListHref = function () {
        return $('ul.select-list a.selected').attr('href');
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

    /**
      * Return a URL that points to doc (or null for the same doc), and
      * Combines the opts with any existing ones
      */
    this.generateUrl = function (optsIn) {
        var k, start = true,
            opts = {},
            out = (optsIn._doc || "");

        [this.curUrl, optsIn].map(function (obj) {
            var j;

            for (j in obj) {
                if (obj.hasOwnProperty(j)) {
                    if (j !== '_doc') {
                        opts[j] = obj[j];
                    }
                }
            }
        });

        for (k in opts) {
            if (opts.hasOwnProperty(k) && k !== '_doc' && opts[k]) {
                out += (start ? '#!' : ';') + k + "=" + encodeURIComponent(opts[k]);
                start = false;
            }
        }
        return out;
    };

    /**
      * Based on document location, return the Plone root with extra appended
      */
    this.portalRootUrl = function (extra) {
        return window.location.protocol + '//' +
               window.location.host + '/' +
               (extra || '');
    };

    /** Initalise and start a state machine to control the page */
    this.states = {};
    this.ajaxApi = new AjaxApi($.ajax);

    this.states['go-login'] = function () {
        var login_url = '/login?came_from=' + encodeURIComponent(window.document.location);

        return twView.ajaxApi.getHtml(login_url).then(function (docString) {
            var content = $('<div/>').html(docString).find('#content-core');

            twView.updateActions([]);
            twView.jqQuiz.empty().append(content);
        });
    };

    this.states['error-quota'] = function () {
        twView.showAlert('warning', 'You have run out of storage space. Please go back to the main menu and unsubscribe to old lectures');
        twView.updateActions(['gohome']);
    };

    this.stateMachine = function (updateState) {
        var self = this;

        // State machine to use when nothing else works
        function fallback(curState) {
            var p;

            // Check if there's a function in our states hash
            if (self.states[curState]) {
                p = self.states[curState].call(self, curState, function (newState) {
                    // Bind updateState to both self and fallback
                    updateState.call(self, newState, fallback);
                });
                if (!p || !p.then) {
                    p = Promise.resolve(p);
                }
                p.then(function (nextState) {
                    if (nextState) {
                        updateState.call(self, nextState, fallback);
                    }
                })['catch'](function (err) {
                    if (isQuotaExceededError(err)) {
                        updateState.call(self, 'error-quota', fallback);
                        return;
                    }
                    setTimeout(function () {
                        throw err;
                    }, 0);
                    throw err;
                });
                return;
            }

            switch (curState) {
            case 'processing':
                break;
            case 'request-reload':
                self.updateActions(['reload']);
                break;
            case 'reload':
            case 'hash-change':
                window.location.reload(false);
                break;
            case 'gohome':
                window.location.href = '/';
                break;
            case 'go-coin':
                window.location.href = 'coin.html';
                break;
            case 'go-drill':
                if (window.location.search.indexOf('tutUri') !== -1) {
                    // Backwards-compatible URLs
                    window.location.href = 'quiz.html' + window.location.search.replace(/^\?/, "#!");
                } else {
                    // Use normal hash URLs
                    window.location.href = 'quiz.html' + window.location.hash;
                }
                break;
            case 'go-twhome':
                window.location.href = self.portalRootUrl();
                break;
            case 'page-unload':
                // We could modify self.unloadMessage here to stop the process
                break;
            case 'error-unauth':
                self.showAlert('error', self.lastError, 'html');

                // Stop any other actions
                self.jqQuiz.removeClass('busy');
                $('.tw-action').remove();
                self.updateActions(['gohome', 'reload']);
                break;
            default:
                // Show alert for error and unknown states
                if (curState.indexOf('error-') === -1) {
                    self.lastError = "Unknown state '" + curState + "'";
                }
                self.showAlert(curState === 'error-info' ? 'info' : 'error', self.lastError);

                // Send error message to server, don't worry if it fails
                $.ajax({
                    data: JSON.stringify(self.lastError),
                    contentType: 'application/json',
                    type: 'POST',
                    url: '/@@quizdb-logerror',
                    timeout: 1000,
                });

                // Stop any other actions
                self.jqQuiz.removeClass('busy');
                $('.tw-action').remove();
                self.updateActions(['gohome', 'reload']);
            }
        }

        if (!updateState) {
            updateState = fallback;
        }

        // Save Current location
        self.curUrl = parse_qs(window.location);

        // Global error handler to poke into an error state
        window.onerror = function (message, url, linenumber) {
            var parts, newState;

            if (message.toLowerCase().indexOf('quota') > -1 || message.toLowerCase().indexOf('persistent storage') > -1) {
                newState = 'error-quota';
                self.lastError = 'No more local storage available. Please return to the menu and delete some tutorials you are no longer using.';
            } else if (message.indexOf('tutorweb::') > -1) {
                parts = message.split(/\:\:/);
                newState = 'error-' + parts[1];
                self.lastError = parts[2];
            } else {
                newState = 'error-error';
                self.lastError = "Internal error: " + message + " (" + url + ":" + linenumber + ")";
            }

            updateState.call(self, newState, fallback);
        };

        // Complain if there's no localstorage
        if (!window.localStorage) {
            throw "tutorweb::error::Sorry, we need localStorage support in your browser.";
        }

        // Hash-change triggers a state-change
        window.onhashchange = function () {
            self.curUrl = parse_qs(window.location);
            updateState.call(self, 'hash-change', fallback);
        };

        window.addEventListener("beforeunload", function (e) {
            updateState.call(self, 'page-unload', fallback);

            if (self.unloadMessage) {
                e.returnValue = self.unloadMessage;
                self.unloadMessage = undefined;
                return e.returnValue;
            }
        });

        // Hitting something with a 'data-state' moves to next state
        $('body').bind('click', function (event) {
            var newState = event.target.getAttribute('data-state');
            // TODO: Check if '#tw-actions > *|.tw-action'
            if (!newState) {
                return;
            }

            event.preventDefault();
            updateState.call(self, newState, fallback);
        });

        updateState.call(self, "initial", fallback);
    };
};
