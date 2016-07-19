/*jslint nomen: true, plusplus: true, browser:true, todo:true, regexp: true */
/*global require, module */
var iaalib = new (require('./iaa.js'))();
var Promise = require('es6-promise').Promise;
var shuffle = require('knuth-shuffle').knuthShuffle;
var JSONLocalStorage = require('./jsonls');

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
    this.ls = new JSONLocalStorage(rawLocalStorage, function (k) {
        return k.indexOf('quizdb-get-question') > -1;
    });

    // Return last member of array, or null
    function arrayLast(a) {
        return 0 < a.length ? a[a.length - 1] : null;
    }

    // Return current time, in seconds
    function curTime() {
        return Math.round((new Date()).getTime() / 1000);
    }

    // Hack to get uncaught error to bubble up.
    function promiseFatalError(err) {
        setTimeout(function () {
            throw err;
        }, 0);
        throw err;
    }

    /** Remove tutorial from localStorage, including all lectures, return true iff successful */
    this.removeTutorial = function (tutUri) {
        var i, j, lectures, twIndex, self = this;

        // Remove question objects associated with this tutorial
        lectures = self.ls.getItem(tutUri).lectures;
        for (i = 0; i < lectures.length; i++) {
            for (j = 0; j < lectures[i].questions.length; j++) {
                this.ls.removeItem(lectures[i].questions[j].uri);
            }
        }

        // Remove tutorial, and reference in index
        this.ls.removeItem(tutUri);
        twIndex = self.ls.getItem('_index');
        if (!twIndex) { return false; }
        delete twIndex[tutUri];
        self.ls.setItem('_index', twIndex);
        return true;
    };

    /** Insert questions into localStorage */
    this.insertQuestions = function (qns) {
        var self = this;
        Object.keys(qns).map(function (qnUri) {
            self.ls.setItem(qnUri, qns[qnUri]);
        });
    };

    /** Return promise to deep array of lectures and their URIs */
    this.getAvailableLectures = function () {
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
            var gradeString, gradeSummary = self.gradeSummary(l);

            gradeString = gradeSummary.stats || '';
            if (gradeSummary.grade) {
                gradeString += '\n' + gradeSummary.grade;
            }

            return {
                "uri": l.uri,
                "title": l.title,
                "grade": gradeString,
                "synced": isSynced(l)
            };
        }
        for (k in twIndex) {
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
        return Promise.resolve(tutorials);
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
                lastAns = arrayLast(lecture.answerQueue);
                self.lecIndex = i;
                iaalib.gradeAllocation(lecture.settings, self.curAnswerQueue(), lecture);
                return onSuccess(
                    arrayLast(lecture.answerQueue),
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
        if (!this.isLectureSelected()) {
            throw "No lecture selected";
        }
        return this.curTutorial.lectures[this.lecIndex];
    };

    /** True iff a lecture is selected on the current page */
    this.isLectureSelected = function () {
        return this.lecIndex !== null;
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
    this.getNewQuestion = function (opts, onSuccess) {
        var self = this, a;

        return Promise.resolve().then(function assignNewQuestion(attempts) {
            var answerQueue = self.curAnswerQueue(),
                curLecture = self.getCurrentLecture(),
                lastAns = arrayLast(answerQueue);

            // If there's an unanswered question, carry on answering that
            if (lastAns && !lastAns.answer_time) {
                a = lastAns;
                return self._getQuestionData(a.uri);
            }

            // No new questions when using mobile.tutor-web.net
            if (typeof window === "object" && window.location.host.indexOf("mobile.") !== -1) {
                throw new Error("tutorweb::error::mobile.tutor-web.net is being moved!" +
                    " Please click 'Back to main menu' then select 'Clear data and logout'." +
                    " You can pick up your work again at http://tutor-web.net");
            }

            // Assign new question
            a = iaalib.newAllocation(curLecture, opts || {});
            a.lec_answered = lastAns && lastAns.lec_answered ? lastAns.lec_answered : 0;
            a.lec_correct = lastAns && lastAns.lec_correct ? lastAns.lec_correct : 0;
            a.practice_answered = lastAns && lastAns.practice_answered ? lastAns.practice_answered : 0;
            a.practice_correct = lastAns && lastAns.practice_correct ? lastAns.practice_correct : 0;

            // Try fetching question data
            return self._getQuestionData(a.uri).then(function (qn) {
                // Worked, so add it to the answerQueue and move on
                answerQueue.push(a);
                return qn;
            })['catch'](function (err) {
                // Can't get question data, try again 10 more times.
                if (attempts > 10) {
                    throw err;
                }
                return assignNewQuestion((attempts || 0) + 1);
            });
        }).then(function (qn) {
            a.uri = qn.uri; // The fetch question data might be slightly different
            a.question_type = qn._type;
            if (qn._type !== 'template') {
                // Generate ordering, field value -> internal value
                a.ordering = a.ordering || shuffle((qn.shuffle || []).slice(0));
                while (a.ordering.length < qn.choices.length) {
                     // Pad out ordering with missing items on end
                    //NB: Assuming that you can't have fixed items anywhere else for now.
                    a.ordering.push(a.ordering.length);
                }
            }
            a.quiz_time = a.quiz_time || curTime();
            a.synced = false;
            a.remaining_time = a.allotted_time;
            if (a.allotted_time && a.quiz_time) {
                a.remaining_time -= curTime() - a.quiz_time;
            }
            self.ls.setItem(self.tutorialUri, self.curTutorial);

            if (onSuccess) {
                onSuccess(qn, a);
            }
            return {qn: qn, a: a};
        })['catch'](promiseFatalError);
    };

    /** Returns a promise with the question data, either from localstorage or HTTP */
    this._getQuestionData = function (uri, cachedOkay) {
        var qn, promise, self = this;

        if (cachedOkay && self._lastFetched && self._lastFetched.uri === uri) {
            // Pull out of in-memory cache
            promise = Promise.resolve(self._lastFetched.question);
        } else {
            qn = self.ls.getItem(uri);
            if (qn) {
                // Fetch out of localStorage
                promise = Promise.resolve(qn);
            } else {
                // Fetch via. HTTP
                promise = self.ajaxApi.getJson(uri);
            }
        }

        // Store question for next time around
        // NB: This is here to ensure that answers get the same question data
        // as questions
        return promise.then(function (qn) {
            if (!qn.uri) {
                qn.uri = uri;
            }
            self._lastFetched = { "uri": qn.uri, "question": qn };
            return qn;
        });
    };

    /** User has selected an answer */
    this.setQuestionAnswer = function (formData, onSuccess) {
        // Fetch question off answer queue, add answer
        var self = this,
            curLecture = self.getCurrentLecture(),
            a = arrayLast(self.curAnswerQueue());
        a.answer_time = curTime();
        a.form_data = formData;
        a.synced = false;

        // Get question data and mark
        return self._getQuestionData(a.uri, true).then(function (qn) {
            var answerData = !qn.hasOwnProperty('answer') ? {}
                           : typeof qn.answer === 'string' ? JSON.parse(window.atob(qn.answer))
                           : qn.answer;

            // Generate array showing which answers were correct
            if (a.hasOwnProperty('ordering')) {
                a.ordering_correct = a.ordering.map(function (v) {
                    return answerData.correct.indexOf(v) > -1;
                });
            }

            if (a.question_type === 'template') {
                a.student_answer = { "choices": [] };
                a.form_data.map(function (val) {
                    var parts, k = val.name, v = val.value;
                    if (k === 'text') {
                        a.student_answer.text = v;
                    } else if (k === 'explanation') {
                        a.student_answer.explanation = v;
                    } else if (k.match(/^choice_\d+/)) {
                        parts = k.split('_');
                        if (a.student_answer.choices[parts[1]] === undefined) {
                            a.student_answer.choices[parts[1]] = { answer: "", correct: false };
                        }
                        if (parts.length === 2) {
                            a.student_answer.choices[parts[1]].answer = v;
                        } else if (parts[2] === "correct" && v) {
                            a.student_answer.choices[parts[1]].correct = true;
                        }
                    } else {
                        throw new Error('Unknown form element ' + k);
                    }
                });
                // If there's no question, then assume that it's skipped
                if (!a.student_answer.text) {
                    a.student_answer = null;
                }
                // When re-working a question, don't get graded. Otherwise correct iff they didn't skip
                a.correct = qn.student_answer ? null : a.student_answer !== null;
            } else if (qn._type === 'usergenerated') {
                a.question_id = qn.question_id;

                // Map question rating into student answer, if available
                a.student_answer = {};
                a.form_data.map(function (d) {
                    if (d.name === 'rating') {
                        a.student_answer.rating = parseInt(d.value, 10);
                    } else if (d.name === 'comments') {
                        a.student_answer.comments = d.value;
                    } else if (d.name === 'answer') {
                        a.selected_answer = d.value;
                        a.student_answer.choice = typeof (a.ordering[d.value]) === "number" ? a.ordering[d.value] : null;
                        //NB: We don't set correct, to weasel out of being graded
                    }
                });

                if (!a.student_answer.hasOwnProperty('comments')) {
                    // Not rated yet, so clear answer_time to stop it being synced
                    delete a.answer_time;
                }
            } else {
                // Find student answer in the form_data
                a.selected_answer = null;
                a.student_answer = null;
                a.form_data.map(function (d) {
                    if (d.name === 'answer') {
                        a.selected_answer = d.value;
                        a.student_answer = typeof (a.ordering[d.value]) === "number" ? a.ordering[d.value] : null;
                    }
                });

                // Student correct iff their answer is in list
                a.correct = answerData.correct.indexOf(a.student_answer) > -1;

                // If student is struggling, make sure they spend time
                // either answering or reading explanation
                a.explanation_delay = iaalib.questionStudyTime(curLecture.settings, self.curAnswerQueue());
                a.explanation_delay = Math.max(a.explanation_delay - curTime() + a.quiz_time, 0);

                // Update question with new counts
                curLecture.questions.map(function (qn) {
                    if (a.uri === qn.uri) {
                        qn.chosen += 1;
                        qn.correct += a.correct ? 1 : 0;
                    }
                });
            }

            // Set appropriate grade
            iaalib.gradeAllocation(curLecture.settings, self.curAnswerQueue(), curLecture);
            a.lec_answered = (a.lec_answered || 0) + 1;
            a.lec_correct = (a.lec_correct || 0) + (a.correct ? 1 : 0);
            a.practice_answered = (a.practice_answered || 0) + (a.practice ? 1 : 0);
            a.practice_correct = (a.practice_correct || 0) + (a.practice && a.correct ? 1 : 0);

            self.ls.setItem(self.tutorialUri, self.curTutorial);
            if (onSuccess) {
                onSuccess(a, answerData);
            }
            return {a: a, answerData: answerData};
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
                if (tutorial && tutorial.lectures) {
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

    // Return how much of the answer queue should be synced and replaced
    function syncingLength(aq) {
        var l = aq.length;
        while (l > 0 && !aq[l - 1].answer_time) {
            l -= 1;
        }
        return l;
    }

    /** Insert tutorial directly into localStorage */
    this.insertTutorial = function (tutUri, tutTitle, lectures) {
        var self = this,
            syncingLengths = {},
            curTutorial = self.ls.getItem(tutUri);

        // Make dict of all syncing lengths
        if (curTutorial) {
            curTutorial.lectures.map(function (l) {
                syncingLengths[l.uri] = syncingLength(l.answerQueue);
            });
        }

        return this.updateTutorial({
            "uri": tutUri,
            "title": tutTitle,
            "lectures": lectures,
        }, syncingLengths);
    };

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

    /** Update tutorial with new contents */
    this.updateTutorial = function (newTutorial, syncingLengths) {
        var self = this, i, twIndex,
            tutUri = newTutorial.uri,
            lectures = newTutorial.lectures,
            oldLectures = {};
        self.curTutorial = self.ls.getItem(tutUri);
        self.tutorialUri = tutUri;

        if (self.ls.getItem(tutUri)) {
            // Sort old lectures into a dict by URI
            for (i = 0; i < self.curTutorial.lectures.length; i++) {
                oldLectures[self.curTutorial.lectures[i].uri] = self.curTutorial.lectures[i];
            }
            // Tutorial already exists, update each lecture
            self.curTutorial.title = newTutorial.title;
            self.curTutorial.lectures = [];
            for (i = 0; i < lectures.length; i++) {
                if (oldLectures[lectures[i].uri]) {
                    self.curTutorial.lectures.push(oldLectures[lectures[i].uri]);
                    self.lecIndex = i;
                    self.updateLecture(lectures[i], syncingLengths[lectures[i].uri] || 0);
                } else {
                    self.curTutorial.lectures.push(lectures[i]);
                }
            }
        } else {
            // Add whole tutorial to localStorage
            self.curTutorial = { "title": newTutorial.title, "lectures": lectures };
        }
        self.ls.setItem(self.tutorialUri, self.curTutorial);

        // Update index with link to document
        twIndex = self.ls.getItem('_index') || {};
        twIndex[tutUri] = 1;
        self.ls.setItem('_index', twIndex);
        return true;
    };

    /** Return array of AJAX promises for fetching & syncing tutUri */
    this.syncAllTutorials = function (force) {
        var self = this,
            twIndex = self.ls.getItem('_index');

        if (!twIndex) {
            // There aren't any tutorials, so nothing to do
            return [];
        }

        return Object.keys(twIndex).map(function (t) {
            return self.syncTutorial(t, force);
        });
    };

    /** Return AJAX promise for fetching & syncing tutUri */
    this.syncTutorial = function (tutUri, force) {
        var self = this,
            syncingLengths = {},
            curTutorial = self.ls.getItem(tutUri || self.tutorialUri);

        if (!force && curTutorial.lectures.filter(isSynced).length === curTutorial.lectures.length) {
            // Nothing to do, stop.
            return Promise.resolve();
        }

        // Make dict of all syncing lengths
        if (curTutorial) {
            curTutorial.lectures.map(function (l) {
                syncingLengths[l.uri] = syncingLength(l.answerQueue);
            });
        }

        return self.ajaxApi.postJson(tutUri, curTutorial, {timeout: 60 * 60 * 1000}).then(function (newTutorial) {
            self.updateTutorial(newTutorial, syncingLengths);
        });
    };

    /** Meld new lecture together with current */
    this.updateLecture = function (newLecture, syncingLength) {
        var self = this,
            curLecture = self.getCurrentLecture();

        // Check it's for the same user
        if (curLecture.user !== newLecture.user) {
            throw ("tutorweb::error::You are trying to download a lecture as '" +
                newLecture.user + "', but you were logged in previously as '" +
                curLecture.user + "'. Return to the menu and log out first.");
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
            updateCounts(curLecture.answerQueue.slice(syncingLength), arrayLast(newLecture.answerQueue))
        );

        // Remove local copy of dead questions
        (function (oldQns, newQns) {
            var newUris = {};

            // Make a dict listing all new questions
            newQns.map(function (qn) {
                newUris[qn.uri] = 1;
            });

            // If an old question isn't part of the new list, bin it.
            oldQns.map(function (qn) {
                if (newUris[qn.uri] === undefined) {
                    self.ls.removeItem(qn.uri);
                }
            });
        }(curLecture.questions, newLecture.questions));

        // Update local copy of lecture
        curLecture.title = newLecture.title;
        curLecture.settings = newLecture.settings;
        curLecture.questions = newLecture.questions;
        curLecture.slide_uri = newLecture.slide_uri;
        curLecture.review_uri = newLecture.review_uri;
        self.ls.setItem(self.tutorialUri, self.curTutorial);
        return true;
    };

    /** Return promise that lecture is synced, with array of promises for questions to sync */
    this.syncLecture = function (selLecture, force) {
        var self = this,
            syncingLengths = {},
            curLecture = self.getCurrentLecture();
        if (selLecture !== null) {
            throw "selLecture has to be null, for now";
        }

        if (!force && isSynced(curLecture)) {
            // Nothing to do, stop.
            return Promise.resolve();
        }

        // Make dict of all syncing lengths
        syncingLengths[curLecture.uri] = syncingLength(curLecture.answerQueue);

        return self.ajaxApi.postJson(curLecture.uri, curLecture).then(function (newLecture) {
            self.updateLecture(newLecture, syncingLengths[curLecture.uri]);
            // Return promises to sync all questions
            return self.syncQuestions();
        });
    };

    /** Generate array of promises that will result in a complete set of questions for tutorial */
    this.syncTutorialQuestions = function (tutUri) {
        var self = this,
            curTutorial = self.ls.getItem(tutUri || self.tutorialUri);
        function noop() { return; }

        return curTutorial.lectures.map(function (l) {
            // Get promises for each lecture
            self.setCurrentLecture({ "tutUri": tutUri, "lecUri": l.uri }, noop);  //TODO: Erg
            return self.syncQuestions();
        }).reduce(function (prev, next) {
            // Squash array-of-arrays
            return prev.concat(next);
        });
    };

    /** Generate array of promises that will result in a complete set of questions for lecture */
    this.syncQuestions = function () {
        var self = this,
            missingQns = [],
            curLecture = self.getCurrentLecture();

        // Which questions are stale?
        missingQns = curLecture.questions.filter(function (qn) {
            //TODO: Should be checking question age too
            return (!qn.online_only &&
                (self.ls.getItem(qn.uri) === null));
        });

        if (missingQns.length >= Math.min(10, curLecture.questions.length)) {
            // Most questions are missing, so just fetch everything
            return [ajaxApi.getJson(curLecture.question_uri, {timeout: 60 * 1000}).then(function (data) {
                self.insertQuestions(data);
            })];
        }
        // Otherwise, fetch everything in list of missing questions
        return missingQns.map(function (qn) {
            return ajaxApi.getJson(qn.uri).then(function (data) {
                var qns = {};
                qns[qn.uri] = data;
                self.insertQuestions(qns);
            });
        });
    };

    /** Return a promise call that gets the slides */
    this.fetchSlides = function () {
        var self = this,
            curLecture = self.getCurrentLecture();

        if (!curLecture.slide_uri) {
            throw "tutorweb::error::No slides available!";
        }
        return self.ajaxApi.getHtml(curLecture.slide_uri);
    };

    /** Return a promise call that gets the review */
    this.fetchReview = function () {
        var self = this,
            curLecture = self.getCurrentLecture();

        if (!curLecture.review_uri) {
            throw "tutorweb::error::No review available!";
        }
        return self.ajaxApi.getJson(curLecture.review_uri);
    };

    /** Output a selection of summary strings on the given / current lecture */
    this.gradeSummary = function (lecture) {
        var i, a, currentGrade, out = {};

        if (!lecture) {
            lecture = this.getCurrentLecture();
        }
        a = arrayLast(lecture.answerQueue) || {};

        if (a.practice) {
            out.practice = "Practice mode";
            if (a.hasOwnProperty('practice_answered') && a.hasOwnProperty('practice_correct')) {
                out.practiceStats = "Answered " + a.practice_answered + " practice questions, " + a.practice_correct + " correctly.";
            }
        }

        if (a.hasOwnProperty('lec_answered') && a.hasOwnProperty('lec_correct')) {
            out.stats = "Answered " + (a.lec_answered - (a.practice_answered || 0)) + " questions, "
                      + (a.lec_correct - (a.practice_correct || 0)) + " correctly.";
        }

        if (a.hasOwnProperty('grade_after') || a.hasOwnProperty('grade_before')) {
            currentGrade = a.hasOwnProperty('grade_after') ? a.grade_after : a.grade_before;
            out.grade = "Your grade: " + currentGrade;
        }

        if (currentGrade >= 9.750) {
            out.encouragement = "You have aced this lecture!";
        } else if (a.grade_next_right && (a.grade_next_right > currentGrade)) {
            out.encouragement = "If you get the next question right: " + a.grade_next_right;
        } else if (lecture.settings.award_lecture_aced && lecture.settings.award_tutorial_aced) {
            out.encouragement = "Win " + Math.round(lecture.settings.award_lecture_aced / 1000) + " SMLY if you ace this lecture, bonus "
                                       + Math.round(lecture.settings.award_tutorial_aced / 1000) + " SMLY for acing whole tutorial";
        }

        out.lastEight = [];
        for (i = lecture.answerQueue.length - 1; i >= 0 && out.lastEight.length < 8; i--) {
            if (lecture.answerQueue[i].answer_time && !lecture.answerQueue[i].practice) {
                out.lastEight.push(lecture.answerQueue[i]);
            }
        }

        return out;
    };

    /** Return a promise, returning the current account balance **/
    this.updateAward = function (portalRootUrl, walletId) {
        var self = this;
        return self.ajaxApi.postJson(
            portalRootUrl + '@@quizdb-student-award',
            { "walletId": walletId }
        );
    };

    /** Return promise, returning (updated) student details */
    this.updateUserDetails = function (portalRootUrl, userDetails) {
        return this.ajaxApi.postJson(
            portalRootUrl + '@@quizdb-student-updatedetails',
            userDetails
        );
    };
};
