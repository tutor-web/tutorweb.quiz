"use strict";

var Quiz = require('../lib/quizlib.js');
var tk = require('timekeeper');
var Promise = require('es6-promise').Promise;

function MockLocalStorage() {
    this.obj = {};
    this.length = 0;

    this.removeItem = function (key) {
        this.length--;
        return delete this.obj[key];
    };

    this.getItem = function (key) {
        var value = this.obj[key];
        return typeof value === 'undefined' ? null : value;
    };

    this.setItem = function (key, value) {
        if (!this.obj.hasOwnProperty(key)) {
            this.length++;
        }
        return this.obj[key] = value;
    };

    this.key = function (i) {
        return Object.keys(this.obj)[i];
    };
}

function MockAjaxApi() {
    this.count = 0;
    this.responses = {};
    this.data = {};

    this.getHtml = function (uri) {
        return this.block('GET ' + uri + ' ' + this.count++, undefined);
    }

    this.getJson = function (uri) {
        return this.block('GET ' + uri + ' ' + this.count++, undefined);
    }

    this.postJson = function (uri, data) {
        return this.block('POST ' + uri + ' ' + this.count++, data);
    }

    this.ajax = function (call) {
        return this.block(call.type + ' ' + call.url + this.count++);
    }

    /** Block until responses[promiseId] contains something to resolve to */
    this.block = function (promiseId, data) {
        var self = this, timerTick = 100;
        self.responses[promiseId] = null;
        this.data[promiseId] = data;

        return new Promise(function(resolve, reject) {
            setTimeout(function tick() {
                var r = self.responses[promiseId];
                if (!r) {
                    return window.setTimeout(tick(), timerTick);
                }

                delete self.responses[promiseId];
                delete self.data[promiseId];
                if (r instanceof Error) {
                    reject(r);
                } else {
                    resolve(r);
                }
            }, timerTick);
        });
    };

    this.getQueue = function () {
        return Object.keys(this.responses);
    };

    this.setResponse = function (promiseId, ret) {
        return this.responses[promiseId] = ret;
    };
}

function getQn(quiz, practiceMode) {
    return new Promise(function(resolve, reject) {
        quiz.getNewQuestion({practice: practiceMode}, function(qn, a) {
            resolve({qn: qn, a: a});
        });
    });
}
function setAns(quiz, choice) {
    return new Promise(function(resolve, reject) {
        quiz.setQuestionAnswer(
            typeof(choice) === "object" ? choice : [{name: "answer", value: choice}],
            function(a, ansData) {
                resolve({a: a, answerData: ansData});
            }
        );
    });
}

module.exports.setUp = function (callback) {
    this.utTutorial = { "title": "UT tutorial", "lectures": []};

    this.utTutorial.lectures.push({
        "answerQueue": [],
        "questions": [
            {"uri": "ut:question0", "chosen": 20, "correct": 100},
            {"uri": "ut:question1", "chosen": 40, "correct": 100},
            {"uri": "ut:question2", "chosen": 60, "correct": 100},
        ],
        "settings": {
            "hist_sel": 0,
        },
        "uri":"ut:lecture0",
        "question_uri":"ut:lecture0:all-questions",
    });

    this.utQuestions = {
        "ut:question0" : {
            "text": '<div>The symbol for the set of all irrational numbers is... (a)</div>',
            "choices": [
                '<div>$\\mathbb{R} \\backslash \\mathbb{Q}$ (me)</div>',
                '<div>$\\mathbb{Q} \\backslash \\mathbb{R}$</div>',
                '<div>$\\mathbb{N} \\cap \\mathbb{Q}$</div>' ],
            "shuffle": [0, 1, 2],
            "answer": {
                "explanation": "<div>\nThe symbol for the set of all irrational numbers (a)\n</div>",
                "correct": [0]
            }
        },
        "ut:question1" : {
            "text": '<div>The symbol for the set of all irrational numbers is... (b)</div>',
            "choices": [
                '<div>$\\mathbb{R} \\backslash \\mathbb{Q}$ (me)</div>',
                '<div>$\\mathbb{Q} \\backslash \\mathbb{R}$</div>',
                '<div>$\\mathbb{N} \\cap \\mathbb{Q}$ (me)</div>' ],
            "shuffle": [0, 1],
            "answer": {
                "explanation": "<div>\nThe symbol for the set of all irrational numbers (b)\n</div>",
                "correct": [0, 2]
            }
        },
        "ut:question2" : {
            "text": '<div>The symbol for the set of all irrational numbers is... (c)</div>',
            "choices": [
                '<div>$\\mathbb{R} \\backslash \\mathbb{Q}$</div>',
                '<div>$\\mathbb{Q} \\backslash \\mathbb{R}$</div>',
                '<div>$\\mathbb{N} \\cap \\mathbb{Q}$</div>' ],
            "shuffle": [0, 1, 2],
            "answer": {
                "explanation": "<div>\nThe symbol for the set of all irrational numbers (c)\n</div>",
                "correct": [0]
            }
        },
    };

    /** Configure a simple tutorial/lecture, ready for questions */
    this.defaultLecture = function (quiz) {
        quiz.insertTutorial('ut:tutorial0', 'UT tutorial', [
            {
                "answerQueue": [],
                "questions": [
                    {"uri": "ut:question0", "chosen": 20, "correct": 100},
                    {"uri": "ut:question1", "chosen": 40, "correct": 100},
                    {"uri": "ut:question2", "chosen": 40, "correct": 100},
                ],
                "settings": { "hist_sel": 0 },
                "uri":"ut:lecture0",
                "question_uri":"ut:lecture0:all-questions",
            },
        ]);
        quiz.insertQuestions(this.utQuestions);
        quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });
    };

    callback();
};

module.exports.test_getAvailableLectures = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls);
    var gradeStr, assignedQns = [];

    // At the start, everything should be synced
    this.defaultLecture(quiz);
    quiz.getAvailableLectures(function(tutorials) {
        test.deepEqual(tutorials, [
            { uri: 'ut:tutorial0', title: 'UT tutorial', lectures: [
                { uri: 'ut:lecture0', title: undefined, grade: '', synced: true },
            ]},
        ]);
    })

    // Answer a question
    Promise.resolve().then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, 0));
    }).then(function (args) {
        gradeStr = quiz.gradeString(args.a[args.a.length - 1]);
        if (assignedQns[0].correct) {
            gradeStr = '\nAnswered 1 questions, 1 correctly.\nYour grade: 3.5, if you get the next question right: 6';
        } else {
            gradeStr = '\nAnswered 1 questions, 0 correctly.\nYour grade: 0, if you get the next question right: 2.25';
        }
        return(args);
    }).then(function (args) {
        // Now one is unsynced
        quiz.getAvailableLectures(function(tutorials) {
            test.deepEqual(tutorials, [
                { uri: 'ut:tutorial0', title: 'UT tutorial', lectures: [
                    { uri: 'ut:lecture0', title: undefined, grade: gradeStr, synced: false },
                ]},
            ]);
        })

    }).then(function (args) {
        test.done();
    }).catch(function (err) {
        console.log(err.stack);
        test.fail(err);
        test.done();
    });
}

