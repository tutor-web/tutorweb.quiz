MathJax.Hub.Config({
    jax: ["input/TeX", "output/HTML-CSS", "output/NativeMML"],
    extensions: ["tex2jax.js", "MathMenu.js", "MathZoom.js"],
    TeX: {
        extensions: ["AMSmath.js", "AMSsymbols.js", "noErrors.js", "noUndefined.js", "cancel.js"]
    },
    "HTML-CSS": {
        imageFont: null
    },
    tex2jax: {
        inlineMath: [ ['$','$'], ["\\(","\\)"] ],
        displayMath: [ ['$$','$$'], ["\\[","\\]"] ],
        ignoreClass: "jax-ignore",
        processEscapes: true
    }
});

MathJax.Ajax.loadComplete("[MathJax]/config/../../mathjax-config.js");
