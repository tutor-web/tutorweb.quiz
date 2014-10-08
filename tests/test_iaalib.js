var iaalib = new (require('../lib/iaa.js'))();
var shuffle = require('knuth-shuffle').knuthShuffle;

module.exports.setUp = function (callback) {
    this.curTutorial = { "title": "UT tutorial", "lectures": []};
    this.curTutorial.lectures.push({
        "answerQueue": [],
        "questions": [
            {"uri": "ut:question0", "chosen": 20, "correct": 100},
            {"uri": "ut:question1", "chosen": 40, "correct": 100},
            {"uri": "ut:question2", "chosen": 60, "correct": 100},
            {"uri": "ut:question3", "chosen": 80, "correct": 100},
            {"uri": "ut:question4", "chosen": 99, "correct": 100},
        ],
        "settings": {
            "hist_sel": 0,
        },
        "uri":"ut:lecture0",
    });
    callback();
};

module.exports.testInitialAlloc = function (test) {
    // Allocate an initial item, should presume we started from 0
    var a = iaalib.newAllocation(this.curTutorial, 0, [], false);
    test.ok(a.uri.match(/ut:question[0-4]/))
    test.equal(a.grade_before, 0);
    test.equal(a.practice, false);

    test.done();
};

module.exports.testItemAllocation = function (test) {
    // Item allocation, on average, should hit the same point
    /** Build an answerQueue with x correct answers */
    function aq(correctAnswers) {
        var answerQueue = [];
        for (i = 0; i < Math.abs(correctAnswers); i++) {
            answerQueue.push({"correct": (correctAnswers > 0), "answer_time": 1234});
        }
        return answerQueue
    }

    /** Run allocation 1000 times, get mean question chosen*/
    function modalAllocation(qns, answerQueue, settings, practiceMode) {
        var uris = {}, i, grade = null;

        if (!settings) {
            settings = {"hist_sel" : "0"};
        }
        iaalib.gradeAllocation({}, answerQueue);
        for (i = 0; i < 7000; i++) {
            // Allocate a question based on answerQueue
            alloc = iaalib.newAllocation({ "lectures": [
                {"questions": qns, "settings": settings}
            ]}, 0, answerQueue, practiceMode || false);
            if (alloc === null) {
                test.ok(false, "failed to allocate qn");
            }
            // Count URIs
            if (uris.hasOwnProperty(alloc.uri)) {
                uris[alloc.uri] += 1;
            } else {
                uris[alloc.uri] = 1;
            }

            if (grade === null) {
                grade = alloc.grade_before;
            } else {
                test.equal(alloc.grade_before, grade);
            }
        }

        // Find mode in uris
        var highScore = -1, modalUri = '';
        for (var uri in uris) {
            if (!uris.hasOwnProperty(uri)) continue;
            if (uris[uri] > highScore) {
                modalUri = uri
                highScore = uris[uri];
            }
        }

        return {"alloc": modalUri, "grade": grade};
    };
    function between(res, min, max) {
        // Assuming question URI is an int, check it's between min & max

        if(parseInt(res) < min) return false;
        if(parseInt(res) > max) return false;
        return true;
    }

    // Start at grade 0, get easy question
    test.deepEqual(modalAllocation([
        {"uri": "0", "chosen": 100, "correct": 90},
        {"uri": "1", "chosen": 100, "correct": 80},
        {"uri": "2", "chosen": 100, "correct": 70},
        {"uri": "3", "chosen": 100, "correct": 60},
        {"uri": "4", "chosen": 100, "correct": 50},
        {"uri": "5", "chosen": 100, "correct": 40},
        {"uri": "6", "chosen": 100, "correct": 30},
        {"uri": "7", "chosen": 100, "correct": 20},
        {"uri": "8", "chosen": 100, "correct": 10},
    ], aq(0)), {"alloc": "0", "grade": 0});

    // Start at grade 0, still get easy question when we jumble them up
    test.deepEqual(modalAllocation([
        {"uri": "0", "chosen": 100, "correct": 10},
        {"uri": "1", "chosen": 100, "correct": 90},
        {"uri": "2", "chosen": 100, "correct": 20},
        {"uri": "3", "chosen": 100, "correct": 80},
        {"uri": "4", "chosen": 100, "correct": 30},
        {"uri": "5", "chosen": 100, "correct": 70},
        {"uri": "6", "chosen": 100, "correct": 40},
        {"uri": "7", "chosen": 100, "correct": 60},
        {"uri": "8", "chosen": 100, "correct": 50},
    ], aq(0)), {"alloc": "1", "grade": 0});
    test.deepEqual(modalAllocation(shuffle([
        {"uri": "0", "chosen": 100, "correct": 10},
        {"uri": "1", "chosen": 100, "correct": 90},
        {"uri": "2", "chosen": 100, "correct": 20},
        {"uri": "3", "chosen": 100, "correct": 80},
        {"uri": "4", "chosen": 100, "correct": 30},
        {"uri": "5", "chosen": 100, "correct": 70},
        {"uri": "6", "chosen": 100, "correct": 40},
        {"uri": "7", "chosen": 100, "correct": 60},
        {"uri": "8", "chosen": 100, "correct": 50},
    ]), aq(0)), {"alloc": "1", "grade": 0});

    // Answer loads of questions correctly, get a hard question
    test.deepEqual(modalAllocation([
        {"uri": "0", "chosen": 100, "correct": 90},
        {"uri": "1", "chosen": 100, "correct": 80},
        {"uri": "2", "chosen": 100, "correct": 70},
        {"uri": "3", "chosen": 100, "correct": 60},
        {"uri": "4", "chosen": 100, "correct": 50},
        {"uri": "5", "chosen": 100, "correct": 40},
        {"uri": "6", "chosen": 100, "correct": 30},
        {"uri": "7", "chosen": 100, "correct": 20},
        {"uri": "8", "chosen": 100, "correct": 10},
    ], aq(10)), {"alloc": "8", "grade": 10});

    // Answer some questions correctly, get a middling question
    test.ok(between(modalAllocation([
        {"uri": "0", "chosen": 100, "correct": 90},
        {"uri": "1", "chosen": 100, "correct": 80},
        {"uri": "2", "chosen": 100, "correct": 70},
        {"uri": "3", "chosen": 100, "correct": 60},
        {"uri": "4", "chosen": 100, "correct": 50},
        {"uri": "5", "chosen": 100, "correct": 40},
        {"uri": "6", "chosen": 100, "correct": 30},
        {"uri": "7", "chosen": 100, "correct": 20},
        {"uri": "8", "chosen": 100, "correct": 10},
    ], aq(4)), 4, 6));

    // Our grade won't go beyond 10, still get hard questions
    test.deepEqual(modalAllocation([
        {"uri": "0", "chosen": 100, "correct": 90},
        {"uri": "1", "chosen": 100, "correct": 80},
        {"uri": "2", "chosen": 100, "correct": 70},
        {"uri": "3", "chosen": 100, "correct": 60},
        {"uri": "4", "chosen": 100, "correct": 50},
        {"uri": "5", "chosen": 100, "correct": 40},
        {"uri": "6", "chosen": 100, "correct": 30},
        {"uri": "7", "chosen": 100, "correct": 20},
        {"uri": "8", "chosen": 100, "correct": 10},
    ], aq(20)), {"alloc": "8", "grade": 10});

    // A new question is allocated to us if we're doing well.
    test.deepEqual(modalAllocation([
        {"uri": "0", "chosen": 100, "correct": 90},
        {"uri": "1", "chosen": 100, "correct": 80},
        {"uri": "2", "chosen": 100, "correct": 70},
        {"uri": "3", "chosen": 100, "correct": 60},
        {"uri": "4", "chosen": 100, "correct": 50},
        {"uri": "5", "chosen": 100, "correct": 40},
        {"uri": "6", "chosen": 100, "correct": 30},
        {"uri": "7", "chosen": 100, "correct": 20},
        {"uri": "8", "chosen": 100, "correct": 10},
        {"uri": "N", "chosen": 1, "correct": 1},
    ], aq(20)), {"alloc": "N", "grade": 10});

    // ..even if we're doing badly
    test.deepEqual(modalAllocation([
        {"uri": "0", "chosen": 100, "correct": 90},
        {"uri": "1", "chosen": 100, "correct": 80},
        {"uri": "2", "chosen": 100, "correct": 70},
        {"uri": "3", "chosen": 100, "correct": 60},
        {"uri": "4", "chosen": 100, "correct": 50},
        {"uri": "5", "chosen": 100, "correct": 40},
        {"uri": "6", "chosen": 100, "correct": 30},
        {"uri": "7", "chosen": 100, "correct": 20},
        {"uri": "8", "chosen": 100, "correct": 10},
        {"uri": "N", "chosen": 1, "correct": 1},
    ], aq(-5)), {"alloc": "N", "grade": 0});

    // .. I said, even if we're doing badly.
    test.deepEqual(modalAllocation([
        {"uri": "0", "chosen": 100, "correct": 50},
        {"uri": "1", "chosen": 100, "correct": 40},
        {"uri": "2", "chosen": 100, "correct": 30},
        {"uri": "3", "chosen": 100, "correct": 20},
        {"uri": "4", "chosen": 100, "correct": 10},
        {"uri": "N", "chosen": 3, "correct": 0},
    ], aq(0)), {"alloc": "N", "grade": 0});

    // Don't get the same question immediately after
    test.ok(["0", "2"].indexOf(modalAllocation([
        {"uri": "0", "chosen": 100, "correct": 70},
        {"uri": "2", "chosen": 100, "correct": 50},
        {"uri": "4", "chosen": 100, "correct": 10},
        {"uri": "6", "chosen": 100, "correct": 10},
        {"uri": "8", "chosen": 100, "correct": 10},
    ], [
        {"uri": "8", "correct": true},  // NB: Just to ensure grade is correct
    ]).alloc) !== -1);
    test.ok(["0", "4"].indexOf(modalAllocation([
        {"uri": "0", "chosen": 100, "correct": 70},
        {"uri": "2", "chosen": 100, "correct": 50},
        {"uri": "4", "chosen": 100, "correct": 10},
        {"uri": "6", "chosen": 100, "correct": 10},
        {"uri": "8", "chosen": 100, "correct": 10},
    ], [
        {"uri": "2", "correct": true},
    ]).alloc) !== -1);

    // Question template will win with really high probability
    test.ok(["t0"].indexOf(modalAllocation([
        {"uri": "qn0", "chosen": 100, "correct": 70},
        { _type: "template", "uri": "t0" },
    ], [], {"prob_template": "0.9"}, false).alloc) !== -1);

    // ... but not in practice mode
    test.ok(["qn0"].indexOf(modalAllocation([
        {"uri": "qn0", "chosen": 100, "correct": 70},
        { _type: "template", "uri": "t0" },
    ], [], {"prob_template": "0.9"}, true).alloc) !== -1);

    // Grade is ignored when it comes to template questions
    (function() {
        var alloc, answerQueue = aq(5);
        iaalib.gradeAllocation({}, answerQueue);

        // A normal question will get a smaller timeout
        alloc = iaalib.newAllocation({ "lectures": [
            {
                "questions": [{ "uri": "qn0", "chosen": 100, "correct": 70 }],
                "settings": {"prob_template": "0.9", "timeout_max": "10"}
            }
        ]}, 0, answerQueue, false);
        test.ok(alloc.grade_before > 0);
        test.ok(alloc.allotted_time < 580);

        // A template question still gets maximum though
        alloc = iaalib.newAllocation({ "lectures": [
            {
                "questions": [{ _type: "template", "uri": "t0" }],
                "settings": {"prob_template": "0.9", "timeout_max": "10"}
            }
        ]}, 0, answerQueue, false);
        test.ok(alloc.grade_before > 0);
        test.equal(alloc.allotted_time, null);
    })()

    test.done();
};