/** Should only remove genuinely unused objects */
module.exports.test_removeUnusedObjects = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls);

    // Load associated questions and a random extra
    ls.setItem('camel', 'yes');
    quiz.insertTutorial(
        'ut:tutorial0',
        this.utTutorial.title,
        this.utTutorial.lectures
    );
    quiz.insertQuestions(this.utQuestions);
    test.deepEqual(Object.keys(ls.obj).sort(), [
        '_index',
        'camel',
        'ut:question0',
        'ut:question1',
        'ut:question2',
        'ut:tutorial0',
    ]);

    // Insert tutorial again, this time with different questions
    this.utTutorial.lectures[0].questions = [
        {"uri": "ut:question0", "chosen": 20, "correct": 100},
        {"uri": "ut:question3", "chosen": 20, "correct": 100},
    ];
    this.utQuestions['ut:question3'] = this.utQuestions['ut:question1'];
    delete this.utQuestions['ut:question1'];
    delete this.utQuestions['ut:question2'];
    quiz.insertTutorial(
        'ut:tutorial0',
        this.utTutorial.title,
        this.utTutorial.lectures
    );
    quiz.insertQuestions(this.utQuestions);

    // insertTutorial/Questions tidies up the questions
    test.deepEqual(Object.keys(ls.obj).sort(), [
        '_index',
        'camel',
        'ut:question0',
        'ut:question3',
        'ut:tutorial0',
    ]);

    // RemoveUnused does.
    quiz.removeUnusedObjects();
    test.deepEqual(Object.keys(ls.obj).sort(), [
        '_index',
        'ut:question0',
        'ut:question3',
        'ut:tutorial0',
    ]);

    test.done();
};

/** Should suggest exactly which questions to fetch */
module.exports.test_syncQuestions = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls);
    var calls;

    // Load tutorial, but no questions
    quiz.insertTutorial('ut:tutorial0', 'UT tutorial', [
        {
            "answerQueue": [],
            "questions": [
                {"uri": "ut:question0", "chosen": 20, "correct": 100},
                {"uri": "ut:question1", "chosen": 40, "correct": 100},
                {"uri": "ut:question2", "chosen": 40, "correct": 100},
            ],
            "settings": { "hist_sel": 0 },
            "uri":"ut:lecture0",
            "question_uri":"ut:lecture0:all-questions",
        },
    ]);
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });

    // Sync should just load everything
    calls = quiz.syncQuestions();
    test.deepEqual(calls.map(function (a) { return a.url; }), [
        'ut:lecture0:all-questions'
    ]);

    // Load one of the questions, two are still missing
    quiz.insertQuestions({
        'ut:question0' : this.utQuestions['ut:question0'],
    });
    calls = quiz.syncQuestions();
    test.deepEqual(calls.map(function (a) { return a.url; }), [
        'ut:question1',
        'ut:question2',
    ]);

    // Still not quite there...
    quiz.insertQuestions({
        'ut:question0' : this.utQuestions['ut:question0'],
        'ut:question2' : this.utQuestions['ut:question2'],
    });
    calls = quiz.syncQuestions();
    test.deepEqual(calls.map(function (a) { return a.url; }), [
        'ut:question1',
    ]);

    // We're complete
    quiz.insertQuestions({
        'ut:question0' : this.utQuestions['ut:question0'],
        'ut:question1' : this.utQuestions['ut:question1'],
        'ut:question2' : this.utQuestions['ut:question2'],
    });
    calls = quiz.syncQuestions();
    test.deepEqual(calls.map(function (a) { return a.url; }), [
    ]);
    test.deepEqual(Object.keys(ls.obj).sort(), [
        '_index',
        'ut:question0',
        'ut:question1',
        'ut:question2',
        'ut:tutorial0',
    ]);

    // Remove a question from the lecture, syncQuestions should tidy up.
    quiz.insertTutorial('ut:tutorial0', 'UT tutorial', [
        {
            "answerQueue": [],
            "questions": [
                {"uri": "ut:question0", "chosen": 20, "correct": 100},
                {"uri": "ut:question1", "chosen": 40, "correct": 100},
                {"uri": "ut:question4", "chosen": 40, "correct": 100},
            ],
            "removed_questions": ['ut:question2'],
            "settings": { "hist_sel": 0 },
            "uri":"ut:lecture0",
            "question_uri":"ut:lecture0:all-questions",
        },
    ]);
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });
    calls = quiz.syncQuestions();
    test.deepEqual(calls.map(function (a) { return a.url; }), [
        'ut:question4',
    ]);
    test.deepEqual(Object.keys(ls.obj).sort(), [
        '_index',
        'ut:question0',
        'ut:question1',
        'ut:tutorial0',
    ]);

    // Add online lecture, should be ignored
    quiz.insertTutorial('ut:tutorial0', 'UT tutorial', [
        {
            "answerQueue": [],
            "questions": [
                {"uri": "ut:question0", "chosen": 20, "correct": 100},
                {"uri": "ut:question1", "chosen": 40, "correct": 100},
                {"uri": "ut:question6", "chosen": 40, "correct": 100},
                {"uri": "ut:online0", "online_only": true, "chosen": 40, "correct": 100},
            ],
            "removed_questions": ['ut:question2'],
            "settings": { "hist_sel": 0 },
            "uri":"ut:lecture0",
            "question_uri":"ut:lecture0:all-questions",
        },
    ]);
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });
    calls = quiz.syncQuestions();
    test.deepEqual(calls.map(function (a) { return a.url; }), [
        'ut:question6'
    ]);

    test.done();
};

/** Should suggest questions to fetch for both lectures */
module.exports.test_syncTutorialQuestions = function (test) {
    var ls = new MockLocalStorage();
    var aa = new MockAjaxApi();
    var quiz = new Quiz(ls, aa);
    var calls;

    // Load tutorial, some questions
    quiz.insertTutorial('ut:tutorial0', 'UT tutorial', [
        {
            "answerQueue": [],
            "questions": [
                {"uri": "ut:question0", "chosen": 20, "correct": 100},
                {"uri": "ut:question1", "chosen": 40, "correct": 100},
                {"uri": "ut:question2", "chosen": 40, "correct": 100},
            ],
            "settings": { "hist_sel": 0 },
            "uri":"ut:lecture0",
            "question_uri":"ut:lecture0:all-questions",
        },
        {
            "answerQueue": [],
            "questions": [
                {"uri": "ut:question3", "chosen": 20, "correct": 100},
                {"uri": "ut:question4", "chosen": 40, "correct": 100},
                {"uri": "ut:question5", "chosen": 40, "correct": 100},
                {"uri": "ut:question6", "chosen": 20, "correct": 100},
                {"uri": "ut:question7", "chosen": 40, "correct": 100},
                {"uri": "ut:question8", "chosen": 40, "correct": 100},
            ],
            "settings": { "hist_sel": 0 },
            "uri":"ut:lecture1",
            "question_uri":"ut:lecture1:all-questions",
        },
    ]);

    quiz.insertQuestions({
        'ut:question0' : this.utQuestions['ut:question0'],
        'ut:question1' : this.utQuestions['ut:question1'],
    });

    Promise.resolve().then(function (args) {
        test.deepEqual(aa.getQueue(), []);

    // Sync questions, should get 1 for first lecture, all for second
    }).then(function (args) {
        return quiz.syncTutorialQuestions('ut:tutorial0');
    }).then(function (args) {
        test.deepEqual(aa.getQueue(), [
            'GET ut:question20',
            'GET ut:lecture1:all-questions1',
        ]);
        aa.setResponse('GET ut:question20', {});
        aa.setResponse('GET ut:lecture1:all-questions1', {});

    }).then(function (args) {
        test.done();
    }).catch(function (err) {
        console.log(err.stack);
        test.fail(err);
        test.done();
    });
};

