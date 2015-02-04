/*jslint nomen: true, plusplus: true, browser:true, regexp: true */
/*global module, MathJax */
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
        "go-twhome": "Return to Tutor-Web site",
        "go-login": "Log-in to Tutor-Web",
        "quiz-practice": "Practice question",
        "quiz-real": "New question",
        "redeem-award": "Redeem your smileycoins",
        "mark-practice": "Submit answer >>>",
        "mark-real": "Submit answer >>>",
        "ug-skip": "Skip question writing",
        "ug-submit": "Submit your question",
        "ug-rate": "Rate this question",
        "review": "Review your answers",
        "rewrite-question": "Rewrite this question",
        "" : ""
    };

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
        var jqQuiz = this.jqQuiz;
        jqQuiz.addClass("busy");
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, this.jqQuiz[0]]);
        MathJax.Hub.Queue(function () {
            jqQuiz.removeClass("busy");
        });
        if (onSuccess) {
            MathJax.Hub.Queue(onSuccess);
        }
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

    /** Return an error handler to attach to window.onerror */
    this.errorHandler = function () {
        var self = this;
        return function (message, url, linenumber) {
            var parts, actions = ['gohome', 'reload'];
            self.jqQuiz.removeClass('busy');
            if (message.toLowerCase().indexOf('quota') > -1) {
                self.showAlert("error", 'No more local storage available. Please <a href="start.html">return to the menu</a> and delete some tutorials you are no longer using.', 'html');
            } else if (message.indexOf('tutorweb::') !== -1) {
                parts = message.split(/\:\:/).splice(1);
                if (parts.length > 3) {
                    actions = parts[3].split(/,/);
                }
                self.showAlert.apply(self, parts);
            } else {
                self.showAlert("error", "Internal error: " + message + " (" + url + ":" + linenumber + ")");
            }

            // The only action now should be to reload the page
            $('.tw-action').remove();
            self.updateActions(actions);
        };
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
            default:
                throw "tutorweb::error::Unknown state '" + curState + "'";
            }
        }

        // Save Current location
        self.curUrl = self.parseQS(window.location);

        // Wire up own error handler
        window.onerror = this.errorHandler();

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
                throw 'tutorweb::info::A new version is avaiable, click "Restart quiz"';
            });
        }

        // Hash-change triggers a state-change
        window.onhashchange = function () {
            self.curUrl = self.parseQS(window.location);
            updateState.call(self, 'hash-change', fallback);
        };

        // Hitting the button moves on to the next state in the state machine
        $('#tw-actions, .tw-action').bind('click', function (event) {
            var newState = event.target.getAttribute('data-state');
            if (!newState) {
                return;
            }

            event.preventDefault();
            updateState.call(self, newState, fallback);
        });

        updateState.call(self, "initial", fallback);
    };
};