module.exports.testItemAllocationPracticeMode = function (test) {
    // Item allocation passes through practice mode
    var alloc;
    alloc = iaalib.newAllocation(this.curTutorial, 0, [], false);
    test.equal(alloc.practice, false, "Practice mode not in allocation");

    alloc = iaalib.newAllocation(this.curTutorial, 0, [], true);
    test.equal(alloc.practice, true, "Practice mode not in allocation");

    test.done();
};

module.exports.testQuestionDistribution = function (test) {
    var defaultQns = [
        {"uri": "0", "chosen": 100, "correct": 10},
        {"uri": "1", "chosen": 100, "correct": 20},
        {"uri": "2", "chosen": 100, "correct": 30},
        {"uri": "3", "chosen": 100, "correct": 40},
        {"uri": "4", "chosen": 100, "correct": 50},
        {"uri": "5", "chosen": 100, "correct": 60},
        {"uri": "6", "chosen": 100, "correct": 70},
        {"uri": "7", "chosen": 100, "correct": 80},
        {"uri": "8", "chosen": 100, "correct": 90},
        {"uri": "9", "chosen": 100, "correct": 99}
    ];

    function questionOrder(qn, grade, aq) {
        var i, dist, prevProb = 0, total = 0, qnOrder = [];
        dist = iaalib.questionDistribution.apply(iaalib, arguments);
        for (i = 0; i < dist.length; i++) {
            test.ok(dist[i].probability >= prevProb);
            prevProb = dist[i].probability;
            total += dist[i].probability;
            qnOrder.unshift(dist[i].qn.uri);
        }
        test.ok(Math.abs(total - 1) < 0.00001);

        return qnOrder;
    }

    // Previous items get weighted down
    test.deepEqual(
        questionOrder(defaultQns, 3, []),
        ['7', '6', '8', '5', '4', '9', '3', '2', '1', '0']
    );
    test.deepEqual(
        questionOrder(defaultQns, 3, [{"uri": "6", "correct": true}]),
        ['7', '8', '5', '4', '9', '3', '2', '1', '6', '0']
    );

    // Old incorrect questions get boosted
    test.deepEqual(
        questionOrder(defaultQns, 3, [
            {"uri": "3", "correct": false},
            {"uri": "0", "correct": true},
            {"uri": "0", "correct": true},
            {"uri": "0", "correct": true},
            {"uri": "0", "correct": true},
            {"uri": "0", "correct": true},
            {"uri": "0", "correct": true},
            {"uri": "0", "correct": true},
        ]),
        ['3', '7', '6', '8', '5', '4', '9', '2', '1', '0']
    );

    // A new answer overrides this boosting
    test.deepEqual(
        questionOrder(defaultQns, 3, [
            {"uri": "3", "correct": false},
            {"uri": "0", "correct": true},
            {"uri": "0", "correct": true},
            {"uri": "0", "correct": true},
            {"uri": "0", "correct": true},
            {"uri": "0", "correct": true},
            {"uri": "0", "correct": true},
            {"uri": "0", "correct": true},
            {"uri": "3", "correct": true},
        ]),
        ['7', '6', '8', '5', '4', '9', '2', '1', '3', '0']
    );

    // Can add extras, dist still correct (i.e. adds up to 1)
    test.deepEqual(
        questionOrder(defaultQns, 3, [], [
            {_type: "template", uri: "t0"},
            {_type: "template", uri: "t1"},
            {_type: "template", uri: "t2"},
        ], 0.2),
        ['7', '6', '8', '5', '4', '9', '3', '2', 't0', 't1', 't2', '1', '0']
    );

    // Can boost their probability
    test.deepEqual(
        questionOrder(defaultQns, 3, [], [
            {_type: "template", uri: "t0"},
            {_type: "template", uri: "t1"},
            {_type: "template", uri: "t2"},
        ], 0.25),
        ['7', '6', '8', '5', '4', 't2', 't1', 't0', '9', '3', '2', '1', '0']
    );

    // Or hide them entirely
    test.deepEqual(
        questionOrder(defaultQns, 3, [], [
            {_type: "template", uri: "t0"},
            {_type: "template", uri: "t1"},
            {_type: "template", uri: "t2"},
        ], 0),
        ['7', '6', '8', '5', '4', '9', '3', '2', '1', '0']
    );

    // Assigned probability adds up
    iaalib.questionDistribution(defaultQns, 3, [], [
        {_type: "template", uri: "t0"},
        {_type: "template", uri: "t1"},
        {_type: "template", uri: "t2"},
    ], 0.2).filter(function (d) { return d.qn._type === "template" }).map(function (d) {
        test.ok(Math.abs(d.probability - (0.2 / 3)) < 0.0001);
    });
    iaalib.questionDistribution(defaultQns, 3, [], [
        {_type: "template", uri: "t0"},
        {_type: "template", uri: "t1"},
    ], 0.6).filter(function (d) { return d.qn._type === "template" }).map(function (d) {
        test.ok(Math.abs(d.probability - (0.6 / 2)) < 0.0001);
    });

    test.done();
};