/** syncLecture should maintain any unsynced answerQueue entries */
module.exports.test_syncLecture = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls);
    var call, assignedQns = [];

    // Insert tutorial, no answers yet.
    quiz.insertTutorial('ut:tutorial0', 'UT tutorial', [
        {
            "answerQueue": [],
            "questions": [
                {"uri": "ut:question0", "chosen": 20, "correct": 100},
                {"uri": "ut:question1", "chosen": 40, "correct": 100},
                {"uri": "ut:question2", "chosen": 40, "correct": 100},
            ],
            "settings": { "hist_sel": 0 },
            "uri":"ut:lecture0",
            "question_uri":"ut:lecture0:all-questions",
        },
    ]);
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });
    quiz.insertQuestions(this.utQuestions);

    // Should be nothing to do
    test.deepEqual(quiz.syncLecture(false), null);

    // Can force something to happen though
    call = quiz.syncLecture(true);
    test.deepEqual(call.url, "ut:lecture0");
    test.deepEqual(JSON.parse(call.data).answerQueue, []);

    // Answer some questions
    Promise.resolve().then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, 0));
    }).then(function (args) {
        test.ok(args.answerData.explanation.indexOf('The symbol for the set') !== -1) // Make sure answerData gets through
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, 0));
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, 0));
    }).then(function (args) {

        // Now should want to sync
        call = quiz.syncLecture(false);
        test.deepEqual(call.url, "ut:lecture0");
        test.deepEqual(JSON.parse(call.data).answerQueue.map(function (a) { return a.synced; }), [
            false, false, false
        ]);

    // Answer another question before we do.
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, 0));

    // Finish the AJAX call
    }).then(function (args) {
        call.success({
            "answerQueue": [ {"camel" : 3, "lec_answered": 8, "lec_correct": 3, "synced" : true} ],
            "questions": [
                {"uri": "ut:question0", "chosen": 20, "correct": 100},
                {"uri": "ut:question2", "chosen": 40, "correct": 100},
                {"uri": "ut:question8", "chosen": 40, "correct": 100},
            ],
            "removed_questions": ['ut:question1'],
            "settings": { "hist_sel": 1 },
            "uri":"ut:lecture0",
            "question_uri":"ut:lecture0:all-questions",
        });

    // Lecture should have been updated, with additional question kept
    }).then(function (args) {
        var lec = quiz.getCurrentLecture();
        test.equal(lec.answerQueue.length, 2);
        test.deepEqual(lec.answerQueue[0], {"camel" : 3, "lec_answered": 8, "lec_correct": 3, "synced" : true});
        test.equal(lec.answerQueue[1].uri, assignedQns[3].uri);
        // Counts have been bumped up accordingly
        test.equal(lec.answerQueue[1].lec_answered, 9);
        test.equal(lec.answerQueue[1].lec_correct, assignedQns[3].correct ? 4 : 3);
        // Practice counts initialised
        test.equal(lec.answerQueue[1].practice_answered, 0);
        test.equal(lec.answerQueue[1].practice_correct, 0);
        test.deepEqual(lec.answerQueue[1].synced, false);
        test.deepEqual(lec.settings, { "hist_sel": 1 });

    // Add extra question, so we don't fall over later
    }).then(function (args) {
        quiz.insertQuestions({"ut:question8" : {
                "text": '<div>The symbol for the set of all irrational numbers is... (a)</div>',
                "choices": [
                    '<div>$\\mathbb{R} \\backslash \\mathbb{Q}$ (me)</div>',
                    '<div>$\\mathbb{Q} \\backslash \\mathbb{R}$</div>',
                    '<div>$\\mathbb{N} \\cap \\mathbb{Q}$</div>' ],
                "shuffle": [0, 1, 2],
                "answer": {
                    "explanation": "<div>\nThe symbol for the set of all irrational numbers (a)\n</div>",
                    "correct": [0]
                }
        }});
    // An unanswered question shouldn't get sync'ed
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, 0));
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);

        call = quiz.syncLecture(false);
        call.success({
            "answerQueue": [ {"camel" : 3, "synced" : true} ],
            "questions": [
                {"uri": "ut:question0", "chosen": 20, "correct": 100},
                {"uri": "ut:question2", "chosen": 40, "correct": 100},
                {"uri": "ut:question8", "chosen": 40, "correct": 100},
            ],
            "removed_questions": ['ut:question1'],
            "settings": { "hist_sel": 1 },
            "uri":"ut:lecture0",
            "question_uri":"ut:lecture0:all-questions",
        });
        var lec = quiz.getCurrentLecture();
        test.equal(lec.answerQueue.length, 2);
        test.deepEqual(lec.answerQueue[0], {"camel" : 3, "synced" : true});
        test.equal(assignedQns.length, 6);
        test.equal(lec.answerQueue[1].uri, assignedQns[assignedQns.length - 1].uri);

    // Answer question, ask a practice question. Answer practice question mid-sync
    }).then(function (args) {
        return(setAns(quiz, 0));
    }).then(function (args) {
        return(getQn(quiz, true));
    }).then(function (args) {
        assignedQns.push(args.a);
        call = quiz.syncLecture(false);
        return(setAns(quiz, 0));
    }).then(function (args) {
        var lec;

        call.success({
            "answerQueue": [ {"camel" : 3, "lec_answered": 8, "lec_correct": 3, "synced" : true} ],
            "questions": [
                {"uri": "ut:question0", "chosen": 20, "correct": 100},
                {"uri": "ut:question2", "chosen": 40, "correct": 100},
                {"uri": "ut:question8", "chosen": 40, "correct": 100},
            ],
            "removed_questions": ['ut:question1'],
            "settings": { "hist_sel": 1 },
            "uri":"ut:lecture0",
            "question_uri":"ut:lecture0:all-questions",
        });
        lec = quiz.getCurrentLecture();
        test.equal(lec.answerQueue.length, 2);
        test.equal(assignedQns.length, 7);
        test.equal(lec.answerQueue[1].lec_answered, 9);
        test.equal(lec.answerQueue[1].lec_correct, assignedQns[6].correct ? 4 : 3);
        test.equal(lec.answerQueue[1].practice_answered, 1);
        test.equal(lec.answerQueue[1].practice_correct, assignedQns[6].correct ? 1 : 0);

    }).then(function (args) {
        test.done();
    }).catch(function (err) {
        console.log(err.stack);
        test.fail(err);
        test.done();
    });
};

