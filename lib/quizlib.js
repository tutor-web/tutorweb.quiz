/*jslint nomen: true, plusplus: true, browser:true, todo:true, regexp: true */
/*global require, module, Promise, Set */
var iaalib = new (require('./iaa.js'))();
require('es6-promise').polyfill();
var shuffle = require('knuth-shuffle').knuthShuffle;
var JSONLocalStorage = require('./jsonls');
var getSetting = require('./settings.js').getSetting;

/**
  * Main quiz object
  *  rawLocalStorage: Browser local storage object
  */
module.exports = function Quiz(rawLocalStorage, ajaxApi) {
    "use strict";
    this.lecUri = null;
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

    // Turn subscription structure into flat list of URIs
    function lectureUrisFromSubscription(s) {
        if (s.uri) {
            return [s.uri];
        }
        if (s.children) {
            // Flatten array-of-arrays to an array
            return [].concat.apply([], s.children.map(lectureUrisFromSubscription));
        }
        return [];
    }

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

    // Return number of practice questions student would be allowed to do, 0..Infinity
    function practiceAllowed(curLec) {
        var aq = curLec.answerQueue,
            settings = curLec.settings,
            answers_real = aq.filter(function (a) { return a && !a.practice; }).length,
            rv;

        // Work out number of questions we're allowed to do
        rv = getSetting(settings, 'practice_after', 0);
        if (rv === 0) {
            return Infinity; // Always allowed to practice
        }
        rv = Math.floor(answers_real / rv);
        if (!isFinite(rv) || rv === 0) {
            // x/0, i.e. at start and there's a non-zero limit
            // or not enough questions answered yet
            return 0;
        }
        rv = rv * getSetting(settings, 'practice_batch', Infinity);

        // Subtract practice questions already done
        return Math.max(rv - (aq.length - answers_real), 0);
    }

    /** Return promise to deep array of lectures and their URIs */
    this.getAvailableLectures = function () {
        var self = this;

        return Promise.resolve().then(function () {
            return Promise.all([
                self._getSubscriptions(false),
                ajaxApi.listCached(),
            ]);
        }).then(function (args) {
            // Get all mentioned lectures, get info about them
            var lectureInfo = {}, lsItems = {}, subscriptions = args[0], cache_uris = args[1];

            // Form a list of all things in localstorage
            self.ls.listItems().map(function (k) {
                lsItems[k] = true;
            });

            // Does this lecture have everything it needs to be offline?
            function isOffline(l) {
                var i;

                for (i = 0; i < l.questions.length; i++) {
                    if (l.questions[i].online_only) {
                        return false;
                    }
                }

                return cache_uris.has(l.question_uri);
            }

            return Promise.all(lectureUrisFromSubscription(subscriptions).map(function (uri) {
                return self._getLecture(uri, true).then(function (l) {
                    var gradeSummary;

                    // If lecture isn't dummy structure, add stats to object
                    // (lecture might be missing if out of localstorge during sync, e.g.)
                    if (l.questions) {
                        gradeSummary = self._gradeSummary(l);
                        lectureInfo[uri] = {
                            "grade": (gradeSummary.stats || '') + (gradeSummary.grade ? '\n' + gradeSummary.grade : ''),
                            "synced": isSynced(l),
                            "offline": isOffline(l),
                        };
                    }
                });
            })).then(function () {
                return {
                    subscriptions: subscriptions,
                    lectures: lectureInfo,
                };
            });
        });
    };

    /** Get the subscriptions table */
    this._getSubscriptions = function (missingOkay) {
        var self = this,
            subs = self.ls.getItem('_subscriptions');

        if (subs) {
            return Promise.resolve(subs);
        }

        if (missingOkay) {
            subs = {children: []};
            self.ls.setItem('_subscriptions', subs);
            return Promise.resolve(subs);
        }

        return Promise.reject(new Error("No subscriptions table"));
    };

    /** Promise to get the given lecture URI, or the current one */
    this._getLecture = function (lecUri, missingOkay) {
        var self = this;

        return Promise.resolve(lecUri || this.lecUri).then(function (lecUri) {
            var lec;

            if (!lecUri) {
                throw new Error("No lecture selected");
            }

            lec = self.ls.getItem(lecUri);
            if (!lec) {
                if (!missingOkay) {
                    if (!self.ls.getItem('_subscriptions')) {
                        throw new Error("Subscriptions not yet downloaded");
                    }
                    throw new Error("Unknown lecture: " + lecUri);
                }
                lec = {};
            }
            if (!lec.answerQueue) {
                lec.answerQueue = [];
            }
            if (!lec.uri) {
                lec.uri = lecUri;
            }
            return lec;
        });
    };

    /** Form a promise-chain that fetches the lecture at the start and sets it at the end */
    this._withLecture = function (lecUri, work, missingOkay) {
        var self = this, lec;

        return self._getLecture(lecUri, missingOkay).then(function (lecture) {
            lec = lecture;  // Store it in our function scope
            return Promise.resolve(lecture);
        }).then(work).then(function (rv) {
            var uri = lec.uri;

            delete lec.uri;
            self.ls.setItem(uri, lec);
            return rv;
        });
    };

    /** Set the current lecture */
    this.setCurrentLecture = function (params) {
        var self = this;

        if (!params || !params.lecUri) {
            throw new Error("lecUri parameter required");
        }
        this.lecUri = params.lecUri;

        return self._getLecture().then(function (lecture) {
            var lastAns = arrayLast(lecture.answerQueue);
            self.lecUri = lecture.uri;
            iaalib.gradeAllocation(lecture.settings, lecture.answerQueue, lecture);

            return {
                a: lastAns,
                continuing: (lastAns && !lastAns.answer_time ? lastAns.practice ? 'practice' : 'real' : false),
                lecUri: lecture.uri,
                lecTitle: lecture.title,
                practiceAllowed: practiceAllowed(lecture),
            };
        });
    };

    /** True iff a lecture is selected on the current page */
    this.isLectureSelected = function () {
        return !!this.lecUri;
    };

    /** Choose a new question from the current lecture */
    this.getNewQuestion = function (opts) {
        var self = this;

        // Try (attempts) times to call fn, expecting a promise
        function tryRepeatedly(fn, attempts) {
            return fn()['catch'](function (err) {
                if (attempts > 0) {
                    return tryRepeatedly(fn, attempts - 1);
                }
                throw err;
            });
        }

        return self._withLecture(null, function (curLecture) {
            // Repeatedly try assigning a new question, until one works
            return tryRepeatedly(function () {
                var a, lastAns = arrayLast(curLecture.answerQueue);

                if (lastAns && !lastAns.answer_time) {
                    // Last question wasn't answered, carry on answering
                    a = lastAns;
                    return self._getQuestionData(curLecture, a.uri).then(function (qn) {
                        // NB: Not storing allocation in answerqueue again
                        return {qn: qn, a: a};
                    });
                }

                if (opts.practice && !practiceAllowed(curLecture)) {
                    throw new Error('No practice questions left');
                }

                // Fetch a new question
                a = iaalib.newAllocation(curLecture, opts || {});
                a.lec_answered = lastAns && lastAns.lec_answered ? lastAns.lec_answered : 0;
                a.lec_correct = lastAns && lastAns.lec_correct ? lastAns.lec_correct : 0;
                a.practice_answered = lastAns && lastAns.practice_answered ? lastAns.practice_answered : 0;
                a.practice_correct = lastAns && lastAns.practice_correct ? lastAns.practice_correct : 0;
                return self._getQuestionData(curLecture, a.uri).then(function (qn) {
                    // Store new allocation in answerQueue
                    curLecture.answerQueue.push(a);
                    return {qn: qn, a: a};
                });
            }, 10).then(function (args) {
                var qn = args.qn, a = args.a;

                a.uri = qn.uri; // The fetch question data might be slightly different
                a.question_type = qn._type; // NB: The alloc has allocType as _type, question type is different.

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

                return {qn: qn, a: a};
            });
        });
    };

    /** Returns a promise with the question data, either from localstorage or HTTP */
    this._getQuestionData = function (curLecture, uri, cachedOkay) {
        var p, self = this;

        if (!self._lastFetched) {
            self._lastFetched = {};
        }

        if (cachedOkay && uri && self._lastFetched.uri === uri) {
            // Pull question of in-memory cache
            // NB: Not just for efficiency, ensures answer compares same UG question
            return Promise.resolve(self._lastFetched.question);
        }

        // Get all-question data, keep in memory
        if (self._lastFetched && self._lastFetched.question_uri === curLecture.question_uri) {
            p = Promise.resolve(self._lastFetched.all_questions);
        } else {
            p = ajaxApi.getCachedJson(curLecture.question_uri, { timeout: 60 * 1000 }).then(function (data) {
                self._lastFetched.question_uri = curLecture.question_uri;
                self._lastFetched.all_questions = data;
                return data;
            });
        }

        if (uri === undefined) {
            // Pre-warming question cache, don't need to do anything more
            return p;
        }

        // Fetch question data
        return p.then(function (all_qns) {
            if (all_qns[uri]) {
                // Question in all-questions cache
                if (!all_qns[uri].uri) {
                    all_qns[uri].uri = uri;
                }
                return all_qns[uri];
            }
            return self.ajaxApi.getJson(uri).then(function (qn) {
                // Stash question for using later
                // NB: Not just for efficiency, ensures answer compares same UG question
                if (!qn.uri) {
                    qn.uri = uri;
                }
                self._lastFetched.uri = qn.uri;
                self._lastFetched.question = qn;
                return qn;
            });
        });
    };

    /** User has selected an answer */
    this.setQuestionAnswer = function (formData) {
        var self = this;

        return self._withLecture(null, function (curLecture) {
            var a = arrayLast(curLecture.answerQueue);

            // Fetch question off answer queue, add answer
            a.answer_time = curTime();
            a.form_data = formData;
            a.synced = false;

            // Get question data and mark
            return self._getQuestionData(curLecture, a.uri, true).then(function (qn) {
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
                    a.correct = qn.student_answer && qn.student_answer.text ? null : a.student_answer !== null;
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

                    // Update question with new counts
                    curLecture.questions.map(function (qn) {
                        if (a.uri === qn.uri) {
                            qn.chosen += 1;
                            qn.correct += a.correct ? 1 : 0;
                        }
                    });
                }

                // Check how long a student should have spent on this question, delay the explanation by the difference
                a.explanation_delay = iaalib.questionStudyTime(curLecture.settings, curLecture.answerQueue);
                if (a.explanation_delay > 0) {
                    a.explanation_delay = Math.max(a.explanation_delay - curTime() + a.quiz_time, 0);
                }

                // Set appropriate grade
                iaalib.gradeAllocation(curLecture.settings, curLecture.answerQueue, curLecture);
                a.lec_answered = (a.lec_answered || 0) + 1;
                a.lec_correct = (a.lec_correct || 0) + (a.correct ? 1 : 0);
                a.practice_answered = (a.practice_answered || 0) + (a.practice ? 1 : 0);
                a.practice_correct = (a.practice_correct || 0) + (a.practice && a.correct ? 1 : 0);

                return {
                    a: a,
                    answerData: answerData,
                    practiceAllowed: practiceAllowed(curLecture),
                    // If we've aced and theres a next lecture to go to, add URL
                    nextLecture: (a.grade_after >= 9.750 && curLecture.next_uri) ? curLecture.next_uri : null,
                };
            });
        });
    };

    /** Go through subscriptions, remove any lectures that don't have an owner */
    this.removeUnusedObjects = function () {
        var self = this,
            cacheContent = new Set(),
            lsContent = {};

        // Form object of everything in localStorage
        self.ls.listItems().map(function (k) {
            lsContent[k] = 0;
        });

        return Promise.resolve().then(function () {
            return self._getSubscriptions(false);
        }).then(function (subscriptions) {
            lsContent._subscriptions++;

            // Extract lecture URIs
            return Promise.all(lectureUrisFromSubscription(subscriptions).map(function (uri) {
                lsContent[uri]++;

                // Fetch questions also and up their count
                return self._getLecture(uri, true).then(function (l) {
                    // All-questions should be in ajaxApi cache
                    cacheContent.add(l.question_uri);

                    // Remove questions (tidy up for backward compatibility)
                    (l.questions || []).map(function (q) {
                        lsContent[q.uri]++;
                    });
                });
            }));
        }).then(function () {
            // Remove anything from the AjaxAPI cache
            return ajaxApi.removeUnusedCache(cacheContent);
        }).then(function () {
            var k, removedItems = [];

            // Remove anything where the refcount is still 0
            for (k in lsContent) {
                if (lsContent.hasOwnProperty(k) && lsContent[k] === 0) {
                    removedItems.push(k);
                    self.ls.removeItem(k);
                }
            }
            return removedItems;
        });
    };

    /** Insert tutorial directly into localStorage, for testing */
    this.insertTutorial = function (tutId, tutTitle, lectures, questions) {
        var self = this;

        return this._getSubscriptions(true).then(function (subscriptions) {
            lectures.map(function (l) {
                if (!l.title) {
                    l.title = "Lecture " + l.uri;
                }
                self.ls.setItem(l.uri, l);

                // Put all-questions into what should be fake Ajax request
                self.ajaxApi.injectCache(l.question_uri, questions);
            });

            subscriptions.children.push({
                id: tutId,
                title: tutTitle,
                children: lectures.map(function (l) { return { uri: l.uri, title: l.title }; }),
            });

            self.ls.setItem('_subscriptions', subscriptions);

        });
    };

    // 3 queues, before-sync, current, and fresh-from-server
    function _queueMerge(preQ, currentQ, serverQ) {
        var totals = {};

        // Update a running total property
        function runningTotal(a, prop, extra) {
            if (totals.hasOwnProperty(prop)) {
                totals[prop] = totals[prop] + extra;
            } else {
                // First entry, so believe the entry if available
                totals[prop] = a[prop] || extra;
            }
            return totals[prop];
        }

        function syncingLength(aq) {
            var l = aq.length;
            while (l > 0 && !aq[l - 1].answer_time) {
                l -= 1;
            }
            return l;
        }

        // Queue: server-returned Q + unanswered questions from preQ
        return [].concat(serverQ, currentQ.splice(syncingLength(preQ))).map(function (a) {
            // Update running totals
            a.lec_answered = runningTotal(a, 'lec_answered', a.answer_time ? 1 : 0);
            a.lec_correct  = runningTotal(a, 'lec_correct',  a.correct ? 1 : 0);
            a.practice_answered = runningTotal(a, 'practice_answered', a.practice && a.answer_time ? 1 : 0);
            a.practice_correct  = runningTotal(a, 'practice_correct',  a.practice && a.correct ? 1 : 0);
            return a;
        });
    }

    /**
      * Sync the subscription table and everything within.
      * opts can contain:
      * - syncForce: true ==> Sync lectures regardless of whether they seem to need it
      * - skipCleanup: true ==> Skip localstorage garbage collection
      * - lectureAdd: lecture URI to subscribe to
      * - lectureDel: lecture URI to remove subscription for
      * progressFn is a function called when something happens, with arguments
      * - opTotal: Number of operations
      * - opSucceeded: ...out of which this many have finished
      * - message: Message describing current state
     */
    this.syncSubscriptions = function (opts, progressFn) {
        var self = this,
            postData = {};

        // Apply promise-returning fn to values in batches of batchSize
        function batchPromise(values, batchSize, fn) {
            var p = Promise.resolve();

            function batchFn(batch) {
                return function () {
                    return Promise.all(batch.map(fn));
                };
            }

            while (values.length > 0) {
                p = p.then(batchFn(values.splice(0, batchSize)));
            }
            return p;
        }

        if (opts.lectureAdd) {
            postData.add_lec = opts.lectureAdd;
        }

        if (opts.lectureDel) {
            postData.del_lec = opts.lectureDel;
        }

        progressFn(3, 0, "Syncing subscriptions...");
        return self.ajaxApi.postJson('/@@quizdb-subscriptions', postData).then(function (subscriptions) {
            self.ls.setItem('_subscriptions', subscriptions);
            if (!opts.skipCleanup && opts.lectureDel) {
                // Removing something, so tidy up now in case quota is full
                return self.removeUnusedObjects().then(function () {
                    return subscriptions;
                });
            }
            return subscriptions;
        }).then(function (subscriptions) {
            var lectureUris = lectureUrisFromSubscription(subscriptions),
                opSucceeded = 0,
                opTotal = lectureUris.length + 1;

            return batchPromise(lectureUris, 6, function (uri) {
                return self.syncLecture(uri, {
                    ifMissing: 'fetch',
                    syncForce: opts.syncForce,
                    skipQuestions: false,
                    skipCleanup: true,
                }, function (lecSucceeded, lecTotal, message) {
                    if (lecSucceeded === lecTotal) {
                        opSucceeded = opSucceeded + 1;
                    }
                    progressFn(opTotal, opSucceeded, uri + ": " + message);
                });
            }).then(function () {
                progressFn(opTotal - 1, opTotal, "Tidying up...");
                return opts.skipCleanup ? null : self.removeUnusedObjects();
            }).then(function () {
                progressFn(opTotal, opTotal, "Done");
            });
        });
    };

    /** Return promise that lecture is synced */
    this.syncLecture = function (lecUri, opts, progressFn) {
        var self = this,
            opTotal = 2 + (opts.skipQuestions ? 0 : 1);

        if (!progressFn) {
            progressFn = function () { return; };
        }
        if (!opts || opts === true) {
            opts = { syncForce: !!opts };
        }

        return self._getLecture(lecUri, opts.ifMissing === 'fetch').then(function (preSyncLecture) {
            if (!opts.syncForce && preSyncLecture.hasOwnProperty('questions') && isSynced(preSyncLecture)) {
                // Nothing to do
                return;
            }
            progressFn(0, opTotal, "Fetching lecture...");

            return self.ajaxApi.postJson(preSyncLecture.uri, preSyncLecture, { timeout: 60 * 1000 }).then(function (newLecture) {
                // Check it's for the same user
                if (preSyncLecture.user && preSyncLecture.user !== newLecture.user) {
                    throw new Error("tutorweb::error::You are trying to download a lecture as '" +
                        newLecture.user + "', but you were logged in previously as '" +
                        preSyncLecture.user + "'. Return to the menu and log out first.");
                }

                // Write out replacement lecture
                return self._withLecture(lecUri, function (curLecture) {
                    // Copy contents of newLec over curLec, since otherwise _withLecture won't update
                    Object.keys(newLecture).map(function (k) {
                        curLecture[k] = k === 'answerQueue'
                            ? _queueMerge(preSyncLecture.answerQueue, curLecture.answerQueue, newLecture.answerQueue)
                            : newLecture[k];
                    });
                    return newLecture;
                }, opts.ifMissing === 'fetch');
            }).then(function (curLecture) {
                if (opts.skipQuestions) {
                    return;
                }

                // Trigger the lecture data to be cached
                progressFn(1, opTotal, "Fetching questions...");
                return self._getQuestionData(curLecture);
            }).then(function () {
                progressFn(opTotal - 1, opTotal, "Tidying up...");
                return opts.skipCleanup ? null : self.removeUnusedObjects();
            }).then(function () {
                progressFn(opTotal, opTotal, "Done");
            });
        });
    };

    /** Return a promise call that gets the slides */
    this.fetchSlides = function (lecUri) {
        var self = this;

        return self._getLecture(lecUri).then(function (curLecture) {
            if (!curLecture.slide_uri) {
                throw "tutorweb::error::No slides available!";
            }
            return self.ajaxApi.getHtml(curLecture.slide_uri);
        });
    };

    /** Return a promise call that gets the review */
    this.fetchReview = function (lecUri) {
        var self = this;

        return self._getLecture(lecUri).then(function (curLecture) {
            if (!curLecture.review_uri) {
                throw "tutorweb::error::No review available!";
            }
            return self.ajaxApi.getHtml(curLecture.review_uri);
        });
    };

    /** Output a selection of summary strings on the given / current lecture */
    this._gradeSummary = function (lecture) {
        var i, a, currentGrade, out = {};

        if (!lecture) {
            throw new Error("No lecture Given");
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

    /** Promise-wrapped version to get lecture first */
    this.lectureGradeSummary = function (lecUri) {
        var self = this;

        return self._getLecture(lecUri).then(function (curLecture) {
            return self._gradeSummary(curLecture);
        });
    };

    /** Return a promise, returning the current account balance **/
    this.updateAward = function (portalRootUrl, walletId, captchaResponse) {
        var self = this;

        if (walletId && walletId !== '$$DONATE:EIAS' && !captchaResponse) {
            // No reCAPTCHA response, so just do a view
            walletId = null;
        }

        return self.ajaxApi.postJson(
            portalRootUrl + '@@quizdb-student-award',
            { "walletId": walletId, "captchaResponse": captchaResponse }
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
