/*jslint nomen: true, plusplus: true, browser:true, unparam: true */
/*global require */
var jQuery = require('jquery');
var iaalib = new (require('./iaa.js'))();

function draw(values, max) {
    "use strict";
    var i,
        graphEl = document.getElementById('graph'),
        ctx = graphEl.getContext('2d');

    function moveScale(x, y, penDown) {
        var scaleX = x * (graphEl.width / values.length),
            scaleY = graphEl.height - (y * graphEl.height / max);
        if (penDown === true) {
            ctx.lineTo(scaleX, scaleY);
        } else if (penDown === false) {
            ctx.moveTo(scaleX, scaleY);
        } else {
            ctx.fillText(penDown, scaleX, scaleY);
        }
    }

    console.log("Graphing", values);
    ctx.clearRect(0, 0, graphEl.width, graphEl.height);
    ctx.textAlign = "center";
    // Draw bars
    for (i = 0; i < values.length; i++) {
        ctx.beginPath();
        moveScale(i, 0, false);
        moveScale(i, values[i], true);
        moveScale(i + 1, values[i], true);
        moveScale(i + 1, 0, true);
        moveScale(i + 0.5, values[i] / 2, values[i].toFixed(3));
        ctx.stroke();
    }
}

function calculate(calcType) {
    "use strict";
    var i,
        alpha = document.getElementById('alpha').value,
        s = document.getElementById('s').value,
        answerQueue = document.getElementById('answers').value.split("").map(function (x) {
            return {"correct": parseInt(x, 10) > 0, "answer_time": 1234};
        });
    console.log("alpha", alpha);
    console.log("s", s);
    console.log("answerQueue", answerQueue);

    if (calcType === 'grade') {
        // For each answer grade up until it
        for (i = 0; i < answerQueue.length; i++) {
            iaalib.gradeAllocation({
                "grade_alpha": alpha,
                "grade_s": s,
            }, answerQueue.slice(0, i + 1));
        }
        draw(answerQueue.map(function (a) { return a.grade_after; }), 10);
    } else if (calcType === 'weighting') {
        draw(iaalib.gradeWeighting(answerQueue.length, parseFloat(alpha), parseFloat(s), 8, 30), 1);
    } else {
        draw([], 0);
    }
}

(function (window, $) {
    "use strict";
    function el(name) {
        return $(document.createElement(name));
    }

    // Do nothing if not on the right page
    if ($('body.page-debug').length === 0) { return; }

    $('#tw-graphactions').append([
        el('button').addClass('button').click(function () { calculate('grade'); }).text('Calculate Grade progression'),
        el('button').addClass('button').click(function () { calculate('weighting'); }).text('Calculate weightings'),
        null
    ]);
    calculate('grade');

}(window, jQuery));