/** syncTutorial should sync all lectures */
module.exports.test_syncTutorial = function (test) {
    var ls = new MockLocalStorage();
    var call, assignedQns = [];
    var aa = new MockAjaxApi();
    var quiz = new Quiz(ls, aa);

    // Insert tutorial, no answers yet.
    quiz.insertTutorial('ut:tutorial0', 'UT tutorial', [
        {
            "answerQueue": [],
            "questions": [
                {"uri": "ut:question0", "chosen": 20, "correct": 100},
                {"uri": "ut:question1", "chosen": 40, "correct": 100},
                {"uri": "ut:question2", "chosen": 40, "correct": 100},
            ],
            "settings": { "hist_sel": 0 },
            "uri":"ut:lecture0",
            "question_uri":"ut:lecture0:all-questions",
        },
        {
            "answerQueue": [],
            "questions": [
                {"uri": "ut:question0", "chosen": 20, "correct": 100},
                {"uri": "ut:question1", "chosen": 40, "correct": 100},
                {"uri": "ut:question2", "chosen": 40, "correct": 100},
            ],
            "settings": { "hist_sel": 0 },
            "uri":"ut:lecture1",
            "question_uri":"ut:lecture1:all-questions",
        },
    ]);
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });
    quiz.insertQuestions(this.utQuestions);

    var syncPromise = null;
    Promise.resolve().then(function (args) {
        test.deepEqual(aa.getQueue(), []);

    // Start sync, wait for end
    }).then(function (args) {
        syncPromise = quiz.syncTutorial('ut:tutorial0', false);
        return syncPromise;

    // End came already, nothing to do
    }).then(function (args) {
        test.deepEqual(aa.getQueue(), []);

    // Answer some questions in lecture 0
    }).then(function (args) {
        quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, 0));

    // Now should want to sync
    }).then(function (args) {
        syncPromise = quiz.syncTutorial('ut:tutorial0', false);
        test.deepEqual(aa.getQueue(), ['POST ut:tutorial0 0']);

    // Answer another question before syncing
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, 0));

    // Respond with a new tutorial, and wait for it to finish
    }).then(function (args) {
        aa.setResponse('POST ut:tutorial0 0', {title: 'UT tutorial', uri: 'ut:tutorial0', lectures: [
            {
                "answerQueue": [ ],
                "questions": [
                    {"uri": "ut:question0", "chosen": 20, "correct": 100},
                ],
                "removed_questions": [],
                "settings": { "hist_sel": 0.2 },
                "uri":"ut:lectura0",
                "question_uri":"ut:lectura0:all-questions",
            },
            {
                "answerQueue": [ {"camel" : 3, "lec_answered": 8, "lec_correct": 3, "synced" : true} ],
                "questions": [
                    {"uri": "ut:question0", "chosen": 20, "correct": 100},
                    {"uri": "ut:question1", "chosen": 40, "correct": 100},
                    {"uri": "ut:question2", "chosen": 40, "correct": 100},
                    {"uri": "ut:question8", "chosen": 40, "correct": 100},
                ],
                "removed_questions": [],
                "settings": { "hist_sel": 1 },
                "uri":"ut:lecture0",
                "question_uri":"ut:lecture0:all-questions",
            },
            {
                "answerQueue": [],
                "questions": [
                    {"uri": "ut:question0", "chosen": 20, "correct": 100},
                    {"uri": "ut:question1", "chosen": 40, "correct": 100},
                    {"uri": "ut:question2", "chosen": 40, "correct": 100},
                ],
                "removed_questions": [],
                "settings": { "hist_sel": 0.5 },
                "uri":"ut:lecture1",
                "question_uri":"ut:lecture1:all-questions",
            },
        ]});
        return syncPromise;

    // lectura0 got inserted
    }).then(function (args) {
        quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lectura0'}, function () { });
        var lec = quiz.getCurrentLecture();
        test.deepEqual(lec.questions, [
            {"uri": "ut:question0", "chosen": 20, "correct": 100},
        ]);

    // lecture0 got updated, with additional question kept
    }).then(function (args) {
        quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });
        var lec = quiz.getCurrentLecture();
        test.deepEqual(lec.questions, [
            {"uri": "ut:question0", "chosen": 20, "correct": 100},
            {"uri": "ut:question1", "chosen": 40, "correct": 100},
            {"uri": "ut:question2", "chosen": 40, "correct": 100},
            {"uri": "ut:question8", "chosen": 40, "correct": 100},
        ]);
        test.equal(lec.answerQueue.length, 2);
        test.deepEqual(lec.answerQueue[0], {"camel" : 3, "lec_answered": 8, "lec_correct": 3, "synced" : true});

    // lecture1 got updated
    }).then(function (args) {
        quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture1'}, function () { });
        var lec = quiz.getCurrentLecture();
        test.deepEqual(lec.questions, [
            {"uri": "ut:question0", "chosen": 20, "correct": 100},
            {"uri": "ut:question1", "chosen": 40, "correct": 100},
            {"uri": "ut:question2", "chosen": 40, "correct": 100},
        ]);
        test.deepEqual(lec.settings, { "hist_sel": 0.5 });

    // Stop it and tidy up
    }).then(function (args) {
        test.done();
    }).catch(function (err) {
        console.log(err.stack);
        test.fail(err);
        test.done();
    });
};

/** syncAllTutorials should sync all tutorials */
module.exports.test_syncAllTutorials = function (test) {
    var ls = new MockLocalStorage();
    var call, assignedQns = [];
    var aa = new MockAjaxApi();
    var quiz = new Quiz(ls, aa);

    // If there's no data, there's nothing to do
    test.deepEqual(quiz.syncAllTutorials(false), []);
    test.deepEqual(quiz.syncAllTutorials(true), []);

    // Insert 2 tutorials
    quiz.insertTutorial('ut:tutorial0', 'UT tutorial', [
        {
            "answerQueue": [],
            "questions": [
                {"uri": "ut:question0", "chosen": 20, "correct": 100},
                {"uri": "ut:question1", "chosen": 40, "correct": 100},
                {"uri": "ut:question2", "chosen": 40, "correct": 100},
            ],
            "settings": { "hist_sel": 0 },
            "uri":"ut:t0lecture0",
            "question_uri":"ut:t0lecture0:all-questions",
        },
    ]);
    quiz.insertTutorial('ut:tutorial1', 'UT tutorial', [
        {
            "answerQueue": [],
            "questions": [
                {"uri": "ut:question0", "chosen": 20, "correct": 100},
                {"uri": "ut:question1", "chosen": 40, "correct": 100},
                {"uri": "ut:question2", "chosen": 40, "correct": 100},
            ],
            "settings": { "hist_sel": 0 },
            "uri":"ut:t1lecture0",
            "question_uri":"ut:t1lecture0:all-questions",
        },
    ]);
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:t0lecture0'}, function () { });
    quiz.insertQuestions(this.utQuestions);

    var syncPromises = null;
    Promise.resolve().then(function (args) {
        test.deepEqual(aa.getQueue(), []);

    // Start sync without forcing
    }).then(function (args) {
        syncPromises = quiz.syncAllTutorials(false);

    // End came already, nothing to do
    }).then(function (args) {
        test.deepEqual(aa.getQueue(), []);

    // Force the sync
    }).then(function (args) {
        syncPromises = quiz.syncAllTutorials(true);
        test.deepEqual(aa.getQueue(), [
            'POST ut:tutorial0 0',
            'POST ut:tutorial1 1'
        ]);

    // Respond with a new tutorial, and wait for it to finish
    }).then(function (args) {
        aa.setResponse('POST ut:tutorial0 0', {title: 'UT tutorial new 0', uri: 'ut:tutorial0', lectures: [
            {
                "answerQueue": [],
                "questions": [
                    {"uri": "ut:question0", "chosen": 20, "correct": 100},
                    {"uri": "ut:question1", "chosen": 40, "correct": 100},
                    {"uri": "ut:question2", "chosen": 40, "correct": 100},
                ],
                "settings": { "hist_sel": 0 },
                "uri":"ut:t0lecture0",
                "question_uri":"ut:t0lecture0:all-questions",
            },
        ]});
        aa.setResponse('POST ut:tutorial1 1', {title: 'UT tutorial new 1', uri: 'ut:tutorial1', lectures: [
            {
                "answerQueue": [],
                "questions": [
                    {"uri": "ut:question0", "chosen": 20, "correct": 100},
                    {"uri": "ut:question1", "chosen": 40, "correct": 100},
                    {"uri": "ut:question2", "chosen": 40, "correct": 100},
                ],
                "settings": { "hist_sel": 0 },
                "uri":"ut:t1lecture0",
                "question_uri":"ut:t1lecture0:all-questions",
            },
        ]});
        return Promise.all(syncPromises);

    // tutorial0 got a new title
    }).then(function (args) {
        quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:t0lecture0'}, function () {
            test.deepEqual(arguments[3], 'UT tutorial new 0');
        });

    // tutorial1 got a new title
    }).then(function (args) {
        quiz.setCurrentLecture({'tutUri': 'ut:tutorial1', 'lecUri': 'ut:t1lecture0'}, function () {
            test.deepEqual(arguments[3], 'UT tutorial new 1');
        });

    // Stop it and tidy up
    }).then(function (args) {
        test.done();
    }).catch(function (err) {
        console.log(err.stack);
        test.fail(err);
        test.done();
    });
};

