// Bodge in what we need from libraries.js
Object.keys||(Object.keys=function(a){if(a!==Object(a))throw new TypeError("Object.keys called on non-object");var c=[],b;for(b in a)Object.prototype.hasOwnProperty.call(a,b)&&c.push(b);return c});
Array.shuffle||(Array.shuffle=function(a){for(var c,d,b=a.length;b;c=parseInt(Math.random()*b),d=a[--b],a[b]=a[c],a[c]=d);return a});
Array.last=Array.last||function(a){return 0<a.length?a[a.length-1]:null};
Array.prototype.map||(Array.prototype.map=function(d,f){var g,e,a;if(null==this)throw new TypeError(" this is null or not defined");var b=Object(this),h=b.length>>>0;if("function"!==typeof d)throw new TypeError(d+" is not a function");f&&(g=f);e=Array(h);for(a=0;a<h;){var c;a in b&&(c=b[a],c=d.call(g,c,a,b),e[a]=c);a++}return e});
Array.prototype.indexOf||(Array.prototype.indexOf=function(d){if(null==this)throw new TypeError;var c=Object(this),b=c.length>>>0;if(0===b)return-1;var a=0;1<arguments.length&&(a=Number(arguments[1]),a!=a?a=0:0!=a&&(Infinity!=a&&-Infinity!=a)&&(a=(0<a||-1)*Math.floor(Math.abs(a))));if(a>=b)return-1;for(a=0<=a?a:Math.max(b-Math.abs(a),0);a<b;a++)if(a in c&&c[a]===d)return a;return-1});
Array.last=Array.last||function(a){return 0<a.length?a[a.length-1]:null};

var Quiz = require('../lib/quizlib.js');

function MockLocalStorage() {
    this.obj = {};
    this.length = 0;

    this.removeItem = function (key) {
        this.length--;
        return delete this.obj[key];
    };

    this.getItem = function (key) {
        return this.obj[key] || null;
    };

    this.setItem = function (key, value) {
        this.length++;
        return this.obj[key] = value;
    };

    this.key = function (i) {
        return Object.keys(this.obj)[i];
    };
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
        quiz.insertQuestions(this.utQuestions, function () { });
        quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });
    };

    callback();
};

/** Should only remove genuinely unused objects */
module.exports.test_removeUnusedObjects = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls, function (m) { test.ok(false, m); });

    // Load associated questions and a random extra
    ls.setItem('camel', 'yes');
    quiz.insertTutorial(
        'ut:tutorial0',
        this.utTutorial.title,
        this.utTutorial.lectures
    );
    quiz.insertQuestions(this.utQuestions, function () { });
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
    quiz.insertQuestions(this.utQuestions, function () { });

    // insertTutorial/Questions didn't tidy up by themselves
    test.deepEqual(Object.keys(ls.obj).sort(), [
        '_index',
        'camel',
        'ut:question0',
        'ut:question1',
        'ut:question2',
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
    var quiz = new Quiz(ls, function (m) { test.ok(false, m); });
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
    }, function () { });
    calls = quiz.syncQuestions();
    test.deepEqual(calls.map(function (a) { return a.url; }), [
        'ut:question1',
        'ut:question2',
    ]);

    // Still not quite there...
    quiz.insertQuestions({
        'ut:question0' : this.utQuestions['ut:question0'],
        'ut:question2' : this.utQuestions['ut:question2'],
    }, function () { });
    calls = quiz.syncQuestions();
    test.deepEqual(calls.map(function (a) { return a.url; }), [
        'ut:question1',
    ]);

    // We're complete
    quiz.insertQuestions({
        'ut:question0' : this.utQuestions['ut:question0'],
        'ut:question1' : this.utQuestions['ut:question1'],
        'ut:question2' : this.utQuestions['ut:question2'],
    }, function () { });
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

    test.done();
};

