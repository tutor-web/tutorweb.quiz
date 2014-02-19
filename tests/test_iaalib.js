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