module.exports.test_setQuestionAnswer = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls);
    var i, assignedQns = [];
    var startTime = Math.round((new Date()).getTime() / 1000) - 1;

    this.defaultLecture(quiz);

    Promise.resolve().then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, []));

    // Fail to answer question, should get a null for the student answer
    }).then(function (args) {
        var lec = quiz.getCurrentLecture();
        test.equal(lec.answerQueue.length, 1);
        test.ok(lec.answerQueue[0].answer_time > startTime);
        test.equal(typeof lec.answerQueue[0].student_answer, "object");
        test.equal(lec.answerQueue[0].student_answer, null);
        test.equal(typeof lec.answerQueue[0].selected_answer, "object");
        test.equal(lec.answerQueue[0].selected_answer, null);

    // Add a tutorial with a template question
    }).then(function (args) {
        test.equal(quiz.insertTutorial('ut:tmpltutorial', 'UT template qn tutorial', [
            {
                "answerQueue": [],
                "questions": [
                    {"uri": "ut:tmplqn0", "online_only": false},  // NB: Would normally be true
                ],
                "settings": { "hist_sel": 0 },
                "uri":"ut:lecture0",
                "question_uri":"ut:lecture0:all-questions",
            },
        ]), true);
        quiz.insertQuestions({
            "ut:tmplqn0": {
                "_type": "template",
                "title": "Write a question about fish",
                "hints": "<div class=\"ttm-output\">You could ask something about their external appearance</div>",
                "example_text": "How many toes?",
                "example_explanation": "why would they have toes?'",
                "example_choices": ["4", "5"],
            },
        });
        quiz.setCurrentLecture({'tutUri': 'ut:tmpltutorial', 'lecUri': 'ut:lecture0'}, function () { });

    // When dealing with template questions, should decode form data
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        test.equal(args.a.question_type, "template");
        return(setAns(quiz, [
            { name: "text", value: "How many toes?"},
            { name: "choice_0", value: "1"},
            { name: "choice_1", value: "4"},
            { name: "choice_2", value: "A zillion"},
            { name: "choice_2_correct", value: "on"},
            { name: "explanation", value: "Lots of toes!"},
        ]));
    }).then(function (args) {
        test.deepEqual(args.answerData, {}) // No answerdata for template questions
        test.equal(args.a.correct, true);
        test.deepEqual(args.a.student_answer, {
            choices: [
                { answer: '1', correct: false },
                { answer: '4', correct: false },
                { answer: 'A zillion', correct: true }
            ],
            text: 'How many toes?',
            explanation: 'Lots of toes!'
        });

    // When dealing with template questions, should decode form data
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        test.equal(args.a.question_type, "template");
        return(setAns(quiz, [
            { name: "text", value: "How many $toes$?"},
            { name: "choice_2", value: "A zillion"},
            { name: "choice_0", value: "1"},
            { name: "choice_0_correct", value: "yay"},
            { name: "choice_1", value: "4"},
            { name: "choice_1_correct", value: "true"},
            { name: "explanation", value: "Lots of toes!"},
        ]));
    }).then(function (args) {
        test.equal(args.a.correct, true);
        test.deepEqual(args.a.student_answer, {
            choices: [
                { answer: '1', correct: true },
                { answer: '4', correct: true },
                { answer: 'A zillion', correct: false }
            ],
            text: 'How many $toes$?',
            explanation: 'Lots of toes!'
        });

    // No answer should still result in null
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        test.equal(args.a.question_type, "template");
        return(setAns(quiz, []));
    }).then(function (args) {
        test.deepEqual(args.answerData, {})
        test.equal(args.a.correct, false);
        test.deepEqual(args.a.student_answer, null);

    // Reworking a question should result in null too
    }).then(function (args) {
        quiz.insertQuestions({
            "ut:tmplqn0": {
                "_type": "template",
                "title": "Write a question about fish",
                "hints": "<div class=\"ttm-output\">You could ask something about their external appearance</div>",
                "example_text": "How about a simple sum?",
                "example_explanation": "why would they have toes?'",
                "example_choices": ["4", "5"],
                "student_answer": {text: "<div>What's 1+1?</div>", choices: []},
            }
        });
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        test.equal(args.a.question_type, "template");
        return(setAns(quiz, []));
    }).then(function (args) {
        test.equal(args.a.correct, null);
        test.deepEqual(args.a.student_answer, null);
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        test.equal(args.a.question_type, "template");
        return(setAns(quiz, [
            { name: "text", value: "How many toes?"},
            { name: "choice_0", value: "1"},
            { name: "choice_1", value: "4"},
            { name: "choice_2", value: "A zillion"},
            { name: "choice_2_correct", value: "on"},
            { name: "explanation", value: "Lots of toes!"},
        ]));
    }).then(function (args) {
        test.equal(args.a.correct, null);
        test.deepEqual(args.a.student_answer.text, "How many toes?");

    // Add a tutorial with a usergenerated question
    }).then(function (args) {
        test.equal(quiz.insertTutorial('ut:ugtutorial', 'UT template qn tutorial', [
            {
                "answerQueue": [],
                "questions": [
                    {"uri": "ut:ugqn0", "online_only": false},  // NB: Would normally be true
                ],
                "settings": { "hist_sel": 0 },
                "uri":"ut:lecture0",
                "question_uri":"ut:lecture0:all-questions",
            },
        ]), true);
        quiz.insertQuestions({
            "ut:ugqn0": {
                "_type": "usergenerated",
                "question_id": 999,
                "text": "Riddle me this.",
                "choices": ["Yes", "No"],
                "shuffle": [0, 1],
                "answer": {
                    "correct": [0],
                    "explanation": "It'd be boring otherwise"
                }
            },
        });
        quiz.setCurrentLecture({'tutUri': 'ut:ugtutorial', 'lecUri': 'ut:lecture0'}, function () { });

    // Fetch a usergenerated question and answer it, should be marked but not "answered"
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        return(setAns(quiz, [
            { name: "answer", value: args.a.ordering.indexOf(0).toString() }
        ]));
    }).then(function (args) {
        test.equal(args.answerData.explanation, "It'd be boring otherwise")
        test.ok(!args.a.hasOwnProperty("correct"));
        test.ok(!args.a.hasOwnProperty("answer_time"));
        test.deepEqual(args.a.student_answer, { choice: 0 });

        // Could have only ordered the questions 2 ways
        if (args.a.ordering[0] === 0) {
            test.deepEqual(args.a.ordering, [0, 1]);
            test.deepEqual(args.a.ordering_correct, [true, false]);
        } else {
            test.deepEqual(args.a.ordering, [1, 0]);
            test.deepEqual(args.a.ordering_correct, [false, true]);
        }
        return(args);

    // Try again with a comment, even empty should be properly answered
    }).then(function (args) {
        return(setAns(quiz, [
            { name: "answer", value: args.a.ordering.indexOf(0).toString() },
            { name: "comments", value: "" },
        ]));
    }).then(function (args) {
        test.ok(!args.a.hasOwnProperty("correct")); // NB: Never have correct
        test.ok(args.a.hasOwnProperty("answer_time"));
        test.deepEqual(args.a.student_answer, { choice: 0, comments: "" });

    // Start again, fill in everything
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        return(setAns(quiz, [
            { name: "answer", value: args.a.ordering.indexOf(1).toString() },
            { name: "comments", value: "Boo!" },
            { name: "rating", value: "50" },
        ]));
    }).then(function (args) {
        test.ok(!args.a.hasOwnProperty("correct")); // NB: Never have correct
        test.ok(args.a.hasOwnProperty("answer_time"));
        test.deepEqual(args.a.student_answer, { choice: 1, comments: "Boo!", rating: 50 });

    }).then(function (args) {
        test.done();
    }).catch(function (err) {
        console.log(err.stack);
        test.fail(err);
        test.done();
    });
};

