/*jslint nomen: true, plusplus: true, browser:true, regexp: true, todo: true */
/*global module */
var renderTex = require('./rendertex.js').renderTex;

/**
  * View class for all pages
  */
module.exports = function View($) {
    "use strict";
    this.jqQuiz = $('#tw-quiz');
    this.jqActions = $('#tw-actions');
    this.locale = {
        "reload": "Restart",
        "initial": "Back",
        "gohome": "Back to main menu",
        "go-drill": "Take a drill",
        "go-slides": "View slides",
        "go-twhome": "Get more drill questions",
        "go-login": "Log-in to Tutor-Web",
        "quiz-practice": "Practice question",
        "quiz-real": "New question",
        "redeem-award": "Redeem your smileycoins",
        "mark-practice": "Submit answer >>>",
        "mark-real": "Submit answer >>>",
        "ug-skip": "Skip question writing",
        "ug-submit": "Submit your question",
        "ug-rate": "Rate this question",
        "review": "Review your work",
        "rewrite-question": "Rewrite this question",
        "userdetails-save": "Save and continue",
        "" : ""
    };

    // Generate a jQueried DOM element
    function el(name) {
        return $(document.createElement(name));
    }

    /** Regenerate button collection to contain given buttons */
    this.updateActions = function (actions) {
        var self = this;

        self.jqActions.empty().append(actions.reverse().map(function (a) {
            if (!a) {
                return $('<span/>');
            }
            return $('<button/>')
                .attr('data-state', a)
                .attr('class', 'button')
                .text(self.locale[a] || a);
        }));
    };

    /** Tell MathJax to render anything on the page */
    this.renderMath = function (onSuccess) {
        var p = renderTex($, this.jqQuiz);
        if (onSuccess) {
            p.then(onSuccess);
        }
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
            jqAlert = $('<div class="alert">').addClass(state === 'error' ? ' alert-error' : 'alert-info');

        if (encoding === 'html') {
            jqAlert.html(message);
        } else {
            jqAlert.text(message);
        }
        jqQuiz.children('div.alert').remove();
        jqQuiz.prepend(jqAlert);
    };

    /**
      * Given URL object, chop querystring up into a key/value object
      * e.g. quiz.parseQS(window.location)
      */
    this.parseQS = function (url) {
        var out = { "_doc": url.href.replace(/^.*\//, '') };

        [].concat(
            url.search.replace(/^\?/, '').split(/;|&/),
            url.hash.replace(/^\#!?/, '').split(/;|&/)
        ).filter(function (str) {
            // Remove empty entries from an empty search/hash
            return str.length > 0;
        }).map(function (str) {
            var part = str.split('=');

            if (part.length > 1) {
                out[part[0]] = decodeURIComponent(part[1]);
            } else {
                out._opt = str;
            }
        });
        return out;
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
            if (opts.hasOwnProperty(k)) {
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
    this.stateMachine = function (updateState) {
        var self = this;
        // State machine to use when nothing else works
        function fallback(curState) {
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
                window.location.href = 'start.html';
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
            case 'go-login':
                window.location.href = '//' + window.document.location.host + '/login?came_from=' +
                                       encodeURIComponent(window.document.location);
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
                self.updateActions(curState === 'error-quota' ? ['reload', 'gohome']
                                                              : ['gohome', 'reload']);
                break;
            default:
                // Show alert for error and unknown states
                if (curState.indexOf('error-') === -1) {
                    self.lastError = "Unknown state '" + curState + "'";
                }
                self.showAlert(curState === 'error-info' ? 'info' : 'error', self.lastError);

                // Stop any other actions
                self.jqQuiz.removeClass('busy');
                $('.tw-action').remove();
                self.updateActions(curState === 'error-quota' ? ['reload', 'gohome']
                                                              : ['gohome', 'reload']);
            }
        }

        // Save Current location
        self.curUrl = self.parseQS(window.location);

        // Global error handler to poke into an error state
        window.onerror = function (message, url, linenumber) {
            var parts, newState;

            if (message.toLowerCase().indexOf('quota') > -1) {
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

        // Trigger reload if appCache needs it
        if (window.applicationCache) {
            window.applicationCache.addEventListener('updateready', function () {
                if (window.applicationCache.status !== window.applicationCache.UPDATEREADY) {
                    return;
                }
                throw 'tutorweb::info::A new version of Tutor-web is avaiable, click "Restart"';
            });
        }

        // Hash-change triggers a state-change
        window.onhashchange = function () {
            self.curUrl = self.parseQS(window.location);
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
