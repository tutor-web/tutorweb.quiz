/*jslint nomen: true, plusplus: true, browser:true, todo: true, unparam: true*/
/*global module */
var getSetting = require('./settings.js').getSetting;

module.exports = function IAA() {
    "use strict";

    // Return last member of array, or default
    function arrayLast(a, def) {
        return 0 < a.length ? a[a.length - 1] : def;
    }

    /**
      * Pick a new question from the current lecture by generating a new
      * answerQueue entry
      *
      * answerQueue represents the questions assigned to a user and their answers.
      * When a student requests a new question, this will be called to generate
      * the next answerQueue member. Once they choose an answer, it will be
      * annotated with the answer they chose.
      *
      * curLec - The data structure for the current lecture
      * opts: Object containing:-
      *   * practice: True iff student has engaged practice mode
      *   * question_uri: Force user to take this question
      */
    this.newAllocation = function (curLec, opts) {
        var alloc,
            questions = curLec.questions || [],
            settings = curLec.settings || {},
            answerQueue = curLec.answerQueue || [],
            oldGrade = arrayLast(answerQueue, {}).grade_after || 0;

        // Find a question in a question bank
        function findQn(questions, uri) {
            var i, baseUri = uri.split("?")[0];
            for (i = 0; i < questions.length; i++) {
                if (questions[i].uri === baseUri) {
                    return questions[i];
                }
            }
            throw new Error("Cannot find question " + uri);
        }

        if (questions.length === 0) {
            throw new Error("tutorweb::noquestions::Lecture has no questions");
        }

        if (opts.question_uri) {
            alloc = findQn(questions, opts.question_uri);
        } else if (Math.random() < getSetting(settings, 'hist_sel', 0) && questions.find(function (qn) { return qn._type === 'historical'; })) {
            // Choose one of the historical questions, but completely randomly
            alloc = this.iaaAdaptive(questions, answerQueue, settings, opts, 'historical');
        } else if (getSetting(settings, 'iaa_type', 'adaptive') === 'exam') {
            alloc = this.iaaExam(questions, answerQueue, settings, opts);
        } else if (getSetting(settings, 'iaa_type', 'adaptive') === 'adaptive') {
            alloc = this.iaaAdaptive(questions, answerQueue, settings, opts);
        } else {
            throw new Error("Unknown IAA " + getSetting(settings, 'iaa_type', 'adaptive'));
        }

        if (!alloc) {
            throw new Error("tutorweb::noquestions::No suitable questions in lecture (" + curLec.uri + ")");
        }
        return {
            "uri": opts.question_uri || alloc.uri,
            "allotted_time": alloc._type === 'template' ? null : this.qnTimeout(settings, oldGrade),
            "grade_before": oldGrade,
            "practice": !!opts.practice,
        };
    };

    this.iaaExam = function (questions, answerQueue, settings, opts) {
        if (opts.practice) {
            throw new Error("Practice during an exam is not allowed");
        }

        if (answerQueue.length >= questions.length) {
            throw new Error("tutorweb::noquestions::You have answered all questions. Press 'Back to main menu' to choose another lecture");
        }

        return questions[answerQueue.length];
    };

    this.iaaAdaptive = function (questions, answerQueue, settings, opts, wanted_type) {
        var oldGrade = arrayLast(answerQueue, {}).grade_after || 0;

        return this.chooseQuestion(this.questionDistribution(
            questions.filter(function (qn) { return wanted_type ? qn._type === wanted_type : (!qn._type || qn._type === 'regular'); }),
            oldGrade,
            answerQueue,
            questions.filter(function (qn) { return qn._type === 'template'; }),
            opts.practice ? 0 // No template questions in practice mode
                          : oldGrade < getSetting(settings, "mingrade_template", 5) ? 0 // No template questions when you have a grade less than 5
                          : getSetting(settings, "prob_template", 0.1),
            settings
        ));
    };

    /**
      * Grade the student's work, add it to the last item in the queue.
      * answerQueue: Previous student answers, most recent last
      */
    this.gradeAllocation = function (settings, answerQueue, lecture) {
        var self = this, aq, last, algorithms = {}, grade;

        function round(val, factor) {
            return Math.max(Math.round(val * factor * 10) / factor, 0);
        }

        // Apply weighting to answerQueue
        algorithms.weighted = function (aq) {
            var i, weighting, total = 0;

            weighting = self.gradeWeighting(
                aq.length,
                getSetting(settings, 'grade_alpha', 0.125),
                getSetting(settings, 'grade_s', 2),
                getSetting(settings, 'grade_nmin', 8),
                getSetting(settings, 'grade_nmax', 30)
            );

            for (i = 0; i < weighting.length; i++) {
                if (aq[aq.length - i - 1]) {
                    total += weighting[i] * (aq[aq.length - i - 1].correct ? 1 : -0.5);
                }
            }

            // Return grade 0..10, rounded to nearest .25
            return round(total, 4);
        };

        // (# correct) / (# questions)
        algorithms.ratiocorrect = function (aq) {
            var i, qns_correct = 0;

            for (i = 0; i < aq.length; i++) {
                qns_correct += aq[i].correct ? 1 : 0;
            }

            // Return grade 0..10, rounded to 2 d.p
            return round(qns_correct / lecture.questions.length, 100);
        };

        // Choose algorithm
        grade = algorithms[getSetting(settings, 'grade_algorithm', 'weighted')];

        // Only grade if all questions have been answered
        if (answerQueue.length === 0) {
            return;
        }

        // Filter practice / unanswered / ungraded questions
        aq = answerQueue.filter(function (a) {
            return a && !a.practice && a.hasOwnProperty('correct') && a.correct !== null;
        });

        // Annotate the last question with your grade at this point
        last = answerQueue[answerQueue.length - 1];
        last.grade_next_right = grade(aq.concat({"correct" : true}));
        if (last.answer_time) {
            last.grade_after = grade(aq);
        } else {
            last.grade_before = grade(aq);
        }
    };

    /**
      * Generate weighting for (answers)
      *     n: Number of answers available
      *     alpha: Randomly assigned [0.15,0.30]
      *     s: Constant determining curve [1,4]
      *     nmin: If n < nmin, then generate weighting for nmin answers
      *     nmax: If n > nmax, then generate weighting for nmax answers
      *
      * Returns array of weightings according to:
      *     nmax<-min(max(n,8),nm)
      *     t<-1:nmax
      *     w<-(1-t/nmax)^s/sum((1-t/nmax)^s)
      *     if(w[1]<alpha) w<-c(alpha,(1-alpha)*w[1:(nmax-1)])
      */
    this.gradeWeighting = function (n, alpha, s, nmin, nmax) {
        var t, remainder,
            weightings = [],
            total = 0,
            nm = Math.round(Math.min(nmax || 30, Math.max(n, nmin || 8)));

        // Generate scaled curve from 1..(nm-1)
        for (t = 1; t <= nm; t++) {
            if (s === 0) {
                weightings.push(t < nm ? 1 : 0);
            } else {
                weightings.push(Math.pow(1 - (t / nm), s));
            }
            total += weightings[t - 1];
        }

        // Scale to 1
        weightings = weightings.map(function (w) {
            return w / total;
        });

        // If initial value is less than alpha, prepend alpha & rescale
        if (weightings[0] < alpha) {
            // NB: In theory should reweight after this, but it's 0
            remainder = weightings.pop();
            if (remainder > 0.0001) {
                throw new Error("Last item in weightings " + remainder + ", not 0");
            }
            weightings = weightings.map(function (w) {
                return w * (1 - alpha);
            });
            weightings.unshift(alpha);
        }

        return weightings;
    };

    /** Given user's current grade, return how long they should have to do the next question in seconds */
    this.qnTimeout = function (settings, grade) {
        var tMax = getSetting(settings, 'timeout_max', 10) * 60, // Parameter in mins, tMax in secs
            tMin = getSetting(settings, 'timeout_min', 3) * 60, // Parameter in mins, tMin in secs
            gStar = getSetting(settings, 'timeout_grade', 5),
            s = getSetting(settings, 'timeout_std', 2);

        return tMax - Math.floor(
            (tMax - tMin) * Math.exp(-Math.pow(grade - gStar, 2) / (2 * Math.pow(s, 2)))
        );
    };

    /** How long should have the student spent studying this question? */
    this.questionStudyTime = function (settings, aq) {
        function incorrectInARow(aq) {
            var i;
            for (i = aq.length; i > 0; i--) {
                if (aq[i - 1].correct !== false) {  // NB: correct can be true/false/null
                    return aq.length - i;
                }
            }
            return aq.length;
        }

        return Math.min(
            getSetting(settings, 'studytime_factor', 2) * incorrectInARow(aq) +
                getSetting(settings, 'studytime_answeredfactor', 0) * (arrayLast(aq, {}).lec_answered || 0),
            getSetting(settings, 'studytime_max', 20)
        );
    };

    /** Choose a random question from qnDistribution, based on the probability
      * within.
      *
      * Returns that question
      */
    this.chooseQuestion = function (qnDistribution) {
        // Choose an item from qnDistribution once the cumulative probability
        // is greater than target
        var i = -1, total = 0, target = Math.random();

        if (qnDistribution.length === 0) {
            return null;  // NB: Trigger "No suitable questions" later
        }

        while (total < target && i < qnDistribution.length - 1) {
            i++;
            total += qnDistribution[i].probability;
        }
        return qnDistribution[i].qn;
    };

    /** Return a PDF likelyhood of a question being chosen, given:-
      * questions: An array of objects, containing:-
      *     chosen: Number of times question has been answered
      *     correct: Of those times, how many a student gave a correct answer
      * answerQueue: Array of answers, newest first.
      * grade: Student's current grade, as calculated by gradeAllocation()
      *
      * Returns an array of questions, probability and difficulty.
      */
    this.questionDistribution = function (questions, grade, answerQueue, extras, extras_prob, settings) {
        var i, difficulty,
            questionBias = {},
            gpow = getSetting(settings || {}, 'iaa_adaptive_gpow', 1),
            total = 0;

        //Use: pdf = ia_pdf(index, grade, q)
        //Before: index and grade are integers and 0<q<1
        //index specifies how many questions there are in the current exersize
        //grade is the users current grade (currently on the scale of -0.5 - 1
        //After: pdf is an array with the probability density distribution of the current 
        //exersize
        //Noktun pdf = ia_pdf(index , grade, q)
        //Fyrir: index og grade eru heiltölur, index
        //er hversu margar spurningar eru í heildina fyrir þann glærupakka, q er
        //tölfræði stuðull
        //0<q<1 grade er einkun fyrir þann glærupakka
        //Eftir: pdf er fylki með þettleika dreifingar fyrir hverja spurningu
        function ia_pdf(index, grade, q, gpow) {
            function arrayMultiply(arrayx, arrayy) {
                var ind, arrayz = [];
                for (ind = 0; ind < arrayx.length; ind++) {
                    arrayz[ind] = arrayx[ind] * arrayy[ind];
                }
                return arrayz;
            }

            function arrayPower(array, power) {
                var ind;
                for (ind = 0; ind < array.length; ind++) {
                    array[ind] = Math.pow(array[ind], power);
                }
                return array;
            }

            function arrayDividescalar(array, scalar) {
                var ind;
                for (ind = 0; ind < array.length; ind++) {
                    array[ind] = array[ind] / scalar;
                }
                return array;
            }

            var ind, h, x, alpha, beta, y, pdf, sum, j;
            grade = grade / 10;                //einkannir frá 0:1
            x = [];
            for (h = 0; h < index; h++) {
                x[h] = (h + 1) / (index + 1.0);
            }
            alpha = q * Math.pow(grade, gpow);
            beta = q - alpha;
            y = [];
            for (ind = 0; ind < x.length; ind++) {
                y[ind] = 1 - x[ind];
            }
            arrayPower(x, alpha);                        //pdf=(x^alpha)*(1-x)^beta
            arrayPower(y, beta);
            pdf = arrayMultiply(x, y);
            sum = 0.0;                        //sum er summan úr öllum stökum í pdf
            for (j = 0; j < x.length; j++) {
                sum += pdf[j];
            }
            arrayDividescalar(pdf, sum);
            return pdf;
        }

        // difficulty: Array of { qn: question, difficulty: 0..1 }, sorted by difficulty
        difficulty = questions.map(function (qn) {
            // Significant numer of answers, so place normally
            if (qn.chosen > 5) {
                return {"qn": qn, "difficulty": 1.0 - (qn.correct / qn.chosen)};
            }

            // Mark new questions as easy / hard, so they are likely to get them regardless.
            if (grade < 1.5) {
                return {"qn": qn, "difficulty": (((qn.chosen - qn.correct) / 2.0) + Math.random()) / 100.0};
            }
            return {"qn": qn, "difficulty": 1.0 - (((qn.chosen - qn.correct) / 2.0) + Math.random()) / 100.0};
        });
        difficulty = difficulty.sort(function (a, b) { return a.difficulty - b.difficulty; });

        // Bias questions based on previous answers (NB: Most recent answers will overwrite older)
        for (i = Math.max(answerQueue.length - 21, 0); i < answerQueue.length; i++) {
            if (answerQueue[i].hasOwnProperty('correct')) {
                // If question incorrect, probablity increases with time. Correct questions less likely
                questionBias[answerQueue[i].uri] = answerQueue[i].correct ? 0.5 :
                                                   Math.pow(1.05, answerQueue.length - i - 3);
            }
        }

        // Generate a PDF based on grade, map questions to it ordered by difficulty
        ia_pdf(difficulty.length, grade, difficulty.length / 10.0, gpow).map(function (prob, i) {
            // As we go, apply question bias and generate a total so we can rescale to 1.
            difficulty[i].questionBias = (questionBias[difficulty[i].qn.uri] || 1);
            total += difficulty[i].probability = prob * difficulty[i].questionBias;
        });

        // If there are extras to insert, do this now
        if (extras && extras.length > 0 && extras_prob > 0) {
            // Scale probability to fit
            total = total / (1.0 - extras_prob);

            // Put end on end, dividing probability equally
            [].push.apply(difficulty, extras.map(function (qn) {
                return { "qn": qn, "probability": extras_prob / extras.length * total };
            }));
        }

        // Re-order based on probability, rescale to 1
        difficulty = difficulty.sort(function (a, b) { return a.probability - b.probability; });
        difficulty.map(function (d) {
            d.probability = d.probability / total;
        });

        return difficulty;
    };
};
