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
    this.answerQueue = [];

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
    this.setCurrentLecture = function (tutUri, lecUri) {
        var i, twIndex = this._indexDoc();
        //TODO: Complain if tutorial doesn't exist.
        this.curTutorial = twIndex[tutUri];
        //TODO: Complain if lecture isn't in tutorial.
        for (i = 0; i < this.curTutorial.lectures.length; i++) {
            if (this.curTutorial.lectures[i].uri === lecUri) {
                this.curLecture = this.curTutorial.lectures[i];
                return;
            }
        }
        this.handleError("Lecture " + lecUri + "not part of current tutorial");
    };

    /** Choose a new question from the current tutorial/lecture */
    this.getNewQuestion = function (onSuccess) {
        var i, self = this;

        // Recieve question data, apply random ordering and pass it on
        function gotQuestionData(qn) {
            var ordering, a = Array.last(self.answerQueue);
            // Generate ordering, field value -> internal value
            ordering = qn.fixed_order.concat(Array.shuffle(qn.random_order));
            a.ordering = ordering;
            a.quiz_time = Math.round((new Date()).getTime() / 1000);
            onSuccess(qn, ordering);
        }
        //TODO: Hack!
        function itemAllocation(questions, answerQueue) {
			var grade = 5;
			var numquiz = [10, 10, 10];
			var numcorr = [10, 8, 5];
            return item_allocation(questions, answerQueue, grade);
        }

        // If the last item on the queue isn't answered, return that
        i = self.answerQueue.length - 1;
        if (i >= 0 && self.answerQueue[i].answer_time === null) {
            // Last question wasn't answered, return that
            self.getQuestionData(self.curLecture.questions[self.answerQueue[i].uri], gotQuestionData);
        } else {
            // Assign a new question
            i = itemAllocation(self.curLecture.questions, self.answerQueue);
            self.answerQueue.push({"uri": self.curLecture.questions[i].uri, "synced": false});
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
        var self = this, answerData, a = Array.last(self.answerQueue);
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
}
