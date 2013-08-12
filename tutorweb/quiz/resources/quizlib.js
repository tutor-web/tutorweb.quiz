/*jslint nomen: true, plusplus: true, browser:true*/

/**
  * Main quiz object
  *  ajax: function call to jQuery
  *  rawLocalStorage: Browser local storage object
  *  handleError: Function that displays error message to user
  */
function Quiz(ajax, rawLocalStorage, handleError) {
    "use strict";
    this.handleError = handleError;
    this.curTutorial = null;
    this.curLecture = null;

    // Wrapper to let localstorage take JSON
    function JSONLocalStorage(backing) {
        this.backing = backing;

        this.removeItem = function (key) {
            return backing.removeItem(key);
        };

        this.getItem = function (key) {
            var value = backing.getItem(key);
            if (value === null) {
                return value;
            }
            return JSON.parse(value);
        };

        this.setItem = function (key, value) {
            return backing.setItem(key, JSON.stringify(value));
        };
    }
    this.ls = new JSONLocalStorage(rawLocalStorage);

    // Get/set the main index document
    // Index looks like:-
    // { tut_uri : {"title" : title, "lectures": [{uri, title}, ...]} }
    this._indexDoc = function (value) {
        if (value) {
            this.ls.setItem('_tw_index', value);
        }
        return this.ls.getItem('_tw_index') || {};
    };

    /** Remove tutorial from localStorage, including all lectures */
    this.removeTutorial = function (tutUri) {
        var i, j, lectures, questions, twIndex = this._indexDoc();

        //TODO: What if questions were used elsewhere?
        lectures = twIndex[tutUri].lectures;
        for (i = 0; i < lectures.length; i++) {
            questions = lectures[i].questions;
            for (j = 0; j < lectures[i].questions.length; j++) {
                this.ls.removeItem(lectures[i].questions[j].uri);
            }
        }

        delete twIndex[tutUri];
        return this._indexDoc(twIndex);
    };

    /** Insert tutorial into localStorage */
    this.insertTutorial = function (tutUri, tutTitle, lectures) {
        var twIndex = this._indexDoc();
        if (twIndex[tutUri]) {
            twIndex = this.removeTutorial(tutUri);
        }
        twIndex[tutUri] = { "title": tutTitle, "lectures": lectures };
        this._indexDoc(twIndex);
    };

    /** Insert questions into localStorage */
    this.insertQuestions = function (qns) {
        var i, qnUris = Object.keys(qns);
        for (i = 0; i < qnUris.length; i++) {
            this.ls.setItem(qnUris[i], qns[qnUris[i]]);
        }
    };

    /** Return deep array of lectures and their URIs */
    this.getAvailableLectures = function (onSuccess) {
        var k, i, tutorials = [], lectures, twIndex = this._indexDoc();
        //TODO: Sort tutorials? Or use array instead?
        for (k in twIndex) {
            if (twIndex.hasOwnProperty(k)) {
                tutorials.push([k, twIndex[k].title, twIndex[k].lectures]);
            }
        }
        onSuccess(tutorials);
    };

    /** Set the current tutorial/lecture */
    this.setCurrentLecture = function (params, onSuccess) {
        var i, twIndex = this._indexDoc();
        if (!(params.tutUri && params.lecUri)) {
            this.handleError("Missing lecture parameters: tutUri, params.lecUri");
        }
        this.curTutorial = twIndex[params.tutUri];
        if (!this.curTutorial) {
            this.handleError("Unknown tutorial: " + params.tutUri);
            return;
        }
        for (i = 0; i < this.curTutorial.lectures.length; i++) {
            if (this.curTutorial.lectures[i].uri === params.lecUri) {
                this.curLecture = this.curTutorial.lectures[i];
                if (!this.curLecture.answerQueue) {
                    this.curLecture.answerQueue = [];
                }
                onSuccess(this.curTutorial.title, this.curLecture.title);
                return;
            }
        }
        this.handleError("Lecture " + params.lecUri + "not part of current tutorial");
    };

    /** Choose a new question from the current tutorial/lecture */
    this.getNewQuestion = function (onSuccess) {
        var i, answerQueue = this.curLecture.answerQueue, self = this;
        //TODO: Should be writing back answerQueue

        // Recieve question data, apply random ordering and pass it on
        function gotQuestionData(qn) {
            var ordering, a = Array.last(answerQueue);
            // Generate ordering, field value -> internal value
            ordering = qn.fixed_order.concat(Array.shuffle(qn.random_order));
            a.ordering = ordering;
            a.quiz_time = Math.round((new Date()).getTime() / 1000);
            onSuccess(qn, ordering);
        }
        function itemAllocation(questions, answerQueue) {
            var grade = 5;  //TODO: Where should this come from?
            return item_allocation(questions, answerQueue, grade);
        }

        if (answerQueue.length > 0 && Array.last(answerQueue).answer_time === null) {
            // Last question wasn't answered, return that
            self.getQuestionData(self.curLecture.questions[answerQueue[i].uri], gotQuestionData);
        } else {
            // Assign a new question
            i = itemAllocation(self.curLecture.questions, answerQueue);
            answerQueue.push({"uri": self.curLecture.questions[i].uri, "synced": false});
            self.getQuestionData(self.curLecture.questions[i].uri, gotQuestionData);
        }
    };

    /** Return the full data for a question */
    this.getQuestionData = function (uri, onSuccess) {
        var qn, self = this;
        qn = self.ls.getItem(uri);
        if (!qn) {
            self.handleError("Cannot find question " + uri);
        } else {
            onSuccess(qn);
        }
    };

    /** User has selected an answer */
    this.setQuestionAnswer = function (selectedAnswer, onSuccess) {
        // Fetch question off answer queue, add answer
        var self = this, answerData, a = Array.last(self.curLecture.answerQueue);
        a.answer_time = Math.round((new Date()).getTime() / 1000);
        a.student_answer = a.ordering[selectedAnswer];

        // Mark their work
        self.getQuestionData(a.uri, function (qn) {
            var i, answerData = typeof qn.answer === 'string' ? JSON.parse(window.atob(qn.answer)) : qn.answer;
            // Generate array showing which answers were correct
            a.ordering_correct = a.ordering.map(function (v) {
                return answerData.correct.indexOf(v) > -1;
            });
            // Student correct iff their answer is in list
            a.correct = answerData.correct.indexOf(a.student_answer) > -1;
            onSuccess(a, answerData, selectedAnswer);
        });
    };

    /** Send current answer queue back to TW */
    this.syncAnswers = function () {
        //TODO:
    };

    /** Helper to form a URL to a selected quiz */
    this.quizUrl = function (tutUri, lecUri) {
        return 'quiz.html?tutUri=' + encodeURIComponent(tutUri) + ';lecUri=' + encodeURIComponent(lecUri);
    };
}
