/*jslint nomen: true, plusplus: true, browser:true*/
/*global item_allocation*/

/**
  * Main quiz object
  *  ajax: function call to jQuery
  *  rawLocalStorage: Browser local storage object
  *  handleError: Function that displays error message to user
  */
function Quiz(ajax, rawLocalStorage, handleError) {
    "use strict";
    this.handleError = handleError;
    this.ajax = ajax;
    this.tutorialUri = null;
    this.curTutorial = null;
    this.lecIndex = null;

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

    /** Remove tutorial from localStorage, including all lectures */
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
        delete twIndex[tutUri];
        self.ls.setItem('_index', twIndex);
        return twIndex;
    };

    /** Insert tutorial into localStorage */
    this.insertTutorial = function (tutUri, tutTitle, lectures) {
        var twIndex, self = this;
        self.ls.setItem(tutUri, { "title": tutTitle, "lectures": lectures });

        // Update index with link to document
        twIndex = self.ls.getItem('_index') || {};
        twIndex[tutUri] = 1;
        self.ls.setItem('_index', twIndex);
        return twIndex;
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
        var k, tutorials = [], t, twIndex, self = this;
        //TODO: Sort tutorials? Or use array instead?
        twIndex = self.ls.getItem('_index');
        for (k in twIndex) {
            if (twIndex.hasOwnProperty(k)) {
                t = self.ls.getItem(k);
                tutorials.push([k, t.title, t.lectures]);
            }
        }
        onSuccess(tutorials);
    };

    /** Set the current tutorial/lecture */
    this.setCurrentLecture = function (params, onSuccess) {
        var self = this, i, lecture;
        if (!(params.tutUri && params.lecUri)) {
            self.handleError("Missing lecture parameters: tutUri, params.lecUri");
        }

        // Find tutorial
        self.curTutorial = self.ls.getItem(params.tutUri);
        if (!self.curTutorial) {
            self.handleError("Unknown tutorial: " + params.tutUri);
            return;
        }
        self.tutorialUri = params.tutUri;

        // Find lecture within tutorial
        for (i = 0; i < self.curTutorial.lectures.length; i++) {
            lecture = self.curTutorial.lectures[i];
            if (lecture.uri === params.lecUri) {
                self.lecIndex = i;
                return onSuccess(self.curTutorial.title, lecture.title);
            }
        }
        self.handleError("Lecture " + params.lecUri + "not part of current tutorial");
    };

    /** Return the answer queue for the current lecture */
    this.curAnswerQueue = function () {
        var self = this, curLecture = self.curTutorial.lectures[self.lecIndex];
        if (!curLecture.answerQueue) {
            curLecture.answerQueue = [];
        }
        return curLecture.answerQueue;
    };

    /** Choose a new question from the current tutorial/lecture */
    this.getNewQuestion = function (onSuccess) {
        var self = this, a, answerQueue = self.curAnswerQueue();

        function itemAllocation(curTutorial, lecIndex, answerQueue) {
            var i, questions = curTutorial.lectures[lecIndex].questions;
			var lib = new iaa_lib(answerQueue, questions);
			var gradenow = lib.callGrade(); //this is called first so the grade is right for the time and iaa
            i = lib.item_allocation();
			var j = lib.callTime();		
            return {
                "uri": questions[i].uri,
                "alloted_time": j,
				"current_grade": gradenow[3][0], 
				"next_grade": gradenow[3][1]
            };
        }

        // Assign new question if last has been answered
        if (answerQueue.length === 0 || Array.last(answerQueue).answer_time !== null) {
            answerQueue.push(itemAllocation(self.curTutorial, self.lecIndex, answerQueue));
        }

        // Get question data to go with last question on queue
        a = Array.last(answerQueue);
        self.getQuestionData(a.uri, function (qn) {
            var ordering;
            // Generate ordering, field value -> internal value
            ordering = qn.fixed_order.concat(Array.shuffle(qn.random_order));
            a.ordering = ordering;
            a.quiz_time = Math.round((new Date()).getTime() / 1000);
            a.synced = false;
            self.ls.setItem(self.tutorialUri, self.curTutorial);
            onSuccess(qn, a);
        });
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
        var self = this, answerData, a = Array.last(self.curAnswerQueue());
        a.answer_time = Math.round((new Date()).getTime() / 1000);
        a.student_answer = a.ordering[selectedAnswer];
        a.synced = false;

        // Mark their work
        self.getQuestionData(a.uri, function (qn) {
            var i, answerData = typeof qn.answer === 'string' ? JSON.parse(window.atob(qn.answer)) : qn.answer;
            // Generate array showing which answers were correct
            a.ordering_correct = a.ordering.map(function (v) {
                return answerData.correct.indexOf(v) > -1;
            });
            // Student correct iff their answer is in list
            a.correct = answerData.correct.indexOf(a.student_answer) > -1;
            self.ls.setItem(self.tutorialUri, self.curTutorial);
            onSuccess(a, answerData, selectedAnswer);
        });
    };

    /** Send current answer queue back to TW */
    this.syncAnswers = function (onSuccess) {
        var self = this, curLecture = self.curTutorial.lectures[self.lecIndex];
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
        if (isSynced(curLecture)) {
            // Nothing to do, stop.
            return onSuccess('synced');
        }

        // Send lecture back to tutorweb
        self.ajax({
            contentType: 'application/json',
            data: JSON.stringify(curLecture),
            url: curLecture.uri,
            type: 'POST',
            success: function (data) {
                var i;
                //NB: answerQueue could have grown in the mean time, don't process
                // entire thing.

                // Mark items the server has now synced
                for (i = 0; i < data.answerQueue.length; i++) {
                    curLecture.answerQueue[i].synced = data.answerQueue[i].synced;
                }

                // If answerQueue is beyond maximum, remove synced items
                i = 0;
                while ((curLecture.answerQueue.length - i) > 8 && curLecture.answerQueue[i].synced) {
                    i++;
                }
                curLecture.answerQueue.splice(0, i);
                self.ls.setItem(self.tutorialUri, self.curTutorial);

                onSuccess('online');
            },
            error: function (jqXHR, textStatus, errorThrown) {
                if (jqXHR.status === 401 || jqXHR.status === 403) {
                    onSuccess('unauth');
                    return;
                }
                onSuccess('error');
            },
        });
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
        return location.protocol + '//'
             + location.host
             + location.pathname.substr(0, location.pathname.indexOf('/', 1));
    };
}
