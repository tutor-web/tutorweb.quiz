/*jslint nomen: true, plusplus: true, browser:true*/
/*global iaa_lib*/

/**
  * Main quiz object
  *  rawLocalStorage: Browser local storage object
  *  handleError: Function that displays error message to user
  */
function Quiz(rawLocalStorage, handleError) {
    "use strict";
    this.handleError = handleError;
    this.tutorialUri = null;
    this.curTutorial = null;
    this.lecIndex = null;

    // Wrapper to let localstorage take JSON
    function JSONLocalStorage(backing, onQuotaExceeded) {
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
            try {
                backing.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                if (e.name.toLowerCase().indexOf('quota') > -1) {
                    onQuotaExceeded(key);
                    return false;
                }
                throw e;
            }
        };
    }
    this.ls = new JSONLocalStorage(rawLocalStorage, function (key) {
        handleError('No more local storage available. Please <a href="start.html">return to the menu</a> and delete some tutorials you are no longer using.', 'html');
    });

    /** Remove tutorial from localStorage, including all lectures */
    this.removeTutorial = function (tutUri, onSuccess) {
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
        if (self.ls.setItem('_index', twIndex)) { onSuccess(); }
    };

    /** Insert tutorial into localStorage */
    this.insertTutorial = function (tutUri, tutTitle, lectures) {
        var twIndex, self = this;
        self.ls.setItem(tutUri, { "title": tutTitle, "lectures": lectures });

        // Update index with link to document
        twIndex = self.ls.getItem('_index') || {};
        twIndex[tutUri] = 1;
        self.ls.setItem('_index', twIndex);
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

        function lecToObject(l) {
            return {
                "uri": self.quizUrl(k, l.uri),
                "title": l.title,
                "grade": self.gradeString(Array.last(l.answerQueue))
            };
        }
        for (k in twIndex) {
            if (twIndex.hasOwnProperty(k)) {
                t = self.ls.getItem(k);
                tutorials.push({
                    "uri": k,
                    "title": t.title,
                    "lectures": t.lectures.map(lecToObject),
                });
            }
        }
        //TODO: Sort tutorials?
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
                return onSuccess(
                    params.tutUri,
                    self.curTutorial.title,
                    params.lecUri,
                    lecture.title,
                    self.gradeString(Array.last(lecture.answerQueue))
                );
            }
        }
        self.handleError("Lecture " + params.lecUri + "not part of current tutorial");
    };

    /** Return the current lecture */
    this.getCurrentLecture = function () {
        var self = this;
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

    /** Choose a new question from the current tutorial/lecture */
    this.getNewQuestion = function (onSuccess) {
        var self = this, a, answerQueue = self.curAnswerQueue();

        function itemAllocation(curTutorial, lecIndex, answerQueue) {
            var questions, lib, gradenow;
            if (Math.random() < curTutorial.lectures[lecIndex].hist_sel) {
                questions = curTutorial.lectures[Math.floor(Math.random() * (lecIndex + 1))].questions;
            } else {
                questions = curTutorial.lectures[lecIndex].questions;
            }

			lib = new iaa_lib(answerQueue, questions);
            gradenow = lib.callGrade(); //this is called first so the grade is right for the time and iaa
            return {
                "uri": questions[lib.item_allocation()].uri,
                "allotted_time": lib.callTime(),
                "grade_before": gradenow[0],
                "grade_after_right": gradenow[1],
                "grade_after_wrong": gradenow[2],
                "lec_answered" : Array.last(answerQueue) === null ? 0 : (Array.last(answerQueue).lec_answered || 0),
                "lec_correct" : Array.last(answerQueue) === null ? 0 : (Array.last(answerQueue).lec_correct || 0),
            };
        }

        // Assign new question if last has been answered
        if (answerQueue.length === 0 || Array.last(answerQueue).answer_time) {
            answerQueue.push(itemAllocation(self.curTutorial, self.lecIndex, answerQueue));
        }

        // Get question data to go with last question on queue
        a = Array.last(answerQueue);
        self.getQuestionData(a.uri, function (qn) {
            // Generate ordering, field value -> internal value
            a.ordering = a.ordering || Array.shuffle(qn.shuffle || []);
            while (a.ordering.length < qn.choices.length) {
                // Pad out ordering with missing items on end
                //NB: Assuming that you can't have fixed items anywhere else for now.
                a.ordering.push(a.ordering.length);
            }
            a.quiz_time = a.quiz_time || Math.round((new Date()).getTime() / 1000);
            a.synced = false;
            if (self.ls.setItem(self.tutorialUri, self.curTutorial)) { onSuccess(qn, a); }
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
            // Set appropriate grade
            a.grade_after = a.correct ? a.grade_after_right : a.grade_after_wrong;
            a.lec_answered = (a.lec_answered || 0) + 1;
            a.lec_correct = (a.lec_correct || 0) + (a.correct ? 1 : 0);

            if (self.ls.setItem(self.tutorialUri, self.curTutorial)) {
                onSuccess(a, answerData, selectedAnswer, self.gradeString(a));
            }
        });
    };

    /** Send current answer queue back to TW */
    this.syncAnswers = function ($, onSuccess) {
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
        if (isSynced(curLecture)) {
            // Nothing to do, stop.
            return onSuccess('synced');
        }

        // Send lecture back to tutorweb
        syncingLength = curLecture.answerQueue.length;
        $.ajax({
            contentType: 'application/json',
            data: JSON.stringify(curLecture),
            url: curLecture.uri,
            type: 'POST',
            success: function (data) {
                var i, questionDfds;
                // Return array of questions not in first array
                function extraQuestions(existingArray, newArray) {
                    var i, dict = {}, out = [];
                    // Turn existing array into dict
                    for (i = 0; i < existingArray.length; i++) {
                        dict[existingArray[i].uri] = 1;
                    }
                    // For every element not in the dict, return it
                    for (i = 0; i < newArray.length; i++) {
                        if (!dict[newArray[i].uri]) {
                            out.push(newArray[i]);
                        }
                    }
                    return out;
                }

                // Ensure any counts in answerQueue are consistent
                function updateCounts(extra, prev) {
                    var i, lecAnswered = 0, lecCorrect = 0;
                    if (extra.length === 0) {
                        return extra;
                    }
                    lecAnswered = prev ? prev.lec_answered : 0;
                    lecCorrect = prev ? prev.lec_correct : 0;
                    for (i = 0; i < extra.length; i++) {
                        lecAnswered += extra[i].answer_time ? 1 : 0;
                        lecCorrect += extra[i].correct ? 1 : 0;
                    }
                    Array.last(extra).lec_answered = lecAnswered;
                    Array.last(extra).lec_correct = lecCorrect;
                    return extra;
                }

                // Meld answerQueue from server with any new items.
                curLecture.answerQueue = data.answerQueue.concat(
                    updateCounts(curLecture.answerQueue.slice(syncingLength), Array.last(data.answerQueue))
                );

                // Fetch any new questions
                questionDfds = extraQuestions(curLecture.questions, data.questions).map(function (qn) {
                    // New question we don't have yet
                    return $.ajax({
                        type: "GET",
                        cache: false,
                        url: qn.uri,
                        error: function (jqXHR, textStatus, errorThrown) {
                            handleError("Failed to fetch new questions: " + textStatus);
                        },
                        success: function (data) {
                            var qns = {};
                            qns[qn.uri] = data;
                            self.insertQuestions(qns, function () {
                            });
                        },
                    });
                });
                $.when.apply(null, questionDfds).done(function () {
                    // Remove local copy of removed questions
                    extraQuestions(data.questions, curLecture.questions).map(function (qn) {
                        self.ls.removeItem(qn.uri);
                    });
                    // Update local copy of lecture
                    curLecture.histsel = data.histsel;
                    curLecture.questions = data.questions;
                    if (self.ls.setItem(self.tutorialUri, self.curTutorial)) {
                        onSuccess('online');
                    }
                });
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

    /** Helper to turn the last item in an answerQueue into a grade string */
    this.gradeString = function (last) {
        if (!last) { return; }
        return "Grade: " + (last.grade_after || last.grade_before || 0)
             + ", " + last.lec_answered + " answered"
             + ", " + last.lec_correct + " correct";
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
             + location.host + '/';
    };
}