/** insertTutorial should preserve the answerQueue */
module.exports.test_insertTutorial = function (test) {
    var ls = new MockLocalStorage();
    var aa = new MockAjaxApi();
    var quiz = new Quiz(ls, aa);
    var lec, assignedQns = [];

    // Insert first version of tutorial, just dumped in verbatim
    test.equal(quiz.insertTutorial('ut:tutorial0', 'UT tutorial', [
        {
            "answerQueue": [],
            "questions": [
                {"uri": "ut:question0", "chosen": 20, "correct": 100},
                {"uri": "ut:question1", "chosen": 40, "correct": 100},
                {"uri": "ut:question2", "chosen": 40, "correct": 100},
            ],
            "settings": { "hist_sel": 0 },
            "uri":"ut:lecture0",
            "question_uri":"ut:lecture0:all-questions",
        },
    ]), true);
    quiz.insertQuestions(this.utQuestions);
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });

    Promise.resolve().then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, 0));
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        // NB: Not answered
    }).then(function (args) {
        // Insert tutorial before, update existing
        test.equal(quiz.insertTutorial('ut:tutorial0', 'UTee tutorial', [
            {
                "answerQueue": [],
                "questions": [
                    {"uri": "ut:question2", "chosen": 40, "correct": 100},
                    {"uri": "ut:question4", "chosen": 40, "correct": 100},
                    {"uri": "ut:question5", "chosen": 40, "correct": 100},
                ],
                "settings": { "hist_sel": 0.1 },
                "uri":"ut:lecture8",
                "question_uri":"ut:lecture8:all-questions",
            },
            {
                "answerQueue": [{"camel" : 8, "synced" : true}],
                "questions": [
                    {"uri": "ut:question1", "chosen": 40, "correct": 100},
                    {"uri": "ut:question2", "chosen": 40, "correct": 100},
                    {"uri": "ut:question6", "chosen": 40, "correct": 100},
                ],
                "settings": { "hist_sel": 0.4 },
                "uri":"ut:lecture0",
                "question_uri":"ut:lecture0:all-questions",
            },
        ]), true);

        // Lecture 8 should be available
        quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture8'}, function () { });
        lec = quiz.getCurrentLecture();
        test.deepEqual(lec.uri, "ut:lecture8");
        test.deepEqual(lec.settings, { "hist_sel": 0.1 });
        test.deepEqual(lec.answerQueue, []);
    
        // Lecture 0 should have additions, a combined answerQueue.
        quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });
        lec = quiz.getCurrentLecture();
        test.deepEqual(lec.uri, "ut:lecture0");
        test.deepEqual(lec.questions.map(function (a) { return a.uri; }), ['ut:question1', 'ut:question2', 'ut:question6']);
        test.equal(lec.answerQueue.length, 2);
        test.deepEqual(lec.answerQueue[0], {"camel" : 8, "synced" : true});
        test.equal(lec.answerQueue[1].uri, assignedQns[1].uri);

    }).then(function (args) {
        test.done();
    }).catch(function (err) {
        console.log(err.stack);
        test.fail(err);
        test.done();
    });
};

/** lastEight should return last relevant questions */
module.exports.test_lastEight = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls);
    var i, assignedQns = [];

    // Insert tutorial, no answers yet.
    quiz.insertTutorial('ut:tutorial0', 'UT tutorial', [
        {
            "answerQueue": [],
            "questions": [
                {"uri": "ut:question0", "chosen": 20, "correct": 100},
                {"uri": "ut:question1", "chosen": 40, "correct": 100},
                {"uri": "ut:question2", "chosen": 40, "correct": 100},
            ],
            "settings": { "hist_sel": 0 },
            "uri":"ut:lecture0",
            "question_uri":"ut:lecture0:all-questions",
        },
    ]);
    quiz.insertQuestions(this.utQuestions);
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });

    // lastEight returns nothing
    test.deepEqual(quiz.lastEight(), []);

    // Answer some questions
    Promise.resolve().then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, 0));
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, 0));
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, 0));
    }).then(function (args) {
        test.equal(quiz.lastEight().length, 3);
        test.equal(quiz.lastEight()[0].uri, assignedQns[2].uri);
        test.equal(quiz.lastEight()[1].uri, assignedQns[1].uri);
        test.equal(quiz.lastEight()[2].uri, assignedQns[0].uri);

    // Unanswered questions don't count
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        test.equal(quiz.lastEight().length, 3);
        return(setAns(quiz, 0));
    }).then(function (args) {
        test.equal(quiz.lastEight().length, 4);
        test.equal(quiz.lastEight()[3].uri, assignedQns[0].uri);

    // Practice questions don't count
    }).then(function (args) {
        return(getQn(quiz, true));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, 0));
    }).then(function (args) {
        return(getQn(quiz, true));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, 0));
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a);
        return(setAns(quiz, 0));
    }).then(function (args) {
        test.equal(quiz.lastEight().length, 5);
        test.equal(quiz.lastEight()[0].uri, assignedQns[6].uri);
        test.equal(quiz.lastEight()[1].uri, assignedQns[3].uri);
        test.equal(quiz.lastEight()[2].uri, assignedQns[2].uri);
        test.equal(quiz.lastEight()[3].uri, assignedQns[1].uri);
        test.equal(quiz.lastEight()[4].uri, assignedQns[0].uri);

    // Old questions don't count
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a); return(setAns(quiz, 0));
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a); return(setAns(quiz, 0));
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a); return(setAns(quiz, 0));
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a); return(setAns(quiz, 0));
    }).then(function (args) {
        return(getQn(quiz, false));
    }).then(function (args) {
        assignedQns.push(args.a); return(setAns(quiz, 0));
    }).then(function (args) {
        test.equal(quiz.lastEight().length, 8);
        test.equal(quiz.lastEight()[0].uri, assignedQns[11].uri);
        test.equal(quiz.lastEight()[1].uri, assignedQns[10].uri);
        test.equal(quiz.lastEight()[2].uri, assignedQns[9].uri);
        test.equal(quiz.lastEight()[3].uri, assignedQns[8].uri);
        test.equal(quiz.lastEight()[4].uri, assignedQns[7].uri);
        test.equal(quiz.lastEight()[5].uri, assignedQns[6].uri);
        test.equal(quiz.lastEight()[6].uri, assignedQns[3].uri);
        test.equal(quiz.lastEight()[7].uri, assignedQns[2].uri);
    }).then(function (args) {
        test.done();
    });
};

/** Should update question count upon answering questions */
module.exports.test_questionUpdate  = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls);
    var i, assignedQns = [], qnBefore;

    // Turn questions into a hash for easy finding
    function qnHash() {
        var out = {};
        quiz.getCurrentLecture().questions.map(function (qn) {
            out[qn.uri] = {"chosen": qn.chosen, "correct": qn.correct};
        });
        return out;
    }

    // Insert tutorial, no answers yet.
    quiz.insertTutorial('ut:tutorial0', 'UT tutorial', [
        {
            "answerQueue": [],
            "questions": [
                {"uri": "ut:question0", "chosen": 20, "correct": 100},
                {"uri": "ut:question1", "chosen": 40, "correct": 100},
                {"uri": "ut:question2", "chosen": 40, "correct": 100},
            ],
            "settings": { "hist_sel": 0 },
            "uri":"ut:lecture0",
            "question_uri":"ut:lecture0:all-questions",
        },
    ]);
    quiz.insertQuestions(this.utQuestions);
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });
    qnBefore = qnHash();

    // Assign a question, should see jump in counts
    quiz.getNewQuestion({practice: true}, function(qn, a) {
        assignedQns.push(a);
        quiz.setQuestionAnswer([{name: "answer", value: 0}], function () {
            test.equal(
                qnBefore[assignedQns[0].uri].chosen + 1,
                qnHash()[assignedQns[0].uri].chosen
            );
            test.ok(
                (qnBefore[assignedQns[0].uri].correct == qnHash()[assignedQns[0].uri].correct) ||
                (qnBefore[assignedQns[0].uri].correct + 1 == qnHash()[assignedQns[0].uri].correct)
            );
        });
    });

    test.done();
};

