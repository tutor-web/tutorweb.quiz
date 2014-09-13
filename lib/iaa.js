/*jslint nomen: true, plusplus: true, browser:true*/
/* global module */
module.exports = function IAA() {
    "use strict";

    /**
      * Pick a new question from the current lecture by generating a new
      * answerQueue entry
      *
      * answerQueue represents the questions assigned to a user and their answers.
      * When a student requests a new question, this will be called to generate
      * the next answerQueue member. Once they choose an answer, it will be
      * annotated with the answer they chose.
      *
      * cutTutorial - The data structure for the current tutorial
      * lecIndex - The index of the lecture the student is currently taking
      * answerQueue - Previous student answers, most recent last
      * practiceMode - True if student has engaged practice mode
      */
    this.newAllocation = function (curTutorial, lecIndex, answerQueue, practiceMode) {
        var questions, oldGrade, qn,
            settings = curTutorial.lectures[lecIndex].settings || {"hist_sel": curTutorial.lectures[lecIndex].hist_sel};
        if (Math.random() < parseFloat(settings.hist_sel || 0)) {
            questions = curTutorial.lectures[Math.floor(Math.random() * (lecIndex + 1))].questions;
        } else {
            questions = curTutorial.lectures[lecIndex].questions;
        }
        if (!questions || !questions.length) {
            return null;
        }

        if (answerQueue.length === 0) {
            oldGrade = 0;
        } else {
            oldGrade = answerQueue[answerQueue.length - 1].grade_after || 0;
        }

        qn = this.chooseQuestion(this.questionDistribution(
            questions.filter(function (qn) { return qn._type !== 'template'; }),
            oldGrade,
            answerQueue,
            questions.filter(function (qn) { return qn._type === 'template'; }),
            practiceMode ? 0 : getSetting(settings, "prob_template", 0.1) // No template questions in practice mode
        ));
        return {
            "uri": qn.uri,
            "allotted_time": qn._type === 'template' ? null : this.qnTimeout(settings, oldGrade),
            "grade_before": oldGrade,
            "practice": practiceMode
        };
    };

    /**
      * Grade the student's work, add it to the last item in the queue.
      * answerQueue: Previous student answers, most recent last
      */
    this.gradeAllocation = function (settings, answerQueue) {
        var self = this, aq, last;

        // Apply weighting to answerQueue
        function grade(aq) {
            var i, weighting, total = 0;

            weighting = self.gradeWeighting(
                aq.length,
                getSetting(settings, 'grade_alpha', 0.125),
                getSetting(settings, 'grade_s', 2),
                getSetting(settings, 'grade_nmin', 8),
                getSetting(settings, 'grade_nmax', 30));

            for (i = 0; i < weighting.length; i++) {
                if (aq[aq.length - i - 1]) {
                    total += weighting[i] * (aq[aq.length - i - 1].correct ? 1 : -0.5);
                }
            }

            // Return grade 0..10, rounded to nearest .25
            return Math.max(Math.round(total * 40) / 4, 0);
        }

        // Only grade if all questions have been answered
        if (answerQueue.length === 0) return;

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
        var t,
            weightings = [],
            total = 0,
            nm = Math.min(nmax || 30, Math.max(n, nmin || 8));

        // Generate scaled curve from 1..(nm-1)
        for (t = 1; t <= nm; t++) {
            weightings.push(Math.pow(1 - (t / nm), s));
            total += weightings[t - 1];
        }

        // Scale to 1
        weightings = weightings.map(function (w) {
            return w / total;
        });

        // If initial value is less than alpha, prepend alpha & rescale
        if (weightings[0] < alpha) {
            // NB: In theory should reweight after this, but it's 0
            weightings.pop();
            weightings = weightings.map(function (w) {
                return w * (1 - alpha);
            });
            weightings.unshift(alpha);
        }

        return weightings;
    };

    /** Given user's current grade, return how long they should have to do the next question in seconds */
    this.qnTimeout = function(settings, grade) {
        var tMax = getSetting(settings, 'timeout_max', 10) * 60, // Parameter in mins, tMax in secs
            tMin = getSetting(settings, 'timeout_min', 3) * 60, // Parameter in mins, tMin in secs
            gStar = getSetting(settings, 'timeout_grade', 5),
            s = getSetting(settings, 'timeout_std', 2);

        return tMax - Math.floor(
            (tMax - tMin) * Math.exp(-Math.pow(grade - gStar, 2) / (2 * Math.pow(s, 2))));
    };

    /** If str is in settings hash and parsable as a float, return that.
      * Otherwise, return defValue
      */
    function getSetting(settings, str, defValue) {
        if (isNaN(parseFloat(settings[str]))) {
            return defValue;
        }
        return parseFloat(settings[str]);
    }

    /** Choose a random question from qnDistribution, based on the probability
      * within.
      *
      * Returns that question
      */
    this.chooseQuestion = function (qnDistribution) {
        // Choose an item from qnDistribution once the cumulative probability
        // is greater than target
        var i = -1, total = 0, target = Math.random();
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
    this.questionDistribution = function(questions, grade, answerQueue, extras, extras_prob) {
        var i, difficulty,
            questionBias = {},
            total = 0;

        // difficulty: Array of { qn: question, difficulty: 0..1 }, sorted by difficulty
        difficulty = questions.map(function (qn) {
            // Significant numer of answers, so place normally
            if(qn.chosen > 5) return {"qn": qn, "difficulty": 1.0- (qn.correct/qn.chosen)};

            // Mark new questions as easy / hard, so they are likely to get them regardless.
            if(grade < 1.5) return {"qn": qn, "difficulty": (((qn.chosen-qn.correct)/2.0) + Math.random())/100.0};
            return {"qn": qn, "difficulty": 1.0 -(((qn.chosen-qn.correct)/2.0) + Math.random())/100.0};
        });
        difficulty = difficulty.sort(function (a, b) { return a.difficulty - b.difficulty; });

        // Bias questions based on previous answers (NB: Most recent answers will overwrite older)
        for (i = Math.max(answerQueue.length - 21, 0); i < answerQueue.length; i++) {
            if (!answerQueue[i].hasOwnProperty('correct')) continue;

            // If question incorrect, probablity increases with time. Correct questions less likely
            questionBias[answerQueue[i].uri] = answerQueue[i].correct ? 0.5 :
                                               Math.pow(1.05, answerQueue.length - i - 3);
        }

        // Generate a PDF based on grade, map questions to it ordered by difficulty
        ia_pdf(difficulty.length, grade, difficulty.length / 10.0).map(function (prob, i) {
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
        function ia_pdf(index, grade, q)
        {
            var i;
            grade = grade / 10;                //einkannir frá 0:1
            var x = [];
            for(var h = 0; h< index; h++)
                x[h] = (h+1)/(index+1.0);
            var alpha = q*grade;
            var beta = q - alpha;
            var y = [];
            for(i=0; i<x.length;i++)
                y[i]=1-x[i];
            arrayPower(x, alpha);                        //pdf=(x^alpha)*(1-x)^beta
            arrayPower(y, beta);
            var pdf = arrayMultiply(x, y);
            var sum = 0.0;                        //sum er summan úr öllum stökum í pdf
            for(var j=0; j<x.length; j++)
                sum += pdf[j];
            arrayDividescalar(pdf, sum);
            return pdf;
        }
        
        function arrayMultiply(arrayx, arrayy)
        {
            var arrayz = [];
            for(var i = 0; i<arrayx.length; i++)
                arrayz[i] = arrayx[i] * arrayy[i];
            return arrayz;
        }
        
        function arrayPower(array, power)
        {
            for(var i = 0; i< array.length; i++)
                array[i] = Math.pow(array[i], power);
            return array;
        }
        
        function arrayDividescalar(array, scalar)
        {
            for(var i = 0; i<array.length; i++)
                array[i] = array[i]/scalar;
            return array;
        }
    };
};