module.exports.testWeighting = function (test) {
    var i;

    function weighting(n, alpha, s) {
        var i,
            total = 0,
            weightings = iaalib.gradeWeighting(n, alpha, s, 8, 30);
        // Should have at least 1 thing to grade
        if (n === 0) return [];

        // Should always sum to 1
        for (i = 0; i < weightings.length; i++) {
            total += weightings[i];
        }
        if (n > 1) {
            test.ok(total > 0.99999 && total < 1.000001, total);
        }

        // Squish down to 4dp for comparison
        return weightings.map(function (x) {
            return x.toFixed(4);
        });
    };

    // Asking for one weighting gives you 8
    test.deepEqual(weighting(1, 0.5, 2), [
        '0.5000','0.1750','0.1286','0.0893',
        '0.0571','0.0321','0.0143','0.0036']);
    test.deepEqual(weighting(5, 0.3, 2), [
        '0.3500','0.2571','0.1786','0.1143',
        '0.0643','0.0286','0.0071','0.0000']);

    // Curve small enough for alpha to go at beginning, truncate at 30
    test.deepEqual(weighting(50, 0.5, 2), [
        '0.5000','0.0492','0.0458','0.0426',
        '0.0395','0.0365','0.0337','0.0309',
        '0.0283','0.0258','0.0234','0.0211',
        '0.0189','0.0169','0.0150','0.0132',
        '0.0115','0.0099','0.0084','0.0071',
        '0.0058','0.0047','0.0037','0.0029',
        '0.0021','0.0015','0.0009','0.0005',
        '0.0002','0.0001']);

    // If it rises beyond alpha, don't use it
    test.deepEqual(weighting(5, 0.2, 2), [
        '0.3500','0.2571','0.1786','0.1143',
        '0.0643','0.0286','0.0071','0.0000']);

    // Length should be either i or 30
    test.deepEqual(weighting(0, 0.5, 2), [])
    test.deepEqual(weighting(0, 0.3, 2), [])
    for (i = 1; i < 50; i++) {
        test.equal(weighting(i, 0.5, 2).length, Math.min(Math.max(i, 8), 30));
        test.equal(weighting(i, 0.3, 2).length, Math.min(Math.max(i, 8), 30));
    }

    test.done();
};