module.exports.test_getNewQuestion = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls);
    var i, assignedQns = [];
    var startTime = Math.round((new Date()).getTime() / 1000) - 1;

    this.defaultLecture(quiz);

    quiz.getNewQuestion({practice: false}, function(qn, a) {
        var fixedOrdering = Array.apply(null, {length: qn.choices.length}).map(Number.call, Number);
        assignedQns.push(a);
        // Question data has been set up
        test.equal(a.synced, false);
        if (qn.shuffle.length < qn.choices.length) {
             // Not shuffling everything, so last item should always be last question.
             qn.shuffle[qn.shuffle.length - 1] = 2;
        }
        test.deepEqual(a.ordering.sort(), fixedOrdering);
        test.ok(a.quiz_time > startTime);
        test.equal(a.allotted_time, 582);
        test.equal(a.allotted_time, a.remaining_time);

        // Question data has URI inside
        test.equal(a.uri, qn.uri);

        // Counts have all started at 0
        test.equal(a.lec_answered, 0);
        test.equal(a.lec_correct, 0);
        test.equal(a.practice_answered, 0);
        test.equal(a.practice_answered, 0);

        // Pass some time, then request the same question again.
        tk.travel(new Date((new Date()).getTime() + 3000));
        test.notEqual(startTime, Math.round((new Date()).getTime() / 1000) - 1);
        test.equal(quiz.getCurrentLecture().answerQueue.length, 1);
        quiz.getNewQuestion({practice: false}, function(qn, a) {
            // No question answered, so just get the same one back.
            test.deepEqual(assignedQns[assignedQns.length - 1], a);
            test.equal(quiz.getCurrentLecture().answerQueue.length, 1);
            test.equal(a.allotted_time, a.remaining_time + 3); //3s have passed

            // Answer it, get new question
            quiz.setQuestionAnswer([{name: "answer", value: 0}], function () { quiz.getNewQuestion({practice: false}, function(qn, a) {
                test.equal(quiz.getCurrentLecture().answerQueue.length, 2);

                // Counts have gone up
                test.equal(a.lec_answered, 1);
                test.ok(a.lec_correct <= a.lec_answered);
                test.equal(a.practice_answered, 0);
                test.equal(a.practice_correct, 0);

                // Answer, get practice question
                quiz.setQuestionAnswer([{name: "answer", value: 0}], function () { quiz.getNewQuestion({practice: true}, function(qn, a) {
                    test.equal(quiz.getCurrentLecture().answerQueue.length, 3);

                    // Counts have gone up (but for question we answered)
                    test.equal(a.lec_answered, 2);
                    test.ok(a.lec_correct <= a.lec_answered);
                    test.equal(a.practice_answered, 0);
                    test.equal(a.practice_correct, 0);

                    // Answer it, practice counts go up
                    quiz.setQuestionAnswer([{name: "answer", value: 0}], function (a) {
                        test.equal(a.lec_answered, 3);
                        test.ok(a.lec_correct <= a.lec_answered);
                        test.equal(a.practice_answered, 1);
                        test.ok(a.practice_correct <= a.practice_answered);
                    });
                });});
            });});
        });
    });

    tk.reset();
    test.done();
};

module.exports.test_getNewQuestion_redirect = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls);

    this.defaultLecture(quiz);

    Promise.resolve().then(function (args) {

    // Create a question that references another question
    }).then(function (args) {
        quiz.insertQuestions({
            "ut:question0": { uri: "ut:question0a", text: "Question 0a", choices: [], shuffle: [0], answer: {}},
            "ut:question1": { uri: "ut:question1a", text: "Question 1a", choices: [], shuffle: [0], answer: {}},
            "ut:question2": { uri: "ut:question2a", text: "Question 2a", choices: [], shuffle: [0], answer: {}},
        });
        return(args);

    // Fetch question
    }).then(function (args) {
        return(getQn(quiz, false));

    // Should get back one of the question(x)a URIs
    }).then(function (args) {
        test.equal(args.qn.uri, args.a.uri);
        test.equal(args.qn.uri.slice(-1), "a");

    }).then(function (args) {
        test.done();
    }).catch(function (err) {
        console.log(err.stack);
        test.fail(err);
        test.done();
    });
};

module.exports.test_getQuestionData = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls);

    // Set up localstorage with some data
    Promise.resolve().then(function (args) {
        ls.setItem("http://camel.com/", '{"s":"camel"}');
        ls.setItem("http://sausage.com/", '{"s":"sausage"}');
    
    // Can fetch back data
    }).then(function (qn) {
        return quiz._getQuestionData("http://sausage.com/");
    }).then(function (qn) {
        test.deepEqual(qn, {s:"sausage", uri: "http://sausage.com/"});
    }).then(function (qn) {
        return quiz._getQuestionData("http://camel.com/");
    }).then(function (qn) {
        test.deepEqual(qn, {s:"camel", uri: "http://camel.com/"});

    // Can get the same data back thanks to the last question cache
    }).then(function (qn) {
        ls.setItem("http://camel.com/", '{"s":"dromedary"}');
        ls.setItem("http://sausage.com/", '{"s":"walls"}');
    }).then(function (qn) {
        return quiz._getQuestionData("http://camel.com/", true);
    }).then(function (qn) {
        test.deepEqual(qn, {s:"camel", uri: "http://camel.com/"});

    // But not once we ask for something else
    }).then(function (qn) {
        return quiz._getQuestionData("http://sausage.com/", true);
    }).then(function (qn) {
        test.deepEqual(qn, {s:"walls", uri: "http://sausage.com/"});
    }).then(function (qn) {
        return quiz._getQuestionData("http://camel.com/", true);
    }).then(function (qn) {
        test.deepEqual(qn, {s:"dromedary", uri: "http://camel.com/"});

    // Or if we don't use the cache
    }).then(function (qn) {
        ls.setItem("http://camel.com/", '{"s":"alice"}');
        ls.setItem("http://sausage.com/", '{"s":"cumberland"}');
    }).then(function (qn) {
        return quiz._getQuestionData("http://camel.com/", false);
    }).then(function (qn) {
        test.deepEqual(qn, {s:"alice", uri: "http://camel.com/"});

    // If question suggests a new path, then the cache uses that
    }).then(function (qn) {
        ls.setItem("http://sausage.com/", '{"uri":"http://frankfurter.com/","s":"wurst"}');
    }).then(function (qn) {
        return quiz._getQuestionData("http://sausage.com/", false);
    }).then(function (qn) {
        test.deepEqual(qn, {s:"wurst", uri: "http://frankfurter.com/"});
    }).then(function (qn) {
        return quiz._getQuestionData("http://frankfurter.com/", true);
    }).then(function (qn) {
        test.deepEqual(qn, {s:"wurst", uri: "http://frankfurter.com/"});

    }).then(function (args) {
        test.done();
    }).catch(function (err) {
        console.log(err.stack);
        test.fail(err);
        test.done();
    });
};

