// Bodge in what we need from libraries.js
Array.last=Array.last||function(a){return 0<a.length?a[a.length-1]:null};
var iaa = require('../tutorweb/quiz/resources/iaa_lib.js');

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
    var a = iaa.newAllocation(this.curTutorial, 0, [], false);
    test.ok(a.uri.match(/ut:question[0-4]/))
    test.equal(a.grade_before, 0);
    test.ok(a.grade_after_right > a.grade_after_wrong);

    test.done();
};

module.exports.testPracticeMode = function (test) {
    // Ensure practice mode doesn't affect score
    var a, expectedScore;
    a = iaa.newAllocation(this.curTutorial, 0, [
        {"correct": true, "practice": false},
        {"correct": true, "practice": false},
        {"correct": false, "practice": false},
        {"correct": false, "practice": false},
        {"correct": true, "practice": false},
    ], false);
    test.equal(a.practice, false, "By default practice mode should be off");
    test.ok(a.grade_after_right > a.grade_after_wrong);
    test.equal(a['allotted_time'], 553);
    expectedScore = a.grade_before;

    // When in Practice mode, grade results are the same
    a = iaa.newAllocation(this.curTutorial, 0, [
        {"correct": true, "practice": false},
        {"correct": true, "practice": false},
        {"correct": false, "practice": false},
        {"correct": false, "practice": false},
        {"correct": true, "practice": false},
    ], true);
    test.equal(a.practice, true);
    test.equal(a.grade_after_right, a.grade_after_wrong);
    test.equal(a['allotted_time'], 553);

    // Get the same grade with lots of practice questions in the way
    test.equal(iaa.newAllocation(this.curTutorial, 0, [
        {"correct": true, "practice": false},
        {"correct": true, "practice": false},
        {"correct": false, "practice": true},
        {"correct": false, "practice": true},
        {"correct": false, "practice": true},
        {"correct": false, "practice": true},
        {"correct": false, "practice": true},
        {"correct": false, "practice": false},
        {"correct": false, "practice": false},
        {"correct": true, "practice": false},
    ], false).grade_before, expectedScore);
    test.equal(iaa.newAllocation(this.curTutorial, 0, [
        {"correct": true, "practice": false},
        {"correct": true, "practice": false},
        {"correct": false, "practice": false},
        {"correct": false, "practice": false},
        {"correct": true, "practice": false},
        {"correct": false, "practice": true},
        {"correct": false, "practice": true},
    ], false).grade_before, expectedScore);

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
        }
        for (i = 0; i < 7000; i++) {
            // Allocate a question based on answerQueue
            alloc = iaa.newAllocation({ "lectures": [
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

module.exports.testGrading = function (test) {
    function grade(trueFalse) {
        var alloc,
            answerQueue = trueFalse.map(function (correct) {
            return {"correct": correct, "practice": false};
        });

        // Run allocation with enough lecture to get a result
        alloc = iaa.newAllocation({ "lectures": [
            {"questions": [
                {"uri": "0", "chosen": 100, "correct": 90},
            ], "settings": {"hist_sel": "0"}},
        ]}, 0, answerQueue, false);
        return alloc;
    };
    // Generate a very long string of answers, some should be ignored
    var i, longGrade = [];
    for (i = 0; i < 200; i++) {
        longGrade.push(Math.random() < 0.5);
    }

    // grade_after_right should be consistent with what comes after
    test.equal(
        grade([]).grade_after_right,
        grade([true]).grade_before);
    test.equal(
        grade([true, false, false]).grade_after_right,
        grade([true, false, false, true]).grade_before);
    test.equal(
        grade([true, true, false, true, true, false]).grade_after_right,
        grade([true, true, false, true, true, false, true]).grade_before);
    test.equal(
        grade([true, true, false, true, true, false]).grade_after_right,
        grade([true, true, false, true, true, false, true]).grade_before);
    test.equal(
        grade(longGrade).grade_after_right,
        grade(longGrade.concat([true])).grade_before);

    // So should grade_after_wrong
    test.equal(
        grade([]).grade_after_wrong,
        grade([false]).grade_before);
    test.equal(
        grade([true, false, false]).grade_after_wrong,
        grade([true, false, false, false]).grade_before);
    test.equal(
        grade([true, true, false, true, true, false]).grade_after_wrong,
        grade([true, true, false, true, true, false, false]).grade_before);
    test.equal(
        grade(longGrade).grade_after_wrong,
        grade(longGrade.concat([false])).grade_before);

    test.done();
};
