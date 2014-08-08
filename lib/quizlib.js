/*jslint nomen: true, plusplus: true, browser:true*/
/* global require, module, console */
var iaalib = new (require('./iaa.js'))();
var Promise = require('es6-promise').Promise;

/**
  * Main quiz object
  *  rawLocalStorage: Browser local storage object
  */
module.exports = function Quiz(rawLocalStorage, ajaxApi) {
    "use strict";
    this.tutorialUri = null;
    this.curTutorial = null;
    this.lecIndex = null;
    this.ajaxApi = ajaxApi;

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
            backing.setItem(key, JSON.stringify(value));
            return true;
        };

        this.listItems = function () {
            var i, out = [];
            for (i = 0; i < backing.length; i++) {
                out.push(backing.key(i));
            }
            return out;
        };
    }
    this.ls = new JSONLocalStorage(rawLocalStorage);

    // Terrible hack to get fatal error to bubble up.
    function promiseFatalError(err) {
        var r;
        if (window && window.onerror) {
            r = /at (.*?):(\d+):(\d+)/.exec(err.stack);
            window.onerror(err.message, r[1], r[2]);
        }
        console.log("Promise resulted in error: " + err.stack);
    }

    /** Remove tutorial from localStorage, including all lectures, return true iff successful */
    this.removeTutorial = function (tutUri) {
        var i, j, lectures, questions, twIndex, self = this;

        // Remove question objects associated with this tutorial
        lectures = self.ls.getItem(tutUri).lectures;
        for (i = 0; i < lectures.length; i++) {
            questions = lectures[i].questions;
            for (j = 0; j < lectures[i].questions.length; j++) {
                this.ls.removeItem(lectures[i].questions[j].uri);
            }
        }

        // Remove tutorial, and reference in index
        this.ls.removeItem(tutUri);
        twIndex = self.ls.getItem('_index');
        if (!twIndex) { return false; }
        delete twIndex[tutUri];
        return !!(self.ls.setItem('_index', twIndex));
    };

    /** Insert questions into localStorage */
    this.insertQuestions = function (qns, onSuccess) {
        var i, qnUris = Object.keys(qns);
        for (i = 0; i < qnUris.length; i++) {
            if (!this.ls.setItem(qnUris[i], qns[qnUris[i]])) { return; }
        }
        onSuccess();
    };

    /** Return deep array of lectures and their URIs */
    this.getAvailableLectures = function (onSuccess) {
        var self = this, k, t,
            tutorials = [],
            twIndex = self.ls.getItem('_index');

        function isSynced(lecture) {
            var i;
            for (i = 0; i < lecture.answerQueue.length; i++) {
                if (!lecture.answerQueue[i].synced) {
                    return false;
                }
            }
            return true;
        }
        function lecToObject(l) {
            return {
                "uri": self.quizUrl(k, l.uri),
                "title": l.title,
                "grade": self.gradeString(Array.last(l.answerQueue)),
                "synced": isSynced(l)
            };
        }
        /* jshint ignore:start */ // https://github.com/jshint/jshint/issues/1016
        for (k in twIndex)
        /* jshint ignore:end */ {
            if (twIndex.hasOwnProperty(k)) {
                t = self.ls.getItem(k);
                if (t && t.lectures) {
                    tutorials.push({
                        "uri": k,
                        "title": t.title,
                        "lectures": t.lectures.map(lecToObject),
                    });
                }
            }
        }
        //TODO: Sort tutorials?
        onSuccess(tutorials);
    };

    /** Set the current tutorial/lecture */
    this.setCurrentLecture = function (params, onSuccess) {
        var self = this, i, lecture, lastAns;
        if (!(params.tutUri && params.lecUri)) {
            throw "Missing lecture parameters: tutUri, params.lecUri";
        }

        // Find tutorial
        self.curTutorial = self.ls.getItem(params.tutUri);
        if (!self.curTutorial) {
            throw "Unknown tutorial: " + params.tutUri;
        }
        self.tutorialUri = params.tutUri;

        // Find lecture within tutorial
        for (i = 0; i < self.curTutorial.lectures.length; i++) {
            lecture = self.curTutorial.lectures[i];
            if (lecture.uri === params.lecUri) {
                lastAns = Array.last(lecture.answerQueue);
                self.lecIndex = i;
                iaalib.gradeAllocation(lecture.settings, self.curAnswerQueue());
                return onSuccess(
                    Array.last(lecture.answerQueue),
                    (lastAns && !lastAns.answer_time ? lastAns.practice ? 'practice' : 'real' : false),
                    params.tutUri,
                    self.curTutorial.title,
                    params.lecUri,
                    lecture.title
                );
            }
        }
        throw "Lecture " + params.lecUri + "not part of current tutorial";
    };

    /** Return the current lecture */
    this.getCurrentLecture = function () {
        var self = this;
        if (self.lecIndex === null) {
            throw "No lecture selected";
        }
        return self.curTutorial.lectures[self.lecIndex];
    };

    /** Return the answer queue for the current lecture */
    this.curAnswerQueue = function () {
        var self = this, curLecture = self.getCurrentLecture();
        if (!curLecture.answerQueue) {
            curLecture.answerQueue = [];
        }
        return curLecture.answerQueue;
    };

    /** Return last eight non-practice questions in reverse order */
    this.lastEight = function () {
        var self = this, i, a,
            answerQueue = self.curAnswerQueue(),
            out = [];

        for (i = answerQueue.length; i > 0; i--) {
            a = answerQueue[i - 1];
            if (a.answer_time && !a.practice) {
                out.push(a);
            }
            if (out.length >= 8) { return out; }
        }
        return out;
    };

    /** Choose a new question from the current tutorial/lecture */
    this.getNewQuestion = function (practiceMode, onSuccess) {
        var self = this, a, lastAns,
            answerQueue = self.curAnswerQueue();
        lastAns = Array.last(answerQueue);

        if (!lastAns || lastAns.answer_time) {
            // Assign new question if last has been answered
            a = iaalib.newAllocation(self.curTutorial, self.lecIndex, answerQueue, practiceMode);
            if (!a) {
                throw "Lecture has no questions!";
            }
            a.lec_answered = lastAns && lastAns.lec_answered ? lastAns.lec_answered : 0;
            a.lec_correct = lastAns && lastAns.lec_correct ? lastAns.lec_correct : 0;
            a.practice_answered = lastAns && lastAns.practice_answered ? lastAns.practice_answered : 0;
            a.practice_correct = lastAns && lastAns.practice_correct ? lastAns.practice_correct : 0;

            answerQueue.push(a);
        } else {
            // Get question data to go with last question on queue
            a = lastAns;
        }

        self._getQuestionData(a.uri).then(function (qn) {
            a.question_type = qn._type;
            if (qn._type === 'template') {
            } else {
                // Generate ordering, field value -> internal value
                a.ordering = a.ordering || Array.shuffle(qn.shuffle || []);
                while (a.ordering.length < qn.choices.length) {
                     // Pad out ordering with missing items on end
                    //NB: Assuming that you can't have fixed items anywhere else for now.
                    a.ordering.push(a.ordering.length);
                }
            }
            a.quiz_time = a.quiz_time || Math.round((new Date()).getTime() / 1000);
            a.synced = false;
            a.remaining_time = a.allotted_time;
            if (a.allotted_time && a.quiz_time) {
                a.remaining_time -= Math.round((new Date()).getTime() / 1000) - a.quiz_time;
            }
            if (self.ls.setItem(self.tutorialUri, self.curTutorial)) { onSuccess(qn, a); }
        })['catch'](promiseFatalError);
    };

    /** Returns a promise with the question data, either from localstorage or HTTP */
    this._getQuestionData = function (uri) {
        var qn, self = this;
        qn = self.ls.getItem(uri);
        if (qn) {
            return Promise.resolve(qn);
        }

        // That didn't work, try HTTP.
        return self.ajaxApi.getJson(uri);
    };

    /** User has selected an answer */
    this.setQuestionAnswer = function (formData, onSuccess) {
        // Fetch question off answer queue, add answer
        var self = this,
            curLecture = self.getCurrentLecture(),
            a = Array.last(self.curAnswerQueue());
        a.answer_time = Math.round((new Date()).getTime() / 1000);
        a.form_data = formData;
        a.synced = false;

        // Question template
        if (a.question_type === 'template') {
            var parts;

            a.correct = false;
            a.student_answer = { "choices": [] };
            a.form_data.map(function (val) {
                var k = val.name, v = val.value;
                if (k === 'text') {
                    a.correct = v.length > 0;
                    a.student_answer.text = v;
                } else if (k === 'explanation') {
                    a.student_answer.explanation = v;
                } else if (k.match(/^choice_\d+/)) {
                    parts = k.split('_');
                    if (typeof(a.student_answer.choices[parts[1]]) === 'undefined') {
                        a.student_answer.choices[parts[1]] = { answer: "", correct: false };
                    }
                    if (parts.length == 2) {
                        a.student_answer.choices[parts[1]].answer = v;
                    } else if (parts[2] === "correct" && v) {
                        a.student_answer.choices[parts[1]].correct = true;
                    }
                } else {
                    throw new Error('Unknown form element ' + k);
                }
            });

            iaalib.gradeAllocation(curLecture.settings, self.curAnswerQueue());
            a.lec_answered = (a.lec_answered || 0) + 1;

            // Update and return
            if (self.ls.setItem(self.tutorialUri, self.curTutorial)) {
                onSuccess(a, {});
            }

            return;
        }

        // It's a real question, get question data and mark
        self._getQuestionData(a.uri).then(function (qn) {
            var i,
                answerData = typeof qn.answer === 'string' ? JSON.parse(window.atob(qn.answer)) : qn.answer;

            // Find student answer in the form_data
            a.selected_answer = null;
            a.student_answer = null;
            for (i = 0; i < a.form_data.length; i++) {
                if (a.form_data[i].name === 'answer') {
                    a.selected_answer = a.form_data[i].value;
                    a.student_answer = a.ordering[a.selected_answer];
                    if (typeof a.student_answer === "undefined") {
                        a.student_answer = null;
                    }
                }
            }

            // Generate array showing which answers were correct
            a.ordering_correct = a.ordering.map(function (v) {
                return answerData.correct.indexOf(v) > -1;
            });
            // Student correct iff their answer is in list
            a.correct = answerData.correct.indexOf(a.student_answer) > -1;

            // Set appropriate grade
            iaalib.gradeAllocation(curLecture.settings, self.curAnswerQueue());
            a.lec_answered = (a.lec_answered || 0) + 1;
            a.lec_correct = (a.lec_correct || 0) + (a.correct ? 1 : 0);
            a.practice_answered = (a.practice_answered || 0) + (a.practice ? 1 : 0);
            a.practice_correct = (a.practice_correct || 0) + (a.practice && a.correct ? 1 : 0);

            // Update question with new counts
            for (i = 0; i < curLecture.questions.length; i++) {
                if (a.uri === curLecture.questions[i].uri) {
                    curLecture.questions[i].chosen += 1;
                    curLecture.questions[i].correct += a.correct ? 1 : 0;
                    break;
                }
            }

            if (self.ls.setItem(self.tutorialUri, self.curTutorial)) {
                onSuccess(a, answerData);
            }
        })['catch'](promiseFatalError);
    };

    /** Go through all tutorials/lectures, remove any lectures that don't have an owner */
    this.removeUnusedObjects = function () {
        var self = this, i, t, q, k, tutorial, lectures,
            lsContent = {},
            removedItems = [],
            lsList = self.ls.listItems(),
            twIndex = self.ls.getItem('_index');

        // Form object of everything in localStorage
        for (i = 0; i < lsList.length; i++) {
            lsContent[lsList[i]] = 0;
        }

        // Mark everything we find a reference to with 1
        lsContent._index = 1;
        for (t in twIndex) {
            if (twIndex.hasOwnProperty(t)) {
                tutorial = self.ls.getItem(t);
                if (!tutorial || !tutorial.lectures) { continue; }
                lsContent[t] = 1;
                lectures = tutorial.lectures;
                for (i = 0; i < lectures.length; i++) {
                    for (q in lectures[i].questions) {
                        if (lectures[i].questions.hasOwnProperty(q)) {
                            lsContent[lectures[i].questions[q].uri] = 1;
                        }
                    }
                }
            }
        }

        // If anything didn't get a reference, remove it
        for (k in lsContent) {
            if (lsContent.hasOwnProperty(k) && lsContent[k] === 0) {
                removedItems.push(k);
                self.ls.removeItem(k);
            }
        }
        return removedItems;
    };

    /** Insert tutorial into localStorage */
    this.insertTutorial = function (tutUri, tutTitle, lectures) {
        var self = this, i, twIndex,
            oldLectures = {};
        self.curTutorial = self.ls.getItem(tutUri);
        self.tutorialUri = tutUri;

        if (self.ls.getItem(tutUri)) {
            // Sort old lectures into a dict by URI
            for (i = 0; i < self.curTutorial.lectures.length; i++) {
                oldLectures[self.curTutorial.lectures[i].uri] = self.curTutorial.lectures[i];
            }
            // Tutorial already exists, update each lecture
            self.curTutorial.title = tutTitle;
            self.curTutorial.lectures = [];
            for (i = 0; i < lectures.length; i++) {
                if (oldLectures[lectures[i].uri]) {
                    self.curTutorial.lectures.push(oldLectures[lectures[i].uri]);
                    self.lecIndex = i;
                    self.updateLecture(lectures[i], 0);
                } else {
                    self.curTutorial.lectures.push(lectures[i]);
                }
            }
        } else {
            // Add whole tutorial to localStorage
            self.curTutorial = { "title": tutTitle, "lectures": lectures };
        }
        if (!self.ls.setItem(self.tutorialUri, self.curTutorial)) {
            return false;
        }

        // Update index with link to document
        twIndex = self.ls.getItem('_index') || {};
        twIndex[tutUri] = 1;
        return !!(self.ls.setItem('_index', twIndex));
    };

    /** Meld new lecture together with current */
    this.updateLecture = function (newLecture, syncingLength) {
        var self = this,
            curLecture = self.getCurrentLecture();

        // Check it's for the same user
        if (curLecture.user != newLecture.user) {
            throw "You are trying to download a lecture as a different user. Click 'Return to menu', Log out and try again.";
        }
        // Ensure any counts in answerQueue are consistent
        function updateCounts(extra, start) {
            var i, prevAnswer = start;
            if (start === null) {
                // No extra items to correct counts with (as in mock-tutorial)
                // so do nothing.
                return extra;
            }
            for (i = 0; i < extra.length; i++) {
                extra[i].lec_answered = (prevAnswer.lec_answered || 0) + (extra[i].answer_time ? 1 : 0);
                extra[i].lec_correct = (prevAnswer.lec_correct || 0) + (extra[i].correct ? 1 : 0);
                extra[i].practice_answered = (prevAnswer.practice_answered || 0) + (extra[i].practice && extra[i].answer_time ? 1 : 0);
                extra[i].practice_correct = (prevAnswer.practice_correct || 0) + (extra[i].practice && extra[i].correct ? 1 : 0);
                prevAnswer = extra[i];
            }
            return extra;
        }

        // Meld answerQueue from server with any new items.
        curLecture.answerQueue = newLecture.answerQueue.concat(
            updateCounts(curLecture.answerQueue.slice(syncingLength), Array.last(newLecture.answerQueue))
        );

        // Update local copy of lecture
        curLecture.title = newLecture.title;
        curLecture.settings = newLecture.settings;
        curLecture.questions = newLecture.questions;
        curLecture.removed_questions = newLecture.removed_questions;
        curLecture.slide_uri = newLecture.slide_uri;
        return self.ls.setItem(self.tutorialUri, self.curTutorial);
    };

    /** Generate AJAX call that will sync the current lecture */
    this.syncLecture = function (force) {
        var self = this, syncingLength, curLecture = self.getCurrentLecture();
        // Return true iff every answerQueue item has been synced
        function isSynced(lecture) {
            var i;
            for (i = 0; i < lecture.answerQueue.length; i++) {
                if (!lecture.answerQueue[i].synced) {
                    return false;
                }
            }
            return true;
        }
        if (!force && isSynced(curLecture)) {
            // Nothing to do, stop.
            return null;
        }

        // Note how long queue is now, so we don't loose questions in progress
        syncingLength = curLecture.answerQueue.length;
        while (syncingLength > 0 && !curLecture.answerQueue[syncingLength - 1].answer_time) {
            // Last item hasn't been answered yet, leave it alone
            syncingLength = syncingLength - 1;
        }

        // Generate AJAX call
        return {
            contentType: 'application/json',
            data: JSON.stringify(curLecture),
            url: curLecture.uri,
            type: 'POST',
            success: function (data) {
                self.updateLecture(data, syncingLength);
            },
        };
    };

    /** Generate array of AJAX calls, call them to have a complete set of questions */
    this.syncQuestions = function () {
        var self = this,
            missingQns = [],
            curLecture = self.getCurrentLecture();

        // Remove local copy of dead questions
        if (curLecture.removed_questions) {
            curLecture.removed_questions.map(function (qn) {
                self.ls.removeItem(qn);
            });
        }

        // Which questions are stale?
        missingQns = curLecture.questions.filter(function (qn) {
            //TODO: Should be checking question age too
            return ( !qn.online_only &&
                (self.ls.getItem(qn.uri) === null));
        });

        if (missingQns.length >= Math.min(10, curLecture.questions.length)) {
            // Most questions are missing, so just fetch everything
            return [{
                type: "GET",
                cache: false,
                url: curLecture.question_uri,
                success: function (data) {
                    self.insertQuestions(data, function () {});
                }
            }];
        }
        // Otherwise, fetch new questions
        return missingQns.map(function (qn) {
            // New question we don't have yet
            return {
                type: "GET",
                cache: false,
                url: qn.uri,
                success: function (data) {
                    var qns = {};
                    qns[qn.uri] = data;
                    self.insertQuestions(qns, function () {});
                },
            };
        });
    };

    /** Return an .ajax call that gets the slides */
    this.fetchSlides = function () {
        var self = this,
            curLecture = self.getCurrentLecture();

        if (!curLecture.slide_uri) {
            throw "tutorweb::error::No slides available!";
        }
        return {
            type: "GET",
            url: curLecture.slide_uri,
            datatype: 'html',
        };
    };

    /** Helper to turn the last item in an answerQueue into a grade string */
    this.gradeString = function (a) {
        var out = "";
        if (!a) { return ""; }
        if (a.practice) {
            out = "Practice mode";
            if (a.hasOwnProperty('practice_answered')) {
                out += ": " + a.practice_answered + " practice questions, " + a.practice_correct + " correct.";
            }
            return out;
        }
        if (a.hasOwnProperty('lec_answered') && a.hasOwnProperty('lec_correct')) {
            out += "\nAnswered " + (a.lec_answered - (a.practice_answered || 0)) + " questions, ";
            out += (a.lec_correct - (a.practice_correct || 0)) + " correctly.";
        }
        if (a.hasOwnProperty('grade_after') || a.hasOwnProperty('grade_before')) {
            out += "\nYour grade: ";
            out += a.hasOwnProperty('grade_after') ? a.grade_after : a.grade_before;
            if (a.hasOwnProperty('grade_next_right')) {
                out += ", if you get the next question right: " + a.grade_next_right;
            }
        }
        return out;
    };

    /** Helper to form a URL to a selected quiz */
    this.quizUrl = function (tutUri, lecUri) {
        return 'quiz.html?tutUri=' + encodeURIComponent(tutUri) + ';lecUri=' + encodeURIComponent(lecUri);
    };

    /**
      * Given URL object, chop querystring up into a key/value object
      * e.g. quiz.parseQS(window.location)
      */
    this.parseQS = function (url) {
        var i, part,
            out = {},
            qs = url.search.replace(/^\?/, '').split(/;|&/);
        for (i = 0; i < qs.length; i++) {
            part = qs[i].split('=');
            out[part[0]] = decodeURIComponent(part[1]);
        }
        return out;
    };

    /**
      * Based on location (e.g. document.location) Return what is probably the
      * Plone root
      */
    this.portalRootUrl = function (location) {
        return location.protocol + '//' + location.host + '/';
    };
};