module.exports.test_setCurrentLecture = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls);
    var i, assignedQns = [];
    var startTime = Math.round((new Date()).getTime() / 1000) - 1;

    this.defaultLecture(quiz);
    quiz.insertTutorial('ut:tutorial0', 'UT tutorial 0', [
        {
            "answerQueue": [],
            "questions": [ {"uri": "ut:question0", "chosen": 20, "correct": 100} ], "settings": {},
            "uri":"ut:lecture0",
            "title":"UT Lecture 0 (no answers)",
        },
        {
            "answerQueue": [],
            "questions": [ {"uri": "ut:question0", "chosen": 20, "correct": 100} ], "settings": {},
            "uri":"ut:lecture1",
            "title":"UT Lecture 1 (no answers)",
        },
        {
            "answerQueue": [ { practice: true} ],
            "questions": [ {"uri": "ut:question0", "chosen": 20, "correct": 100} ], "settings": {},
            "uri":"ut:lecture-currentpract",
            "title":"UT Lecture: Currently practicing",
        },
        {
            "answerQueue": [ { practice: false} ],
            "questions": [ {"uri": "ut:question0", "chosen": 20, "correct": 100} ], "settings": {},
            "uri":"ut:lecture-currentreal",
            "title":"UT Lecture: Currently real",
        },
    ]);
    quiz.insertTutorial('ut:tutorial1', 'UT tutorial 1', [
        {
            "answerQueue": [],
            "questions": [ {"uri": "ut:question0", "chosen": 20, "correct": 100} ], "settings": {},
            "uri":"ut:lecture0",
            "title":"UT Lecture 0 (from tutorial 1)",
        },
    ]);

    // Continuing is false when no answers there
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture1'}, function (a, continuing, tutUri, tutTitle, lecUri, lecTitle) {
        test.equal(continuing, false); // No previous questions allocated
        test.equal(tutUri, 'ut:tutorial0');
        test.equal(tutTitle, 'UT tutorial 0');
        test.equal(lecUri, 'ut:lecture1');
        test.equal(lecTitle, 'UT Lecture 1 (no answers)');
    });

    // Can fetch from other tutorials
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial1', 'lecUri': 'ut:lecture0'}, function (a, continuing, tutUri, tutTitle, lecUri, lecTitle) {
        test.equal(continuing, false); // No previous questions allocated
        test.equal(tutUri, 'ut:tutorial1');
        test.equal(tutTitle, 'UT tutorial 1');
        test.equal(lecUri, 'ut:lecture0');
        test.equal(lecTitle, 'UT Lecture 0 (from tutorial 1)');
    });

    // Continuing shows when currently in a practice or real question
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture-currentreal'}, function (a, continuing, tutUri, tutTitle, lecUri, lecTitle) {
        test.equal(continuing, 'real');
        test.equal(tutUri, 'ut:tutorial0');
        test.equal(tutTitle, 'UT tutorial 0');
        test.equal(lecUri, 'ut:lecture-currentreal');
        test.equal(lecTitle, 'UT Lecture: Currently real');
    });
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture-currentpract'}, function (a, continuing, tutUri, tutTitle, lecUri, lecTitle) {
        test.equal(continuing, 'practice');
        test.equal(tutUri, 'ut:tutorial0');
        test.equal(tutTitle, 'UT tutorial 0');
        test.equal(lecUri, 'ut:lecture-currentpract');
        test.equal(lecTitle, 'UT Lecture: Currently practicing');
    });

    test.done();
};

module.exports.test_fetchSlides = function (test) {
    var ls = new MockLocalStorage();
    var aa = new MockAjaxApi();
    var quiz = new Quiz(ls, aa);
    var i, assignedQns = [];
    var startTime = Math.round((new Date()).getTime() / 1000) - 1;

    quiz.insertTutorial('ut:tutorial0', 'UT tutorial 0', [
        {
            "answerQueue": [],
            "questions": [ {"uri": "ut:question0", "chosen": 20, "correct": 100} ], "settings": {},
            "uri":"ut:lecture0",
            "slide_uri": "http://slide-url-for-lecture0",
            "title":"UT Lecture 0 (no answers)",
        },
        {
            "answerQueue": [],
            "questions": [ {"uri": "ut:question0", "chosen": 20, "correct": 100} ], "settings": {},
            "uri":"ut:lecture1",
            "title":"UT Lecture 1 (no answers)",
        }
    ]);

    Promise.resolve().then(function (args) {

    // Can get a URL for lecture0
    }).then(function (args) {
        quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { return; });
        var promise = quiz.fetchSlides();
        aa.setResponse('GET http://slide-url-for-lecture0 0', "<blink>hello</blink>");
        return promise;
    }).then(function (args) {
        // Returned our fake data
        test.deepEqual(args, "<blink>hello</blink>");

    // lecture1 doesn't have one
    }).then(function (args) {
        quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture1'}, function () {
            try {
                quiz.fetchSlides();
                test.fail();
            } catch(err) {
                test.equal(err, "tutorweb::error::No slides available!");
            }
        });

    // Stop it and tidy up
    }).then(function (args) {
        test.done();
    }).catch(function (err) {
        console.log(err.stack);
        test.fail(err);
        test.done();
    });
};

module.exports.test_fetchReview = function (test) {
    var ls = new MockLocalStorage();
    var aa = new MockAjaxApi();
    var quiz = new Quiz(ls, aa);
    var i, assignedQns = [];
    var startTime = Math.round((new Date()).getTime() / 1000) - 1;

    quiz.insertTutorial('ut:tutorial0', 'UT tutorial 0', [
        {
            "answerQueue": [],
            "questions": [ {"uri": "ut:question0", "chosen": 20, "correct": 100} ], "settings": {},
            "uri":"ut:lecture0",
            "slide_uri": "http://slide-url-for-lecture0",
            "title":"UT Lecture 0 (no review URI)",
        },
        {
            "answerQueue": [],
            "questions": [ {"uri": "ut:question0", "chosen": 20, "correct": 100} ], "settings": {},
            "uri":"ut:lecture1",
            "review_uri": "http://review-url-for-lecture1",
            "title":"UT Lecture 1 (with a review)",
        }
    ]);

    Promise.resolve().then(function (args) {

    // lecture0 doesn't have reviews
    }).then(function (args) {
        quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () {
            try {
                quiz.fetchReview();
                test.fail();
            } catch(err) {
                test.equal(err, "tutorweb::error::No review available!");
            }
        });

    // lecture1 has a URL that can be fetched
    }).then(function (args) {
        quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture1'}, function () {});
        var promise = quiz.fetchReview();
        aa.setResponse('GET http://review-url-for-lecture1 0', {camels: "yes"});
        return promise;
    }).then(function (args) {
        // Returned our fake data
        test.deepEqual(args, {camels: "yes"});

    // Stop it and tidy up
    }).then(function (args) {
        test.done();
    }).catch(function (err) {
        console.log(err.stack);
        test.fail(err);
        test.done();
    });
};

module.exports.test_updateAward = function (test) {
    var ls = new MockLocalStorage();
    var aa = new MockAjaxApi();
    var quiz = new Quiz(ls, aa);
    var i, assignedQns = [];
    var startTime = Math.round((new Date()).getTime() / 1000) - 1;

    quiz.insertTutorial('ut://tutorial0/camels/badgers/thing', 'UT tutorial 0', [
        {
            "answerQueue": [],
            "questions": [ {"uri": "ut:question0", "chosen": 20, "correct": 100} ], "settings": {},
            "uri":"ut:lecture0",
            "slide_uri": "http://slide-url-for-lecture0",
            "title":"UT Lecture 0 (no answers)",
        },
    ]);

    Promise.resolve().then(function (args) {

    // Fetch without wallet ID
    }).then(function (args) {
        var promise = quiz.updateAward('ut://tutorial0/', null);
        test.deepEqual(aa.getQueue(), [
            'POST ut://tutorial0/@@quizdb-student-award 0',
        ]);
        aa.setResponse('POST ut://tutorial0/@@quizdb-student-award 0', {"things": true});
        return promise;

    }).then(function (args) {
        // Returned our fake data
        test.deepEqual(args, {"things": true});
        return true;

    // Fetch with wallet ID
    }).then(function (args) {
        var promise = quiz.updateAward('ut://tutorial0/', "WaLlEt");
        test.deepEqual(aa.getQueue(), [
            'POST ut://tutorial0/@@quizdb-student-award 1',
        ]);
        test.deepEqual(
            aa.data['POST ut://tutorial0/@@quizdb-student-award 1'],
            {"walletId": 'WaLlEt'}
        );
        aa.setResponse('POST ut://tutorial0/@@quizdb-student-award 1', {"things": false});
        return promise;

    }).then(function (args) {
        // Returned our fake data
        test.deepEqual(args, {"things": false});
        return true;

    // Stop it and tidy up
    }).then(function (args) {
        test.done();
    }).catch(function (err) {
        console.log(err.stack);
        test.fail(err);
        test.done();
    });
};