module.exports.testGrading = function (test) {
    function grade(queue, settings) {
        var i, answerQueue = [];

        for (i = 0; i < queue.length; i++) {
            answerQueue.push(queue[i]);
            iaalib.gradeAllocation(settings || {}, answerQueue);
        }

        return answerQueue[answerQueue.length - 1];
    };

    // Generate a very long string of answers, some should be ignored
    var i, longGrade = [];
    for (i = 0; i < 200; i++) {
        longGrade.push({
            "correct": (Math.random() < 0.5),
            "practice": false,
        });
    }

    // grade_next_right should be consistent with what comes after
    [
        [
            {"correct": false, "practice": false, "answer_time": 1234},
        ], [
            {"correct": true, "practice": false, "answer_time": 1234},
            {"correct": false, "practice": false, "answer_time": 1234},
            {"correct": false, "practice": false, "answer_time": 1234},
        ], [
            {"correct": true, "practice": false, "answer_time": 1234},
            {"correct": true, "practice": false, "answer_time": 1234},
            {"correct": false, "practice": false, "answer_time": 1234},
            {"correct": true, "practice": false, "answer_time": 1234},
            {"correct": true, "practice": false, "answer_time": 1234},
            {"correct": false, "practice": false, "answer_time": 1234},
        ], [
            {"correct": true, "practice": false, "answer_time": 1234},
            {"correct": true, "practice": false, "answer_time": 1234},
            {"correct": false, "practice": false, "answer_time": 1234},
            {"correct": false, "practice": false, "answer_time": 1234},
            {"correct": false, "practice": false, "answer_time": 1234},
            {"correct": false, "practice": false, "answer_time": 1234},
        ], longGrade
    ].map(function (answerQueue) {
        test.equal(
            grade(answerQueue).grade_next_right,
            grade(answerQueue.concat([
                {"correct": true, "practice": false, "answer_time": 1234},
            ])).grade_after);
    });

    // Unanswered questions should be ignored
    test.ok(!grade([{"correct": false, "practice": false, "answer_time": 1234}, {"grade_before": 0}].hasOwnProperty('grade_after')));
    test.ok(!grade([{"correct": false, "practice": false, "answer_time": 1234}, {}].hasOwnProperty('grade_next_right')));

    // No answers returns nothing
    (function () {
        var aq = [];
        iaalib.gradeAllocation({}, []);
        test.deepEqual(aq, []);
    })()

    // One incorrect answer should be 0
    test.equal(grade([
        {"correct": false, "answer_time": 1234},
    ]).grade_after, 0);

    // One or two correct answers give us a higher score, but not the maximum
    test.ok(grade([{"correct": true, "answer_time": 1234}]).grade_after > 0);
    test.ok(grade([{"correct": true, "answer_time": 1234}]).grade_after < 10);
    test.ok(grade([{"correct": true, "answer_time": 1234}, {"correct": true, "answer_time": 1234}]).grade_after > 0);
    test.ok(grade([{"correct": true, "answer_time": 1234}, {"correct": true, "answer_time": 1234}]).grade_after < 10);

    // Grade shouldn't fall below 0
    test.equal(grade([
        {"correct": false, "practice": false, "answer_time": 1234},
        {"correct": false, "practice": false, "answer_time": 1234},
        {"correct": false, "practice": false, "answer_time": 1234},
        {"correct": false, "practice": false, "answer_time": 1234},
        {"correct": false, "practice": false, "answer_time": 1234},
        {"correct": false, "practice": false, "answer_time": 1234},
        {"correct": false, "practice": false, "answer_time": 1234},
        {"correct": false, "practice": false, "answer_time": 1234},
    ]).grade_after, 0);

    // Unanswered question gets "grade_before" instead
    test.deepEqual(grade([
        {"correct": true, "practice": false, "answer_time": 1234},
        {"correct": true, "practice": false, "answer_time": 1234},
        {"practice": false},
    ]), {
        "practice": false,
        "grade_before": grade([{"correct": true, "answer_time": 1234}, {"correct": true, "answer_time": 1234}]).grade_after,
        "grade_next_right": grade([{"correct": true, "answer_time": 1234}, {"correct": true, "answer_time": 1234}, {"correct": true, "answer_time": 1234}]).grade_after,
    });

    
    
    // By default, alpha is 0.3 (which should be your grade with one correct answer)
    test.equal(
        grade([{"correct": true, "answer_time": 1234}], {}).grade_after,
        Math.max(Math.round(iaalib.gradeWeighting(1, 0.125, 2, 8, 30)[0] * 40) / 4, 0));
    test.equal(
        grade([{"correct": true, "answer_time": 1234}], {}).grade_after,
        grade([{"correct": true, "answer_time": 1234}], {"grade_alpha" : 0.125}).grade_after);
    test.notEqual(
        grade([{"correct": true, "answer_time": 1234}], {}).grade_after,
        grade([{"correct": true, "answer_time": 1234}], {"grade_alpha" : 0.5}).grade_after);
    test.equal(
        grade([{"correct": true, "answer_time": 1234}], {"grade_alpha" : 0.5}).grade_after,
        Math.max(Math.round(iaalib.gradeWeighting(1, 0.5, 2, 8, 30)[0] * 40) / 4, 0));
    test.equal(
        grade([{"correct": true, "answer_time": 1234}], {"grade_alpha" : 0.2}).grade_after,
        Math.max(Math.round(iaalib.gradeWeighting(1, 0.2, 2, 8, 30)[0] * 40) / 4, 0));

    // By default, s is 2
    test.equal(
        grade([{"correct": true, "answer_time": 1234}, {"correct": true, "answer_time": 1234}], {"grade_alpha" : 0.3}).grade_after,
        grade([{"correct": true, "answer_time": 1234}, {"correct": true, "answer_time": 1234}], {"grade_alpha" : 0.3, "grade_s" : 2}).grade_after);
    test.notEqual(
        grade([{"correct": true, "answer_time": 1234}, {"correct": true, "answer_time": 1234}], {"grade_alpha" : 0.3, "grade_s" : 2}).grade_after,
        grade([{"correct": true, "answer_time": 1234}, {"correct": true, "answer_time": 1234}], {"grade_alpha" : 0.3, "grade_s" : 5}).grade_after);

    // Grade generally goes up.
    (function () {
        var i,
            curGrade = 0,
            answers = [
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": false, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
                {"correct": true, "answer_time": 1234},
            ];
        answers.map(function (a, i) {
            var aq = answers.slice(0, i + 1);
            iaalib.gradeAllocation({"grade_alpha" : 0.154, "grade_s": 1}, aq);
        });

        for (i = 0; i < answers.length; i++) {
            test.ok( answers[i].correct
                   ? answers[i].grade_after >= curGrade
                   : answers[i].grade_after < curGrade);
            curGrade = answers[i].grade_after;
        }
    }());

    test.done();
};