/** syncLecture should maintain any unsynced answerQueue entries */
module.exports.test_syncLecture = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls, function (m) { test.ok(false, m); });
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
    quiz.insertQuestions(this.utQuestions, function () { });

    // Should be nothing to do
    test.deepEqual(quiz.syncLecture(false), null);

    // Can force something to happen though
    call = quiz.syncLecture(true);
    test.deepEqual(call.url, "ut:lecture0");
    test.deepEqual(JSON.parse(call.data).answerQueue, []);

    // Answer some questions
    quiz.getNewQuestion(false, function(qn, a) {
        assignedQns.push(a);
        quiz.setQuestionAnswer(0, function () { });
    });
    quiz.getNewQuestion(false, function(qn, a) {
        assignedQns.push(a);
        quiz.setQuestionAnswer(0, function () { });
    });
    quiz.getNewQuestion(false, function(qn, a) {
        assignedQns.push(a);
        quiz.setQuestionAnswer(0, function () { });
    });

    // Now should want to sync
    call = quiz.syncLecture(false);
    test.deepEqual(call.url, "ut:lecture0");
    test.deepEqual(JSON.parse(call.data).answerQueue.map(function (a) { return a.synced; }), [
        false, false, false
    ]);

    // Answer another question before we do.
    quiz.getNewQuestion(false, function(qn, a) {
        assignedQns.push(a);
        quiz.setQuestionAnswer(0, function () { });
    });

    // Finish the AJAX call
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
    test.deepEqual(lec.removed_questions, ['ut:question1']);

    // Add extra question, so we don't fall over later
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
    }}, function () { });

    // An unanswered question shouldn't get sync'ed
    quiz.getNewQuestion(false, function(qn, a) {
        assignedQns.push(a);
        quiz.setQuestionAnswer(0, function () { });
    });
    quiz.getNewQuestion(false, function(qn, a) {
        assignedQns.push(a);
    });
    quiz.syncLecture(false);
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
    quiz.setQuestionAnswer(0, function () {
        quiz.getNewQuestion(true, function(qn, a) {
            assignedQns.push(a);
        });
    });
    call = quiz.syncLecture(false);
    quiz.setQuestionAnswer(0, function () { call.success({
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
    })});
    lec = quiz.getCurrentLecture();
    test.equal(lec.answerQueue.length, 2);
    test.equal(assignedQns.length, 7);
    test.equal(lec.answerQueue[1].lec_answered, 9);
    test.equal(lec.answerQueue[1].lec_correct, assignedQns[6].correct ? 4 : 3);
    test.equal(lec.answerQueue[1].practice_answered, 1);
    test.equal(lec.answerQueue[1].practice_correct, assignedQns[6].correct ? 1 : 0);

    test.done();
};

/** insertTutorial should preserve the answerQueue */
module.exports.test_insertTutorial = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls, function (m) { test.ok(false, m); });
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
    quiz.insertQuestions(this.utQuestions, function () { });
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });

    // Answer some questions
    quiz.getNewQuestion(false, function(qn, a) {
        assignedQns.push(a);
        quiz.setQuestionAnswer(0, function () { });
    });
    quiz.getNewQuestion(false, function(qn, a) {
        assignedQns.push(a);
        quiz.setQuestionAnswer(0, function () { });
    });

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
    test.equal(lec.answerQueue.length, 3);
    test.deepEqual(lec.answerQueue[0], {"camel" : 8, "synced" : true});
    test.equal(lec.answerQueue[1].uri, assignedQns[0].uri);
    test.equal(lec.answerQueue[2].uri, assignedQns[1].uri);

    test.done();
};

/** lastEight should return last relevant questions */
module.exports.test_lastEight = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls, function (m) { test.ok(false, m); });
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
    quiz.insertQuestions(this.utQuestions, function () { });
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });

    // lastEight returns nothing
    test.deepEqual(quiz.lastEight(), []);

    // Answer some questions
    quiz.getNewQuestion(false, function(qn, a) {
        assignedQns.push(a);
        quiz.setQuestionAnswer(0, function () { });
    });
    quiz.getNewQuestion(false, function(qn, a) {
        assignedQns.push(a);
        quiz.setQuestionAnswer(0, function () { });
    });
    quiz.getNewQuestion(false, function(qn, a) {
        assignedQns.push(a);
        quiz.setQuestionAnswer(0, function () { });
    });
    test.equal(quiz.lastEight().length, 3);
    test.equal(quiz.lastEight()[0].uri, assignedQns[2].uri);
    test.equal(quiz.lastEight()[1].uri, assignedQns[1].uri);
    test.equal(quiz.lastEight()[2].uri, assignedQns[0].uri);

    // Unanswered questions don't count
    quiz.getNewQuestion(false, function(qn, a) {
        assignedQns.push(a);
        test.equal(quiz.lastEight().length, 3);
        quiz.setQuestionAnswer(0, function () {
            test.equal(quiz.lastEight().length, 4);
            test.equal(quiz.lastEight()[3].uri, assignedQns[0].uri);
        });
    });

    // Practice questions don't count
    quiz.getNewQuestion(true, function(qn, a) {
        assignedQns.push(a);
        quiz.setQuestionAnswer(0, function () { });
    });
    quiz.getNewQuestion(true, function(qn, a) {
        assignedQns.push(a);
        quiz.setQuestionAnswer(0, function () { });
    });
    quiz.getNewQuestion(false, function(qn, a) {
        assignedQns.push(a);
        quiz.setQuestionAnswer(0, function () { });
    });
    test.equal(quiz.lastEight().length, 5);
    test.equal(quiz.lastEight()[0].uri, assignedQns[6].uri);
    test.equal(quiz.lastEight()[1].uri, assignedQns[3].uri);
    test.equal(quiz.lastEight()[2].uri, assignedQns[2].uri);
    test.equal(quiz.lastEight()[3].uri, assignedQns[1].uri);
    test.equal(quiz.lastEight()[4].uri, assignedQns[0].uri);

    // Old questions don't count
    for (i = 0; i < 5; i++) {
        quiz.getNewQuestion(false, function(qn, a) {
            assignedQns.push(a);
            quiz.setQuestionAnswer(0, function () { });
        });
    }
    test.equal(quiz.lastEight().length, 8);
    test.equal(quiz.lastEight()[0].uri, assignedQns[11].uri);
    test.equal(quiz.lastEight()[1].uri, assignedQns[10].uri);
    test.equal(quiz.lastEight()[2].uri, assignedQns[9].uri);
    test.equal(quiz.lastEight()[3].uri, assignedQns[8].uri);
    test.equal(quiz.lastEight()[4].uri, assignedQns[7].uri);
    test.equal(quiz.lastEight()[5].uri, assignedQns[6].uri);
    test.equal(quiz.lastEight()[6].uri, assignedQns[3].uri);
    test.equal(quiz.lastEight()[7].uri, assignedQns[2].uri);

    test.done();
};

