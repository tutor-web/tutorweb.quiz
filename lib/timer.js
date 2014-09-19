/*jslint nomen: true, plusplus: true, browser:true */
/*global module */

/**
  * A timer widget to sit below the quiz, takes a jQuery node
  * to put timer in.
  */
module.exports = function Timer(jqTimer) {
    "use strict";
    this.time = null;

    /** Start the timer counting down from startTime seconds */
    this.start = function (onFinish, startTime) {
        var self = this;
        function formatTime(t) {
            var out = "";
            function plural(i, base) {
                return i + " " + base + (i !== 1 ? 's' : '');
            }

            if (t > 60) {
                out = plural(Math.floor(t / 60), 'min') + ' ';
                t = t % 60;
            }
            out += plural(t, 'sec');
            return out;
        }

        if (startTime) {
            self.time = startTime;
        } else {
            if (this.time === null) {
                // Something called timerStop, so stop.
                return;
            }
            self.time = self.time - 1;
        }

        if (self.time > 0) {
            jqTimer.show();
            jqTimer.text(formatTime(self.time));
            window.setTimeout(self.start.bind(self, onFinish), 1000);
        } else {
            // Wasn't asked to stop, so it's a genuine timeout
            jqTimer.show();
            jqTimer.text("Out of time");
            onFinish();
        }
    };

    /** Stop the timer at it's current value */
    this.stop = function () {
        var self = this;
        self.time = null;
    };

    /** Stop the timer and hide it */
    this.reset = function () {
        var self = this;
        self.time = null;
        jqTimer.hide();
    };
};