module.exports.testGradingPracticeMode = function (test) {
    function grade(queue) {
        var i, answerQueue = [];

        for (i = 0; i < queue.length; i++) {
            answerQueue.push(queue[i]);
            iaalib.gradeAllocation({}, answerQueue);
        }

        return answerQueue[answerQueue.length - 1];
    };

    // All practice mode should leave you with a grade of 0
    test.equal(grade([
            {"correct": true, "practice": true, "answer_time": 1234},
            {"correct": false, "practice": true, "answer_time": 1234},
            {"correct": true, "practice": true, "answer_time": 1234},
            {"correct": false, "practice": true, "answer_time": 1234},
            {"correct": true, "practice": true, "answer_time": 1234},
        ]).grade_after, 0);

    // Practice mode shouldn't affect score
    test.equal(
        grade([
            {"correct": true, "practice": true, "answer_time": 1234},
            {"correct": true, "practice": true, "answer_time": 1234},
            {"correct": false, "practice": false, "answer_time": 1234},
            {"correct": false, "practice": true, "answer_time": 1234},
            {"correct": true, "practice": false, "answer_time": 1234},
        ]).grade_after,
        grade([
            {"correct": false, "practice": false, "answer_time": 1234},
            {"correct": true, "practice": false, "answer_time": 1234},
        ]).grade_after);

    test.equal(
        grade([
            {"correct": true, "practice": true, "answer_time": 1234},
            {"correct": true, "practice": true, "answer_time": 1234},
            {"correct": false, "practice": false, "answer_time": 1234},
            {"correct": false, "practice": true, "answer_time": 1234},
            {"correct": true, "practice": false, "answer_time": 1234},
            {"correct": true, "practice": true, "answer_time": 1234},
            {"correct": true, "practice": true, "answer_time": 1234},
            {"correct": true, "practice": true, "answer_time": 1234},
            {"correct": true, "practice": true, "answer_time": 1234},
            {"correct": true, "practice": true, "answer_time": 1234},
            {"correct": true, "practice": true, "answer_time": 1234},
            {"correct": true, "practice": true, "answer_time": 1234},
            {"correct": true, "practice": true, "answer_time": 1234},
        ]).grade_after,
        grade([
            {"correct": false, "practice": false, "answer_time": 1234},
            {"correct": true, "practice": false, "answer_time": 1234},
        ]).grade_after);

    // If practice question is latest, just rabbit same grade again.
    test.deepEqual(grade([
        {"correct": true, "practice": false, "answer_time": 1234},
        {"practice": true},
    ]), {
        "practice": true,
        "grade_before": grade([{"correct": true, "answer_time": 1234}]).grade_after,
        "grade_next_right": grade([{"correct": true, "answer_time": 1234}, {"correct": true, "answer_time": 1234}]).grade_after,
    });
    test.deepEqual(grade([
        {"correct": true, "practice": false, "answer_time": 1234},
        {"correct": true, "practice": true, "answer_time": 1234},
    ]), {
        "correct": true,
        "practice": true,
        "answer_time": 1234,
        "grade_after": grade([{"correct": true, "answer_time": 1234}]).grade_after,
        "grade_next_right": grade([{"correct": true, "answer_time": 1234}, {"correct": true, "answer_time": 1234}]).grade_after,
    });

    // missing correct shouldn't have any affect on grade either
    test.equal(
        grade([
            {"correct": null, "answer_time": 1234},
            {"correct": null, "answer_time": 1234},
            {"correct": null, "answer_time": 1234},
            {"correct": null, "answer_time": 1234},
            {"correct": true, "practice": false, "answer_time": 1234},
            {"correct": null, "answer_time": 1234},
            {"correct": null, "answer_time": 1234},
            {"correct": true, "practice": false, "answer_time": 1234},
        ]).grade_after,
        grade([
            {"correct": true, "practice": false, "answer_time": 1234},
            {"correct": true, "practice": false, "answer_time": 1234},
        ]).grade_after);
    test.equal(
        grade([
            {"correct": true, "practice": false, "answer_time": 1234},
            {"correct": true, "practice": false, "answer_time": 1234},
            {"correct": null, "answer_time": 1234},
            {"correct": true, "practice": false, "answer_time": 1234},
            {"correct": null},
            {},
        ]).grade_before,
        grade([
            {"correct": true, "practice": false, "answer_time": 1234},
            {"correct": true, "practice": false, "answer_time": 1234},
            {"correct": true, "practice": false, "answer_time": 1234},
        ]).grade_after);

    test.done();
};