/** Should update question count upon answering questions */
module.exports.test_questionUpdate  = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls, function (m) { test.ok(false, m); });
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
    quiz.insertQuestions(this.utQuestions, function () { });
    quiz.setCurrentLecture({'tutUri': 'ut:tutorial0', 'lecUri': 'ut:lecture0'}, function () { });
    qnBefore = qnHash();

    // Assign a question, should see jump in counts
    quiz.getNewQuestion(true, function(qn, a) {
        assignedQns.push(a);
        quiz.setQuestionAnswer(0, function () {
            test.equal(
                qnBefore[assignedQns[0].uri].chosen + 1,
                qnHash()[assignedQns[0].uri].chosen
            );
            test.ok(
                qnBefore[assignedQns[0].uri].correct <=
                qnHash()[assignedQns[0].uri].correct
            );
        });
    });

    test.done();
};

module.exports.test_getNewQuestion = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new Quiz(ls, function (m) { test.ok(false, m); });
    var i, assignedQns = [];
    var startTime = Math.round((new Date()).getTime() / 1000) - 1;

    this.defaultLecture(quiz);

    quiz.getNewQuestion(false, function(qn, a) {
        assignedQns.push(a);
        // Question data has been set up
        test.equal(a.synced, false);
        test.deepEqual(a.ordering.sort(), qn.shuffle.sort());
        test.ok(a.quiz_time > startTime);

        // Counts have all started at 0
        test.equal(a.lec_answered, 0);
        test.equal(a.lec_correct, 0);
        test.equal(a.practice_answered, 0);
        test.equal(a.practice_answered, 0);

        test.equal(quiz.getCurrentLecture().answerQueue.length, 1);
        quiz.getNewQuestion(false, function(qn, a) {
            // No question answered, so just get the same one back.
            test.deepEqual(Array.last(assignedQns), a);
            test.equal(quiz.getCurrentLecture().answerQueue.length, 1);
            // Answer it, get new question
            quiz.setQuestionAnswer(0, function () { quiz.getNewQuestion(false, function(qn, a) {
                test.equal(quiz.getCurrentLecture().answerQueue.length, 2);

                // Counts have gone up
                test.equal(a.lec_answered, 1);
                test.ok(a.lec_correct <= a.lec_answered);
                test.equal(a.practice_answered, 0);
                test.equal(a.practice_correct, 0);

                // Answer, get practice question
                quiz.setQuestionAnswer(0, function () { quiz.getNewQuestion(true, function(qn, a) {
                    test.equal(quiz.getCurrentLecture().answerQueue.length, 3);

                    // Counts have gone up (but for question we answered)
                    test.equal(a.lec_answered, 2);
                    test.ok(a.lec_correct <= a.lec_answered);
                    test.equal(a.practice_answered, 0);
                    test.equal(a.practice_correct, 0);

                    // Answer it, practice counts go up
                    quiz.setQuestionAnswer(0, function (a) {
                        test.equal(a.lec_answered, 3);
                        test.ok(a.lec_correct <= a.lec_answered);
                        test.equal(a.practice_answered, 1);
                        test.ok(a.practice_correct <= a.practice_answered);
                    });
                });});
            });});
        });
    });

    test.done();
};
