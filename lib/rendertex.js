"use strict";
/*jslint nomen: true, plusplus: true, browser:true, regexp: true, todo: true */
/*global module, MathJax, Promise */
require('es6-promise').polyfill();
var shuffle = require('knuth-shuffle').knuthShuffle;

var ggbCount = 0;

function RenderTex($) {
    function flatten(arrays) {
        return Array.prototype.concat.apply([], arrays);
    }

    function fixTextPreMathJax(n) {
        var parts;

        parts = n.split(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/);
        if (parts.length > 1) {
            return flatten(parts.map(function (part, i) {
                return i % 2 === 1 ? [$('<pre class="jax-ignore">').text(part)]
                                   : fixTextPreMathJax(part);
            }));
        }

        n = n.replace(/^%.*\n?/mg, " ");

        return [n];
    }

    function fixTextPostMathJax(n) {
        var parts;

        n = n.replace(/\\(no|par)?indent/mg, "");
        //TODO: Turn \% to %

        parts = n.split(/(\s*\n\s*\n\s*)/);
        if (parts.length > 1) {
            return flatten(parts.map(function (part, i) {
                return i % 2 === 1 ? [$('<br/><br/>')]
                                   : fixTextPostMathJax(part);
            }));
        }

        parts = n.split(/(\\\\\s*\n*)/);
        if (parts.length > 1) {
            return flatten(parts.map(function (part, i) {
                return i % 2 === 1 ? [$('<br/>')]
                                   : fixTextPostMathJax(part);
            }));
        }

        parts = n.split(/(\\newline\s*\n*)/);
        if (parts.length > 1) {
            return flatten(parts.map(function (part, i) {
                return i % 2 === 1 ? [$('<br/>')]
                                   : fixTextPostMathJax(part);
            }));
        }

        n = n.replace(/\\hspace\{.*?\}/mg, "&nbsp;");

        parts = n.split(/(\\vspace\{.*?\})/);
        if (parts.length > 1) {
            return flatten(parts.map(function (part, i) {
                return i % 2 === 1 ? [$('<br/><br/>')]
                                   : fixTextPostMathJax(part);
            }));
        }

        parts = n.split(/(\\vspace\{.*?\}\s*\n*)/);
        if (parts.length > 1) {
            return flatten(parts.map(function (part, i) {
                return i % 2 === 1 ? [$('<br/>')]
                                   : fixTextPostMathJax(part);
            }));
        }

        parts = n.split(/\\textbf\{(.*?)\}/);
        if (parts.length > 1) {
            return flatten(parts.map(function (part, i) {
                return i % 2 === 1 ? [$('<b/>').text(part)]
                                   : fixTextPostMathJax(part);
            }));
        }

        parts = n.split(/\\textit\{(.*?)\}/);
        if (parts.length > 1) {
            return flatten(parts.map(function (part, i) {
                return i % 2 === 1 ? [$('<i/>').text(part)]
                                   : fixTextPostMathJax(part);
            }));
        }

        parts = n.split(/\\texttt\{(.*?)\}/);
        if (parts.length > 1) {
            return flatten(parts.map(function (part, i) {
                return i % 2 === 1 ? [$('<code/>').text(part)]
                                   : fixTextPostMathJax(part);
            }));
        }

        parts = n.split(/\\emph\{(.*?)\}/);
        if (parts.length > 1) {
            return flatten(parts.map(function (part, i) {
                return i % 2 === 1 ? [$('<em/>').text(part)]
                                   : fixTextPostMathJax(part);
            }));
        }

        parts = n.split(/\\url\{(.*?)\}/);
        if (parts.length > 1) {
            return flatten(parts.map(function (part, i) {
                return i % 2 === 1 ? [$('<a>').attr('href', part).text(part)]
                                   : fixTextPostMathJax(part);
            }));
        }

        parts = n.split(/\\href\{(.*?)\}\{(.*?)\}/);
        if (parts.length > 1) {
            return flatten(parts.map(function (part, i) {
                return i % 3 === 1 ? [$('<a>').attr('href', part).text(parts[i + 1])]
                     : i % 3 === 0 ? fixTextPostMathJax(part) : [];
            }));
        }

        return [n];
    }

    function deIntelligentText(el) {
        var jqEl = $(el);

        if (jqEl.hasClass('transformed')) {
            return el;
        }

        jqEl.contents().toArray().map(function (n) {
            if (n.nodeType && n.nodeType !== el.ELEMENT_NODE && n.tagName !== "BR") {
                return n;
            }
            $(n).replaceWith("\n");
        });
        el.normalize();

        return el;
    }

    function dePreTag(el) {
        var newEl;

        if (el.tagName === 'PRE') {
            newEl = document.createElement('div');
            newEl.className = el.className;
            newEl.innerHTML = el.innerHTML;

            $(el).replaceWith(newEl);
            return newEl;
        }

        return el;
    }

    function queueMathJax(el) {
        return new Promise(function (resolve) {
            MathJax.Hub.Queue(["Typeset", MathJax.Hub, el]);
            MathJax.Hub.Queue(resolve.bind(null, el));
        });
    }

    function fixTextNodes(fn, el) {

        $(el).contents().toArray().map(function (n) {
            var newNodes;

            if (n.nodeType && n.nodeType !== el.TEXT_NODE) {
                return;
            }

            newNodes = fn(n.textContent);
            if (newNodes.length > 1 || newNodes[0] !== n.textContent) {
                $(n).replaceWith(newNodes);
            }
        });

        return el;
    }

    /** Tell MathJax to render anything on the page */
    this.renderTex = function (jqEl) {
        var jqTexElements = jqEl.hasClass('parse-as-tex') ? jqEl : jqEl.find('.parse-as-tex,span.math:not(.parse-as-tex span.math),div.math:not(.parse-as-tex div.math)').not('.transformed');
        jqEl.addClass("busy");
        return Promise.all(jqTexElements.toArray().map(function (el) {
            return Promise.resolve(el)
                          .then(deIntelligentText)
                          .then(dePreTag)
                          .then(fixTextNodes.bind(null, fixTextPreMathJax))
                          .then(queueMathJax)
                          .then(fixTextNodes.bind(null, fixTextPostMathJax))
                          .then(function (el) {
                    $(el).addClass('transformed');
                });
        })).then(function () {
            return jqEl;
        });
    };
}

