// Bodge in what we need from libraries.js
Object.keys||(Object.keys=function(a){if(a!==Object(a))throw new TypeError("Object.keys called on non-object");var c=[],b;for(b in a)Object.prototype.hasOwnProperty.call(a,b)&&c.push(b);return c});
Array.shuffle||(Array.shuffle=function(a){for(var c,d,b=a.length;b;c=parseInt(Math.random()*b),d=a[--b],a[b]=a[c],a[c]=d);return a});
Array.last=Array.last||function(a){return 0<a.length?a[a.length-1]:null};
Array.prototype.map||(Array.prototype.map=function(d,f){var g,e,a;if(null==this)throw new TypeError(" this is null or not defined");var b=Object(this),h=b.length>>>0;if("function"!==typeof d)throw new TypeError(d+" is not a function");f&&(g=f);e=Array(h);for(a=0;a<h;){var c;a in b&&(c=b[a],c=d.call(g,c,a,b),e[a]=c);a++}return e});
Array.prototype.indexOf||(Array.prototype.indexOf=function(d){if(null==this)throw new TypeError;var c=Object(this),b=c.length>>>0;if(0===b)return-1;var a=0;1<arguments.length&&(a=Number(arguments[1]),a!=a?a=0:0!=a&&(Infinity!=a&&-Infinity!=a)&&(a=(0<a||-1)*Math.floor(Math.abs(a))));if(a>=b)return-1;for(a=0<=a?a:Math.max(b-Math.abs(a),0);a<b;a++)if(a in c&&c[a]===d)return a;return-1});
Array.last=Array.last||function(a){return 0<a.length?a[a.length-1]:null};

var quizlib = require('../tutorweb/quiz/resources/quizlib.js');

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

    callback();
};

/** Should only remove genuinely unused objects */
module.exports.test_removeUnusedObjects = function (test) {
    var ls = new MockLocalStorage();
    var quiz = new quizlib.Quiz(ls, function (m) { test.ok(false, m); });

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