module.exports.testTimeout = function (test) {
    var i;

    // Low grades get the tMax
    test.equal(iaalib.qnTimeout({
        "timeout_min": "3",
        "timeout_max": "7",
        "timeout_grade": "5",
        "timeout_std": "0.5",
    }, 0) / 60, 7);
    test.equal(iaalib.qnTimeout({
        "timeout_min": "13",
        "timeout_max": "27",
        "timeout_grade": "10",
        "timeout_std": "0.5",
    }, 0) / 60, 27);

    // High grades get the tMax
    test.equal(iaalib.qnTimeout({
        "timeout_min": "3",
        "timeout_max": "7",
        "timeout_grade": "5",
        "timeout_std": "0.5",
    }, 10) / 60, 7);
    test.equal(iaalib.qnTimeout({
        "timeout_min": "13",
        "timeout_max": "27",
        "timeout_grade": "10",
        "timeout_std": "0.5",
    }, 20) / 60, 27);

    // Middle grades get the tMin
    test.equal(iaalib.qnTimeout({
        "timeout_min": "3",
        "timeout_max": "7",
        "timeout_grade": "5",
        "timeout_std": "0.5",
    }, 5) / 60, 3);
    test.equal(iaalib.qnTimeout({
        "timeout_min": "13",
        "timeout_max": "27",
        "timeout_grade": "8",
        "timeout_std": "0.5",
    }, 8) / 60, 13);

    test.done();
};
