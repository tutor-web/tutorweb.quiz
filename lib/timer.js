/*jslint nomen: true, plusplus: true, browser:true */
/*global module */

/**
  * A timer widget to sit below the quiz, takes a jQuery node
  * to put timer in.
  */
module.exports = function Timer(jqTimer) {
    "use strict";
    var timeoutId = null;

    function formatTime(t) {
        var out = "";
        function plural(i, base) {
            return i + " " + base + (i !== 1 ? 's' : '');
        }

        if (t >= 60) {
            out = plural(Math.floor(t / 60), 'min') + ' ';
            t = t % 60;
        }
        out += plural(t, 'sec');
        return out;
    }

    function tick(curTime, onFinish) {
        window.clearTimeout(timeoutId);
        if (curTime === "stop") {
            return;
        }

        this.text(formatTime(curTime));

        if (curTime > 0) {
            timeoutId = window.setTimeout(tick.bind(this, curTime - 1, onFinish), 1000);
        } else {
            onFinish();
        }
    }

    /** Start the timer counting down from totalTime seconds */
    this.start = function (onFinish, totalTime) {
        tick.call(this, Math.round(totalTime), onFinish);
    };

    /** Stop the timer at it's current value */
    this.stop = function () {
        tick.call(this, "stop");
    };

    /** Stop the timer and hide it */
    this.reset = function () {
        tick.call(this, "stop");
        jqTimer.hide();
    };

    /** Force the text of the timer to s */
    this.text = function (s) {
        jqTimer.show();
        jqTimer.text(s);
    };
};