function renderGgb(jqEl) {
    return Promise.all(jqEl.find('.geogebra_applet').toArray().map(function (el, idx) {
        if (!window.GGBApplet) {
            el.insertAdjacentHTML('beforebegin', '<span>No GeoGebra support found. </span>');
            return;
        }

        return new Promise(function (resolve) {
            var applet;

            el.insertAdjacentHTML('beforebegin', '<div class="geogebra_container"><div class="geogebra_applet" id="applet' + idx + '"></div></div>');
            applet = new window.GGBApplet({
                filename: el.getAttribute('href'),
                showToolbar: true,
                scaleContainerClass: 'geogebra_container',
                appletOnLoad: function () {
                    // NB: The initial width calculation is broken as the applet is hidden.
                    // Scale once manually, then let scaleContainerClass take over
                    window.ggbApplet.setWidth(el.parentElement.offsetWidth);
                    resolve(el);
                },
            }, true);
            applet.inject('applet' + idx);
        });
    }));
}

function shuffleElements(jqEl) {
    Array.prototype.map.call(jqEl[0].querySelectorAll('ol.shuffle'), function (olEl) {
        var children = olEl.children,
            tmparr = [],
            i;

        for (i = 0; i < children.length; i++) { tmparr[i] = children[i]; }
        tmparr.sort(function () { return 0.5 - Math.random(); });
        for (i = 0; i < tmparr.length; i++) { olEl.appendChild(tmparr[i]); }
    });

    return jqEl;
}

module.exports.renderTex = function ($, jqEl) {
    var rt = new RenderTex($);

    function promiseFatalError(err) {
        setTimeout(function () {
            throw err;
        }, 0);
        throw err;
    }

    return rt.renderTex(jqEl).then(shuffleElements).then(renderGgb).then(function () {
        jqEl.removeClass("busy");
    })['catch'](promiseFatalError);
};
