// Bodge in what we need from libraries.js
Array.last=Array.last||function(a){return 0<a.length?a[a.length-1]:null};
var iaalib = new (require('../lib/iaa.js'))();

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
    /** Run allocation 1000 times, get mean question chosen*/
    function modalAllocation(qns, correctAnswers) {
        var uris = {}, i, answerQueue = [], grade = null;
        // Build answerQueue of correctAnswers
        for (i = 0; i < Math.abs(correctAnswers); i++) {
            answerQueue.push({"correct": (correctAnswers > 0)});
            iaalib.gradeAllocation(answerQueue);
        }
        for (i = 0; i < 7000; i++) {
            // Allocate a question based on answerQueue
            alloc = iaalib.newAllocation({ "lectures": [
                {"questions": qns, "settings": {"hist_sel": "0"}}
            ]}, 0, answerQueue, false);
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
    ], 0), {"alloc": "0", "grade": 0});

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
    ], 0), {"alloc": "1", "grade": 0});

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
    ], 10), {"alloc": "8", "grade": 10});

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
    ], 4), 4, 6));

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
    ], 20), {"alloc": "8", "grade": 10});

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
    ], 20), {"alloc": "N", "grade": 10});

    // ..but not if we're doing badly.
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
    ], -5), {"alloc": "0", "grade": 0}); //TODO: IAA expects grade to go negative, it's not?

    // ..but not if we're doing badly.
    test.deepEqual(modalAllocation([
        {"uri": "0", "chosen": 100, "correct": 50},
        {"uri": "1", "chosen": 100, "correct": 40},
        {"uri": "2", "chosen": 100, "correct": 30},
        {"uri": "3", "chosen": 100, "correct": 20},
        {"uri": "4", "chosen": 100, "correct": 10},
        {"uri": "N", "chosen": 1, "correct": 1},
    ], -5), {"alloc": "0", "grade": 0}); //TODO: IAA expects grade to go negative, it's not?

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

module.exports.testGrading = function (test) {
    function grade(trueFalse) {
        var i, answerQueue = [];

        for (i = 0; i < trueFalse.length; i++) {
            answerQueue.push({"correct": trueFalse[i], "practice": false});
            iaalib.gradeAllocation(answerQueue);
        }

        return answerQueue[answerQueue.length - 1];
    };

    // Generate a very long string of answers, some should be ignored
    var i, longGrade = [];
    for (i = 0; i < 200; i++) {
        longGrade.push(Math.random() < 0.5);
    }

    [
        [
            {"correct": false, "practice": false},
        ], [
            {"correct": true, "practice": false},
            {"correct": false, "practice": false},
            {"correct": false, "practice": false},
        ], [
            {"correct": true, "practice": false},
            {"correct": true, "practice": false},
            {"correct": false, "practice": false},
            {"correct": true, "practice": false},
            {"correct": true, "practice": false},
            {"correct": false, "practice": false},
        ], [
            {"correct": true, "practice": false},
            {"correct": true, "practice": false},
            {"correct": false, "practice": false},
            {"correct": false, "practice": false},
            {"correct": false, "practice": false},
            {"correct": false, "practice": false},
        ], longGrade
    ].map(function (answerQueue) {
        // grade_next_right should be consistent with what comes after
        test.equal(
            grade(answerQueue).grade_next_right,
            grade(answerQueue.concat([true])).grade_after);

        // So should grade_next_wrong
        test.equal(
            grade(answerQueue).grade_next_wrong,
            grade(answerQueue.concat([false])).grade_after);
    });

    // Unanswered questions should be ignored
    test.ok(!grade([{"correct": false, "practice": false}, {"grade_before": 0}].hasOwnProperty('grade_after')));
    test.ok(!grade([{"correct": false, "practice": false}, {}].hasOwnProperty('grade_next_right')));

    test.done();
};

module.exports.testGradingPracticeMode = function (test) {
    function grade(queue) {
        var i, answerQueue = [];

        for (i = 0; i < queue.length; i++) {
            answerQueue.push(queue[i]);
            iaalib.gradeAllocation(answerQueue);
        }

        return answerQueue[answerQueue.length - 1];
    };

    // All practice mode should leave you with a grade of 0
    test.equal(grade([
            {"correct": true, "practice": true},
            {"correct": false, "practice": true},
            {"correct": true, "practice": true},
            {"correct": false, "practice": true},
            {"correct": true, "practice": true},
        ]).grade_after, 0);

    // Practice mode shouldn't affect score
    test.equal(
        grade([
            {"correct": true, "practice": true},
            {"correct": true, "practice": true},
            {"correct": false, "practice": false},
            {"correct": false, "practice": true},
            {"correct": true, "practice": false},
        ]).grade_after,
        grade([
            {"correct": false, "practice": false},
            {"correct": true, "practice": false},
        ]).grade_after);

    test.equal(
        grade([
            {"correct": true, "practice": true},
            {"correct": true, "practice": true},
            {"correct": false, "practice": false},
            {"correct": false, "practice": true},
            {"correct": true, "practice": false},
            {"correct": true, "practice": true},
            {"correct": true, "practice": true},
            {"correct": true, "practice": true},
            {"correct": true, "practice": true},
            {"correct": true, "practice": true},
            {"correct": true, "practice": true},
            {"correct": true, "practice": true},
            {"correct": true, "practice": true},
        ]).grade_after,
        grade([
            {"correct": false, "practice": false},
            {"correct": true, "practice": false},
        ]).grade_after);

    test.done();
};
