(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*jslint nomen: true, plusplus: true, browser:true*/
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
        var questions, oldGrade,
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

        return {
            "uri": this.chooseQuestion(this.questionDistribution(questions, oldGrade, answerQueue)).uri,
            "allotted_time": this.qnTimeout(settings, oldGrade),
            "grade_before": oldGrade,
            "lec_answered" : Array.last(answerQueue) === null ? 0 : (Array.last(answerQueue).lec_answered || 0),
            "lec_correct" : Array.last(answerQueue) === null ? 0 : (Array.last(answerQueue).lec_correct || 0),
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
            var a, i, weighting, total = 0;

            weighting = self.gradeWeighting(
                aq.length,
                getSetting(settings, 'grade_alpha', 0.3),
                getSetting(settings, 'grade_s', 2));

            for (i = 0; i < weighting.length; i++) {
                a = aq[aq.length - i - 1];
                if (a && a.hasOwnProperty('correct')) {
                    total += weighting[i] * (a.correct ? 1 : -0.5);
                }
            }

            // Return grade 0..10, rounded to nearest .25
            return Math.max(Math.round(total * 40) / 4, 0);
        }

        // Only grade if all questions have been answered
        if (answerQueue.length === 0) return;
        last = answerQueue[answerQueue.length - 1];

        // Filter unanswered / practice questions
        aq = answerQueue.filter(function (a) {
            return a && !a.practice && a.hasOwnProperty('correct');
        });
        last.grade_next_right = grade(aq.concat({"correct" : true}));
        if (last.hasOwnProperty('correct')) {
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
      *
      * Returns array of weightings according to:
      *     mmax=min(30, max(n, 8))
      *     w(1)=alpha
      *     w(2:nmax)=(1-alpha)*(1-(t-1)/(nmax+1))^s/(sum((1-(t-1)/(nmax+1))^s))
      *       ... but if w(2)>alpha use:
      *     w(1:nmax) = (1-t/(nmax+1))^s/(sum((1-t/(nmax+1))^s))
      */
    this.gradeWeighting = function (n, alpha, s) {
        var i, t,
            weightings = [],
            total = 0,
            nmax = Math.min(30, Math.max(n, 8)) + 1; //NB: One greater than formulae

        // Generate curve from 1..nmax
        for (t = 1; t < nmax; t++) {
            weightings.push(Math.pow(1 - t/nmax, s));
            total += weightings[weightings.length - 1];
        }

        if ((alpha / (1 - alpha)) < (weightings[0] / total)) {
            // Scale to make the weightings sum to 1
            for (i = 0; i < weightings.length; i++) {
                weightings[i] = weightings[i] / total;
            }
        } else {
            // Add alpha to beginning
            total -= weightings.pop();
            weightings.unshift(alpha);

            // Scale rest of weightings, keeping alpha as-is
            total = total / (1 - alpha);
            for (i = 1; i < weightings.length; i++) {
                weightings[i] = weightings[i] / total;
            }
        }
        return weightings;
    };

    /** Given user's current grade, return how long they should have to do the next question in seconds(?) */
    this.qnTimeout = function(settings, grade) {

        var tMax, tMin, gradeaverage, tStd, time;
        // Max time
        tMax = getSetting(settings, 'timeout_max', 10);
        //placeholder : tMin will be randomized (with 2 being the most common) and saved to My SQL
        tMin = getSetting(settings, 'timeout_min', 3);
        // g* : will likely be five but might change
        gradeaverage = getSetting(settings, 'timeout_grade', 5);
        //will be 2s^2 where s = sqrt(2)
        tStd = getSetting(settings, 'timeout_std', 2 * Math.sqrt(2));

        time = tMax * (1-(1-(tMin / tMax)) * Math.exp(-(Math.pow((grade-gradeaverage),2))/tStd));
        time = Math.floor(time * 60);
        return time;
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
    this.questionDistribution = function(questions, grade, answerQueue) {
        var i, difficulty, chosen,
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

},{}],2:[function(require,module,exports){
/*jslint nomen: true, plusplus: true, browser:true*/
/*global jQuery*/
var Quiz = require('./quizlib.js');

(function (window, $) {
    "use strict";
    var quiz, qs, handleError, updateState,
        jqQuiz = $('#tw-quiz'),
        jqBar = $('#load-bar');
    // Do nothing if not on the right page
    if ($('body.quiz-load').length === 0) { return; }

    /** Call an array of Ajax calls, splicing in extra options, onProgress called on each success, onDone at end */
    function callAjax(calls, extra, onProgress, onDone) {
        var dfds = calls.map(function (a) {
            return $.ajax($.extend({}, a, extra));
        });
        if (dfds.length === 0) {
            onDone();
        } else {
            dfds.map(function (d) { d.done(onProgress); });
            $.when.apply(null, dfds).done(onDone);
        }
    }

    updateState = function (curState, message, encoding) {
        var self = this, jqAlert;
        // Add message to page if we need to
        if (message) {
            jqAlert = $('<div class="alert">').addClass(curState === 'error' ? ' alert-error' : 'alert-info');
            if (encoding === 'html') {
                jqAlert.html(message);
            } else {
                jqAlert.text(message);
            }
            jqQuiz.children('div.alert').remove();
            jqQuiz.prepend(jqAlert);
        }

        if (curState === 'ready') {
            $('#tw-proceed').addClass("ready");
        }
    };

    function updateProgress(cur, max) {
        if (max === 0) {
            jqBar.css({"width": '0%'});
        } else if (cur < max) {
            jqBar.css({"width": (cur / max) * 100 + '%'});
        } else {
            jqBar.css({"width": '100%'});
        }
    }

    handleError = function (message, textStatus, errorThrown) {
        if (arguments.length === 3) {
            // var jqXHR = message
            updateState('error', errorThrown + " (whilst requesting " + this.url + ")");
        } else {
            // Just a string
            updateState('error', message);
        }
    };

    // Catch any uncaught exceptions
    window.onerror = function (message, url, linenumber) {
        updateState("error", "Internal error: " +
                             message +
                             " (" + url + ":" + linenumber + ")");
    };

    // Wire up quiz object
    quiz = new Quiz(localStorage, function (message, encoding) {
        updateState('error', message, encoding);
    });

    /** Download a tutorial given by URL */
    function downloadTutorial(url) {
        $.ajax({
            type: "GET",
            cache: false,
            url: url,
            error: handleError,
            success: function (data) {
                var i, ajaxCalls, count = 0;
                function noop() { }

                if (!quiz.insertTutorial(data.uri, data.title, data.lectures)) {
                    // Write failed, give up
                    return;
                }

                // Housekeep, remove all useless questions
                updateState("active", "Removing old questions...");
                quiz.removeUnusedObjects();

                // Get all the calls required to have a full set of questions
                updateState("active", "Downloading questions...");
                ajaxCalls = [];
                for (i = 0; i < data.lectures.length; i++) {
                    quiz.setCurrentLecture({ "tutUri": url, "lecUri": data.lectures[i].uri }, noop);  //TODO: Erg
                    //NB: Merge quiz.syncQuestions()'s array with ajaxCalls
                    Array.prototype.push.apply(ajaxCalls, quiz.syncQuestions());
                }

                // Do the calls, updating our progress bar
                callAjax(ajaxCalls, {error: handleError}, function () {
                    //TODO: Are we genuinely capturing full localStorage?
                    count += 1;
                    updateProgress(count, ajaxCalls.length);
                }, function () {
                    if (count < ajaxCalls.length) { return; }
                    updateProgress(1, 1);
                    updateState("ready", "Press the button to start your quiz");
                });
            },
        });
        updateState("active", "Downloading lectures...");
    }

    qs = quiz.parseQS(window.location);
    if (!qs.tutUri || !qs.lecUri) {
        handleError("Missing tutorial or lecture URI!");
        return;
    }
    if (qs.clear) {
        // Empty localStorage first
        window.localStorage.clear();
    }
    $('#tw-proceed').attr('href', quiz.quizUrl(qs.tutUri, qs.lecUri));
    downloadTutorial(qs.tutUri);
}(window, jQuery));

},{"./quizlib.js":4}],3:[function(require,module,exports){
/*jslint nomen: true, plusplus: true, browser:true*/
/*global jQuery, MathJax*/
var Quiz = require('./quizlib.js');

/**
  * View class to translate data into DOM structures
  *    $: jQuery
  *    jqQuiz: jQuery-wrapped <form id="tw-quiz">
  *    jqProceed: jQuery wrapped proceed button
  */
function QuizView($, jqQuiz, jqTimer, jqProceed, jqFinish, jqDebugMessage) {
    "use strict";
    this.jqQuiz = jqQuiz;
    this.jqTimer = jqTimer;
    this.jqProceed = jqProceed;
    this.jqFinish = jqFinish;
    this.jqDebugMessage = jqDebugMessage;
    this.jqGrade = $('#tw-grade');
    this.jqPractice = $('#tw-practice');
    this.timerTime = null;

    /** Start the timer counting down from startTime seconds */
    this.timerStart = function (startTime) {
        var self = this;
        function formatTime(t) {
            var out = "";
            function plural(i, base) {
                return i + " " + base + (i !== 1 ? 's' : '');
            }

            if (t > 60) {
                out = plural(Math.floor(t / 60), 'min') + ' ';
                t = t % 60;
            }
            out += plural(t, 'sec');
            return out;
        }

        if (startTime) {
            self.timerTime = startTime;
        } else {
            if (this.timerTime === null) {
                // Something called timerStop, so stop.
                return;
            }
            self.timerTime = self.timerTime - 1;
        }

        if (self.timerTime > 0) {
            self.jqTimer.text(formatTime(self.timerTime));
            window.setTimeout(self.timerStart.bind(self), 1000);
        } else {
            // Wasn't asked to stop, so it's a genuine timeout
            self.jqTimer.text("Out of time");
            self.jqProceed.trigger('click', 'timeout');
        }
    };

    /** Stop the timer at it's current value */
    this.timerStop = function () {
        var self = this;
        self.timerTime = null;
    };

    /** Update the debug message with current URI and an extra string */
    this.updateDebugMessage = function (lecUri, qn) {
        var self = this;
        if (lecUri) { self.jqDebugMessage[0].lecUri = lecUri; }
        self.jqDebugMessage.text(self.jqDebugMessage[0].lecUri + "\n" + qn);
    };

    /** Switch quiz state, optionally showing message */
    this.updateState = function (curState, message, encoding) {
        var self = this, jqAlert;

        // Add message to page if we need to
        if (message) {
            jqAlert = $('<div class="alert">').addClass(curState === 'error' ? ' alert-error' : 'alert-info');
            if (encoding === 'html') {
                jqAlert.html(message);
            } else {
                jqAlert.text(message);
            }
            jqQuiz.children('div.alert').remove();
            jqQuiz.prepend(jqAlert);
        }

        $(document).data('tw-state', curState);

        // Set button to match state
        self.jqProceed.removeAttr("disabled");
        self.jqPractice.removeAttr("disabled");
        self.jqFinish.removeAttr("disabled");
        if (curState === 'nextqn') {
            self.jqProceed.html("New question >>>");
        } else if (curState === 'interrogate') {
            self.jqProceed.html("Submit answer >>>");
            self.jqPractice.attr("disabled", true);
            self.jqFinish.attr("disabled", true);
        } else if (curState === 'processing') {
            self.jqProceed.attr("disabled", true);
        } else {
            self.jqProceed.html("Restart quiz >>>");
        }
    };

    /** Update sync button, curState one of 'processing', 'online', 'offline', 'unauth', '' */
    this.syncState = function (curState) {
        var jqSync = $('#tw-sync');

        if (!curState) {
            // Want to know what the state is
            return jqSync[0].className === 'btn active' ? 'processing'
                    : jqSync[0].className === 'btn btn-danger btn-unauth' ? 'unauth'
                    : jqSync[0].className === 'btn btn-success' ? 'online'
                         : 'unknown';
        }

        // Setting the state
        if (curState === 'processing') {
            jqSync[0].className = 'btn active';
            jqSync.text("Syncing...");
        } else if (curState === 'online') {
            jqSync[0].className = 'btn btn-success';
            jqSync.text("Scores saved.");
        } else if (curState === 'offline') {
            jqSync[0].className = 'btn btn-info';
            jqSync.text("Currently offline. Sync once online");
        } else if (curState === 'unauth') {
            jqSync[0].className = 'btn btn-danger btn-unauth';
            jqSync.text("Click here to login, so your scores can be saved");
        } else if (curState === 'error') {
            jqSync[0].className = 'btn btn-danger';
            jqSync.text("Syncing failed!");
        } else {
            jqSync[0].className = 'btn';
            jqSync.text("Sync answers");
        }
        return curState;
    };

    this.renderMath = function (onSuccess) {
        var jqQuiz = this.jqQuiz;
        jqQuiz.addClass("mathjax-busy");
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, this.jqQuiz[0]]);
        MathJax.Hub.Queue(function () {
            jqQuiz.removeClass("mathjax-busy");
        });
        if (onSuccess) {
            MathJax.Hub.Queue(onSuccess);
        }
    };

    /** Render next question */
    this.renderNewQuestion = function (qn, a, gradeString) {
        var self = this, i, html = '';
        self.updateDebugMessage(null, a.uri.replace(/.*\//, ''));
        //TODO: Do some proper DOM manipluation?
        if (qn.text) { html += '<p>' + qn.text + '</p>'; }
        html += '<ol type="a">';
        for (i = 0; i < a.ordering.length; i++) {
            html += '<li id="answer_' + i + '">';
            html += '<label class="radio">';
            html += '<input type="radio" name="answer" value="' + i + '"/>';
            html += qn.choices[a.ordering[i]];
            html += '</label></li>';
        }
        html += '</ol>';
        self.jqQuiz.html(html);
        self.jqGrade.text(gradeString);
        self.renderMath(function () {
            if (a.allotted_time && a.quiz_time) {
                // Already started, dock seconds since started
                self.timerStart(a.allotted_time - (Math.round((new Date()).getTime() / 1000) - a.quiz_time));
            } else if (a.allotted_time) {
                self.timerStart(a.allotted_time);
            }
        });
    };

    /** Annotate with correct / incorrect selections */
    this.renderAnswer = function (a, answerData, gradeString, lastEight) {
        var self = this, i;
        self.jqQuiz.find('input').attr('disabled', 'disabled');
        self.jqQuiz.find('#answer_' + a.selected_answer).addClass('selected');
        // Mark all answers as correct / incorrect
        for (i = 0; i < a.ordering_correct.length; i++) {
            self.jqQuiz.find('#answer_' + i).addClass(a.ordering_correct[i] ? 'correct' : 'incorrect');
        }
        self.jqQuiz.removeClass('correct');
        self.jqQuiz.removeClass('incorrect');
        self.jqQuiz.addClass(a.correct ? 'correct' : 'incorrect');
        if (answerData.explanation) {
            self.jqQuiz.append($('<div class="alert explanation">' + answerData.explanation + '</div>'));
            self.renderMath();
        }
        self.jqGrade.text(gradeString);
        this.renderPrevAnswers(lastEight);
    };

    /** Render previous answers in a list below */
    this.renderPrevAnswers = function (lastEight) {
        var self = this,
            jqList = $("#tw-previous-answers").find('ol');
        jqList.empty();
        jqList.append(lastEight.map(function (a) {
            var t = new Date(0);
            t.setUTCSeconds(a.answer_time);

            return $('<li/>')
                .addClass(a.correct ? 'correct' : 'incorrect')
                .attr('title',
                     (a.selected_answer ? 'You chose ' + String.fromCharCode(97 + a.selected_answer) + '\n' : '') +
                      'Answered ' + t.toLocaleDateString() + ' ' + t.toLocaleTimeString())
                .append($('<span/>').text(a.correct ? "✔" : '✗'));
        }));
    };

    this.renderStart = function (tutUri, tutTitle, lecUri, lecTitle, gradeString, lastEight) {
        var self = this;
        $("#tw-title").text(tutTitle + " - " + lecTitle);
        self.jqQuiz.html($("<p>Click 'New question' to start your quiz</p>"));
        self.jqGrade.text(gradeString);
        this.renderPrevAnswers(lastEight);
    };
}

(function (window, $, undefined) {
    "use strict";
    var quiz, quizView;
    // Do nothing if not on the right page
    if ($('body.quiz-quiz').length === 0) { return; }

    /** Call an array of Ajax calls, splicing in extra options, onProgress called on each success, onDone at end */
    function callAjax(calls, extra, onProgress, onDone) {
        var dfds = calls.map(function (a) {
            return $.ajax($.extend({}, a, extra));
        });
        if (dfds.length === 0) {
            onDone();
        } else {
            dfds.map(function (d) { d.done(onProgress); });
            $.when.apply(null, dfds).done(onDone);
        }
    }

    // Catch any uncaught exceptions
    window.onerror = function (message, url, linenumber) {
        quizView.updateState("error", "Internal error: " +
                                      message +
                                      " (" + url + ":" + linenumber + ")");
    };

    // Wire up quiz object
    quizView = new QuizView($, $('#tw-quiz'), $('#tw-timer'), $('#tw-proceed'), $('#tw-finish'), $('#tw-debugmessage'));
    quiz = new Quiz(localStorage, function (message, encoding) {
        quizView.updateState("error", message, encoding);
    });

    // Complain if there's no localstorage
    if (!window.localStorage) {
        quizView.updateState("error", "Sorry, we do not support your browser");
        return false;
    }

    if (window.applicationCache) {
        // Trigger reload if needed
        window.applicationCache.addEventListener('updateready', function (e) {
            if (window.applicationCache.status !== window.applicationCache.UPDATEREADY) {
                return;
            }
            quizView.updateState("reload", 'A new version is avaiable, click "Restart quiz"');
        });
    }

    // Hitting the button moves on to the next state in the state machine
    $('#tw-proceed').bind('click', function (event) {
        event.preventDefault();
        quizView.timerStop();
        if ($(this).hasClass("disabled")) {
            return;
        }
        switch ($(document).data('tw-state')) {
        case 'processing':
            break;
        case 'error':
        case 'reload':
            window.location.reload(false);
            break;
        case 'nextqn':
            // User ready for next question
            quizView.updateState("processing");
            quiz.getNewQuestion($('#tw-practice').hasClass("active"), function () {
                quizView.renderNewQuestion.apply(quizView, arguments);
                quizView.updateState('interrogate');
            });
            break;
        case 'interrogate':
            // Disable all controls and mark answer
            quizView.updateState("processing");
            quiz.setQuestionAnswer(parseInt($('input:radio[name=answer]:checked').val(), 10), function () {
                quizView.renderAnswer.apply(quizView, arguments);
                quizView.updateState('nextqn');
                //TODO: Egh, must be a cleaner way
                quizView.syncState('default');
                $('#tw-sync').trigger('click', 'noforce');
            });
            break;
        default:
            quizView.updateState('error', "Error: Quiz in unkown state");
        }
    });

    $('#tw-practice').bind('click', function (event) {
        var self = this, jqThis = $(this);
        if (jqThis.attr("disabled")) {
            return false;
        }
        if (jqThis.hasClass("active")) {
            jqThis.removeClass("active");
            $('div.status').removeClass("practice");
        } else {
            jqThis.addClass("active");
            $('div.status').addClass("practice");
        }
    });

    $('#tw-finish').bind('click', function (event) {
        if ($(this).attr("disabled")) {
            return false;
        }
    });

    $('#tw-sync').bind('click', function (event, noForce) {
        var syncCall;

        function onError(jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 401 || jqXHR.status === 403) {
                quizView.syncState('unauth');
            } else {
                quizView.syncState('error');
            }
        }

        if (quizView.syncState() === 'processing') {
            // Don't want to repeatedly sync
            return;
        }
        if (quizView.syncState() === 'unauth') {
            window.open(quiz.portalRootUrl(document.location) +
                        '/login?came_from=' +
                        encodeURIComponent(document.location.pathname.replace(/\/\w+\.html$/, '/close.html')),
                       "loginwindow");
            quizView.syncState('default');
            return;
        }
        quizView.syncState('processing');
        if (!window.navigator.onLine) {
            quizView.syncState('offline');
            return;
        }

        // Fetch AJAX call
        syncCall = quiz.syncLecture(!noForce);
        if (syncCall === null) {
            // Sync says there's nothing to do
            quizView.syncState('default');
            return;
        }

        // Sync current lecture and it's questions
        callAjax([syncCall], {error: onError}, null, function () {
            callAjax(quiz.syncQuestions(), {error: onError}, null, function () {
                quizView.syncState('online');
            });
        });
    });
    quizView.syncState('default');

    // Load the lecture referenced in URL, if successful hit the button to get first question.
    quiz.setCurrentLecture(quiz.parseQS(window.location), function (tutUri, tutTitle, lecUri, lecTitle, grade, lastEight) {
        quizView.updateDebugMessage(lecUri, '');
        quizView.renderStart.apply(quizView, arguments);
        quizView.updateState("nextqn");
    });

}(window, jQuery));

},{"./quizlib.js":4}],4:[function(require,module,exports){
/*jslint nomen: true, plusplus: true, browser:true*/
var iaalib = new (require('./iaa.js'))();

/**
  * Main quiz object
  *  rawLocalStorage: Browser local storage object
  *  handleError: Function that displays error message to user
  */
module.exports = function Quiz(rawLocalStorage, handleError) {
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

        this.listItems = function () {
            var i, out = [];
            for (i = 0; i < backing.length; i++) {
                out.push(backing.key(i));
            }
            return out;
        };
    }
    this.ls = new JSONLocalStorage(rawLocalStorage, function (key) {
        handleError('No more local storage available. Please <a href="start.html">return to the menu</a> and delete some tutorials you are no longer using.', 'html');
    });

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

        function lecToObject(l) {
            return {
                "uri": self.quizUrl(k, l.uri),
                "title": l.title,
                "grade": self.gradeString(Array.last(l.answerQueue))
            };
        }
        /* jshint ignore:start */ // https://github.com/jshint/jshint/issues/1016
        for (k in twIndex) {
        /* jshint ignore:end */
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
                iaalib.gradeAllocation(lecture.settings, self.curAnswerQueue());
                return onSuccess(
                    params.tutUri,
                    self.curTutorial.title,
                    params.lecUri,
                    lecture.title,
                    self.gradeString(Array.last(lecture.answerQueue)),
                    self.lastEight()
                );
            }
        }
        self.handleError("Lecture " + params.lecUri + "not part of current tutorial");
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
        var self = this, a, answerQueue = self.curAnswerQueue();

        if (answerQueue.length === 0 || Array.last(answerQueue).answer_time) {
            // Assign new question if last has been answered
            a = iaalib.newAllocation(self.curTutorial, self.lecIndex, answerQueue, practiceMode);
            if (!a) {
                self.handleError("Lecture has no questions!");
                return;
            }
            answerQueue.push(a);
        } else {
            // Get question data to go with last question on queue
            a = Array.last(answerQueue);
        }

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
            if (self.ls.setItem(self.tutorialUri, self.curTutorial)) { onSuccess(qn, a, self.gradeString(a)); }
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
        a.selected_answer = selectedAnswer;
        a.student_answer = a.ordering[selectedAnswer];
        a.synced = false;

        // Mark their work
        self.getQuestionData(a.uri, function (qn) {
            var i,
                curLecture = self.getCurrentLecture(),
                answerData = typeof qn.answer === 'string' ? JSON.parse(window.atob(qn.answer)) : qn.answer;
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

            // Update question with new counts
            for (i = 0; i < curLecture.questions.length; i++) {
                if (a.uri === curLecture.questions[i].uri) {
                    curLecture.questions[i].chosen += 1;
                    curLecture.questions[i].correct += a.correct ? 1 : 0;
                    break;
                }
            }

            if (self.ls.setItem(self.tutorialUri, self.curTutorial)) {
                onSuccess(a, answerData, self.gradeString(a), self.lastEight());
            }
        });
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
                if (!tutorial) { continue; }
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
        curLecture.answerQueue = newLecture.answerQueue.concat(
            updateCounts(curLecture.answerQueue.slice(syncingLength), Array.last(newLecture.answerQueue))
        );

        // Update local copy of lecture
        curLecture.settings = newLecture.settings;
        curLecture.questions = newLecture.questions;
        curLecture.removed_questions = newLecture.removed_questions;
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
        var self = this, i, questionDfds,
            missingQns = [],
            curLecture = self.getCurrentLecture();

        // Remove local copy of dead questions
        if (curLecture.removed_questions) {
            curLecture.removed_questions.map(function (qn) {
                self.ls.removeItem(qn);
            });
        }

        // Which questions are stale?
        for (i = 0; i < curLecture.questions.length; i++) {
            if (self.ls.getItem(curLecture.questions[i].uri) === null) {
                //TODO: Should be checking question age too
                missingQns.push(i);
            }
        }

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
        return missingQns.map(function (i) {
            var qnUri = curLecture.questions[i].uri;
            // New question we don't have yet
            return {
                type: "GET",
                cache: false,
                url: qnUri,
                success: function (data) {
                    var qns = {};
                    qns[qnUri] = data;
                    self.insertQuestions(qns, function () {});
                },
            };
        });
    };

    /** Helper to turn the last item in an answerQueue into a grade string */
    this.gradeString = function (a) {
        if (!a) { return; }
        return "" +
            (a.hasOwnProperty('lec_answered') ? "Answered " + a.lec_answered + " questions, " + a.lec_correct + " correctly. " : "") +
            "\nYour grade: " + (a.hasOwnProperty('grade_after') ? a.grade_after : a.hasOwnProperty('grade_before') ? a.grade_before : 0) +
            (a.hasOwnProperty('grade_next_right') ? ", if you get the next question right:" + a.grade_next_right : "");
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

},{"./iaa.js":1}],5:[function(require,module,exports){
/*jslint nomen: true, plusplus: true, browser:true*/
/*global jQuery*/
var Quiz = require('./quizlib.js');

function StartView($, jqQuiz, jqSelect) {
    "use strict";
    this.jqQuiz = jqQuiz;
    this.jqSelect = jqSelect;

    /** Put an alert div at the top of the page */
    this.renderAlert = function (type, message) {
        var self = this;
        self.jqQuiz.children('div.alert').remove();
        self.jqQuiz.prepend($('<div class="alert">')
            .addClass("alert-" + type)
            .text(message));
    };

    /** Generate expanding list for tutorials / lectures */
    this.renderChooseLecture = function (quiz, items) {
        var self = this;
        self.jqSelect.empty();

        // Error message if there's no items
        if (!items.length) {
            self.renderAlert("info", 'You have no tutorials loaded yet. Please visit tutorweb by clicking "Get more tutorials", and choose a department and tutorial');
            return;
        }

        // [[href, title, items], [href, title, items], ...] => markup
        // items can also be {uri: '', title: ''}
        function listToMarkup(items) {
            var i, jqA, item, jqUl = $('<ul/>');
            if (typeof items === 'undefined') {
                return null;
            }
            for (i = 0; i < items.length; i++) {
                item = items[i];
                jqA = $('<a/>').attr('href', item.uri).text(item.title);
                if (item.grade) {
                    jqA.append($('<span class="grade"/>').text(item.grade));
                }
                jqUl.append($('<li/>')
                        .append(jqA)
                        .append(listToMarkup(item.lectures))
                        );
            }
            return jqUl;
        }

        // Recursively turn tutorials, lectures into a ul, populate existing ul.
        self.jqSelect.append(listToMarkup(items).children());
    };
}

(function (window, $, undefined) {
    "use strict";
    var quiz, view,
        jqQuiz = $('#tw-quiz'),
        jqSelect = $('#tw-select'),
        jqProceed = $('#tw-proceed'),
        jqSync = $('#tw-sync'),
        jqDelete = $('#tw-delete');

    // Do nothing if not on the right page
    if ($('body.quiz-start').length === 0) { return; }

    // Catch any uncaught exceptions
    window.onerror = function (message, url, linenumber) {
        view.renderAlert("error", "Internal error: " +
                                  message +
                                  " (" + url + ":" + linenumber + ")");
    };

    // Wire up quiz object
    view = new StartView($, jqQuiz, jqSelect);
    quiz = new Quiz(localStorage, function (message) {
        view.renderAlert("error", message);
    });

    // Refresh menu, both on startup and after munging quizzes
    function refreshMenu() {
        quiz.getAvailableLectures(function (lectures) {
            view.renderChooseLecture(quiz, lectures);
        });
    }
    refreshMenu();

    // Point to root of current site
    document.getElementById('tw-home').href = quiz.portalRootUrl(document.location);

    // If button is disabled, do nothing
    jqProceed.click(function (e) {
        if ($(this).hasClass("disabled")) {
            e.preventDefault();
            return false;
        }
    });

    // Sync all tutorials
    jqSync.click(function (e) {
        //TODO: Sync tutorials in turn
        e.preventDefault();
        return false;
    });

    // Remove selected tutorial
    jqDelete.click(function (e) {
        var self = this;
        if ($(this).hasClass("disabled")) {
            e.preventDefault();
            return false;
        }
        //TODO: Sync first
        quiz.removeTutorial($(self).data('tutUri'));
        refreshMenu();
        jqProceed.addClass("disabled");
        jqDelete.addClass("disabled");
    });

    // Click on the select box opens / closes items
    jqSelect.click(function (e) {
        var jqTarget = $(e.target);
        e.preventDefault();
        jqSelect.find(".selected").removeClass("selected");
        jqProceed.addClass("disabled");
        jqDelete.addClass("disabled");
        if (jqTarget.parent().parent()[0] === this) {
            // A 1st level tutorial, Just open/close item
            jqTarget.parent().toggleClass("expanded");
            if (jqTarget.parent().hasClass("expanded")) {
                jqDelete.data('tutUri', e.target.href);
                jqDelete.removeClass("disabled");
            }
        } else if (e.target.tagName === 'A' || e.target.tagName === 'SPAN') {
            if (e.target.tagName === 'SPAN') {
                jqTarget = jqTarget.parent('a');
            }
            // A quiz link, select it
            jqTarget.addClass("selected");
            jqProceed.removeClass("disabled");
            jqDelete.removeClass("disabled");
            jqProceed.attr('href', jqTarget.attr('href'));
        }
    });

}(window, jQuery));

},{"./quizlib.js":4}]},{},[1,2,3,4,5])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvc3J2L2RldmVsL3dvcmsvaWNlcy50dXRvcndlYi9zcmMvdHV0b3J3ZWIucXVpei9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL3Nydi9kZXZlbC93b3JrL2ljZXMudHV0b3J3ZWIvc3JjL3R1dG9yd2ViLnF1aXovbGliL2lhYS5qcyIsIi9zcnYvZGV2ZWwvd29yay9pY2VzLnR1dG9yd2ViL3NyYy90dXRvcndlYi5xdWl6L2xpYi9sb2FkLmpzIiwiL3Nydi9kZXZlbC93b3JrL2ljZXMudHV0b3J3ZWIvc3JjL3R1dG9yd2ViLnF1aXovbGliL3F1aXouanMiLCIvc3J2L2RldmVsL3dvcmsvaWNlcy50dXRvcndlYi9zcmMvdHV0b3J3ZWIucXVpei9saWIvcXVpemxpYi5qcyIsIi9zcnYvZGV2ZWwvd29yay9pY2VzLnR1dG9yd2ViL3NyYy90dXRvcndlYi5xdWl6L2xpYi9zdGFydC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuWUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0ZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qanNsaW50IG5vbWVuOiB0cnVlLCBwbHVzcGx1czogdHJ1ZSwgYnJvd3Nlcjp0cnVlKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gSUFBKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgLyoqXG4gICAgICAqIFBpY2sgYSBuZXcgcXVlc3Rpb24gZnJvbSB0aGUgY3VycmVudCBsZWN0dXJlIGJ5IGdlbmVyYXRpbmcgYSBuZXdcbiAgICAgICogYW5zd2VyUXVldWUgZW50cnlcbiAgICAgICpcbiAgICAgICogYW5zd2VyUXVldWUgcmVwcmVzZW50cyB0aGUgcXVlc3Rpb25zIGFzc2lnbmVkIHRvIGEgdXNlciBhbmQgdGhlaXIgYW5zd2Vycy5cbiAgICAgICogV2hlbiBhIHN0dWRlbnQgcmVxdWVzdHMgYSBuZXcgcXVlc3Rpb24sIHRoaXMgd2lsbCBiZSBjYWxsZWQgdG8gZ2VuZXJhdGVcbiAgICAgICogdGhlIG5leHQgYW5zd2VyUXVldWUgbWVtYmVyLiBPbmNlIHRoZXkgY2hvb3NlIGFuIGFuc3dlciwgaXQgd2lsbCBiZVxuICAgICAgKiBhbm5vdGF0ZWQgd2l0aCB0aGUgYW5zd2VyIHRoZXkgY2hvc2UuXG4gICAgICAqXG4gICAgICAqIGN1dFR1dG9yaWFsIC0gVGhlIGRhdGEgc3RydWN0dXJlIGZvciB0aGUgY3VycmVudCB0dXRvcmlhbFxuICAgICAgKiBsZWNJbmRleCAtIFRoZSBpbmRleCBvZiB0aGUgbGVjdHVyZSB0aGUgc3R1ZGVudCBpcyBjdXJyZW50bHkgdGFraW5nXG4gICAgICAqIGFuc3dlclF1ZXVlIC0gUHJldmlvdXMgc3R1ZGVudCBhbnN3ZXJzLCBtb3N0IHJlY2VudCBsYXN0XG4gICAgICAqIHByYWN0aWNlTW9kZSAtIFRydWUgaWYgc3R1ZGVudCBoYXMgZW5nYWdlZCBwcmFjdGljZSBtb2RlXG4gICAgICAqL1xuICAgIHRoaXMubmV3QWxsb2NhdGlvbiA9IGZ1bmN0aW9uIChjdXJUdXRvcmlhbCwgbGVjSW5kZXgsIGFuc3dlclF1ZXVlLCBwcmFjdGljZU1vZGUpIHtcbiAgICAgICAgdmFyIHF1ZXN0aW9ucywgb2xkR3JhZGUsXG4gICAgICAgICAgICBzZXR0aW5ncyA9IGN1clR1dG9yaWFsLmxlY3R1cmVzW2xlY0luZGV4XS5zZXR0aW5ncyB8fCB7XCJoaXN0X3NlbFwiOiBjdXJUdXRvcmlhbC5sZWN0dXJlc1tsZWNJbmRleF0uaGlzdF9zZWx9O1xuICAgICAgICBpZiAoTWF0aC5yYW5kb20oKSA8IHBhcnNlRmxvYXQoc2V0dGluZ3MuaGlzdF9zZWwgfHwgMCkpIHtcbiAgICAgICAgICAgIHF1ZXN0aW9ucyA9IGN1clR1dG9yaWFsLmxlY3R1cmVzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChsZWNJbmRleCArIDEpKV0ucXVlc3Rpb25zO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcXVlc3Rpb25zID0gY3VyVHV0b3JpYWwubGVjdHVyZXNbbGVjSW5kZXhdLnF1ZXN0aW9ucztcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXF1ZXN0aW9ucyB8fCAhcXVlc3Rpb25zLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYW5zd2VyUXVldWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBvbGRHcmFkZSA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvbGRHcmFkZSA9IGFuc3dlclF1ZXVlW2Fuc3dlclF1ZXVlLmxlbmd0aCAtIDFdLmdyYWRlX2FmdGVyIHx8IDA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgXCJ1cmlcIjogdGhpcy5jaG9vc2VRdWVzdGlvbih0aGlzLnF1ZXN0aW9uRGlzdHJpYnV0aW9uKHF1ZXN0aW9ucywgb2xkR3JhZGUsIGFuc3dlclF1ZXVlKSkudXJpLFxuICAgICAgICAgICAgXCJhbGxvdHRlZF90aW1lXCI6IHRoaXMucW5UaW1lb3V0KHNldHRpbmdzLCBvbGRHcmFkZSksXG4gICAgICAgICAgICBcImdyYWRlX2JlZm9yZVwiOiBvbGRHcmFkZSxcbiAgICAgICAgICAgIFwibGVjX2Fuc3dlcmVkXCIgOiBBcnJheS5sYXN0KGFuc3dlclF1ZXVlKSA9PT0gbnVsbCA/IDAgOiAoQXJyYXkubGFzdChhbnN3ZXJRdWV1ZSkubGVjX2Fuc3dlcmVkIHx8IDApLFxuICAgICAgICAgICAgXCJsZWNfY29ycmVjdFwiIDogQXJyYXkubGFzdChhbnN3ZXJRdWV1ZSkgPT09IG51bGwgPyAwIDogKEFycmF5Lmxhc3QoYW5zd2VyUXVldWUpLmxlY19jb3JyZWN0IHx8IDApLFxuICAgICAgICAgICAgXCJwcmFjdGljZVwiOiBwcmFjdGljZU1vZGVcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICAqIEdyYWRlIHRoZSBzdHVkZW50J3Mgd29yaywgYWRkIGl0IHRvIHRoZSBsYXN0IGl0ZW0gaW4gdGhlIHF1ZXVlLlxuICAgICAgKiBhbnN3ZXJRdWV1ZTogUHJldmlvdXMgc3R1ZGVudCBhbnN3ZXJzLCBtb3N0IHJlY2VudCBsYXN0XG4gICAgICAqL1xuICAgIHRoaXMuZ3JhZGVBbGxvY2F0aW9uID0gZnVuY3Rpb24gKHNldHRpbmdzLCBhbnN3ZXJRdWV1ZSkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsIGFxLCBsYXN0O1xuXG4gICAgICAgIC8vIEFwcGx5IHdlaWdodGluZyB0byBhbnN3ZXJRdWV1ZVxuICAgICAgICBmdW5jdGlvbiBncmFkZShhcSkge1xuICAgICAgICAgICAgdmFyIGEsIGksIHdlaWdodGluZywgdG90YWwgPSAwO1xuXG4gICAgICAgICAgICB3ZWlnaHRpbmcgPSBzZWxmLmdyYWRlV2VpZ2h0aW5nKFxuICAgICAgICAgICAgICAgIGFxLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBnZXRTZXR0aW5nKHNldHRpbmdzLCAnZ3JhZGVfYWxwaGEnLCAwLjMpLFxuICAgICAgICAgICAgICAgIGdldFNldHRpbmcoc2V0dGluZ3MsICdncmFkZV9zJywgMikpO1xuXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgd2VpZ2h0aW5nLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYSA9IGFxW2FxLmxlbmd0aCAtIGkgLSAxXTtcbiAgICAgICAgICAgICAgICBpZiAoYSAmJiBhLmhhc093blByb3BlcnR5KCdjb3JyZWN0JykpIHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWwgKz0gd2VpZ2h0aW5nW2ldICogKGEuY29ycmVjdCA/IDEgOiAtMC41KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJldHVybiBncmFkZSAwLi4xMCwgcm91bmRlZCB0byBuZWFyZXN0IC4yNVxuICAgICAgICAgICAgcmV0dXJuIE1hdGgubWF4KE1hdGgucm91bmQodG90YWwgKiA0MCkgLyA0LCAwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE9ubHkgZ3JhZGUgaWYgYWxsIHF1ZXN0aW9ucyBoYXZlIGJlZW4gYW5zd2VyZWRcbiAgICAgICAgaWYgKGFuc3dlclF1ZXVlLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgICAgICBsYXN0ID0gYW5zd2VyUXVldWVbYW5zd2VyUXVldWUubGVuZ3RoIC0gMV07XG5cbiAgICAgICAgLy8gRmlsdGVyIHVuYW5zd2VyZWQgLyBwcmFjdGljZSBxdWVzdGlvbnNcbiAgICAgICAgYXEgPSBhbnN3ZXJRdWV1ZS5maWx0ZXIoZnVuY3Rpb24gKGEpIHtcbiAgICAgICAgICAgIHJldHVybiBhICYmICFhLnByYWN0aWNlICYmIGEuaGFzT3duUHJvcGVydHkoJ2NvcnJlY3QnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGxhc3QuZ3JhZGVfbmV4dF9yaWdodCA9IGdyYWRlKGFxLmNvbmNhdCh7XCJjb3JyZWN0XCIgOiB0cnVlfSkpO1xuICAgICAgICBpZiAobGFzdC5oYXNPd25Qcm9wZXJ0eSgnY29ycmVjdCcpKSB7XG4gICAgICAgICAgICBsYXN0LmdyYWRlX2FmdGVyID0gZ3JhZGUoYXEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGFzdC5ncmFkZV9iZWZvcmUgPSBncmFkZShhcSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICAqIEdlbmVyYXRlIHdlaWdodGluZyBmb3IgKGFuc3dlcnMpXG4gICAgICAqICAgICBuOiBOdW1iZXIgb2YgYW5zd2VycyBhdmFpbGFibGVcbiAgICAgICogICAgIGFscGhhOiBSYW5kb21seSBhc3NpZ25lZCBbMC4xNSwwLjMwXVxuICAgICAgKiAgICAgczogQ29uc3RhbnQgZGV0ZXJtaW5pbmcgY3VydmUgWzEsNF1cbiAgICAgICpcbiAgICAgICogUmV0dXJucyBhcnJheSBvZiB3ZWlnaHRpbmdzIGFjY29yZGluZyB0bzpcbiAgICAgICogICAgIG1tYXg9bWluKDMwLCBtYXgobiwgOCkpXG4gICAgICAqICAgICB3KDEpPWFscGhhXG4gICAgICAqICAgICB3KDI6bm1heCk9KDEtYWxwaGEpKigxLSh0LTEpLyhubWF4KzEpKV5zLyhzdW0oKDEtKHQtMSkvKG5tYXgrMSkpXnMpKVxuICAgICAgKiAgICAgICAuLi4gYnV0IGlmIHcoMik+YWxwaGEgdXNlOlxuICAgICAgKiAgICAgdygxOm5tYXgpID0gKDEtdC8obm1heCsxKSlecy8oc3VtKCgxLXQvKG5tYXgrMSkpXnMpKVxuICAgICAgKi9cbiAgICB0aGlzLmdyYWRlV2VpZ2h0aW5nID0gZnVuY3Rpb24gKG4sIGFscGhhLCBzKSB7XG4gICAgICAgIHZhciBpLCB0LFxuICAgICAgICAgICAgd2VpZ2h0aW5ncyA9IFtdLFxuICAgICAgICAgICAgdG90YWwgPSAwLFxuICAgICAgICAgICAgbm1heCA9IE1hdGgubWluKDMwLCBNYXRoLm1heChuLCA4KSkgKyAxOyAvL05COiBPbmUgZ3JlYXRlciB0aGFuIGZvcm11bGFlXG5cbiAgICAgICAgLy8gR2VuZXJhdGUgY3VydmUgZnJvbSAxLi5ubWF4XG4gICAgICAgIGZvciAodCA9IDE7IHQgPCBubWF4OyB0KyspIHtcbiAgICAgICAgICAgIHdlaWdodGluZ3MucHVzaChNYXRoLnBvdygxIC0gdC9ubWF4LCBzKSk7XG4gICAgICAgICAgICB0b3RhbCArPSB3ZWlnaHRpbmdzW3dlaWdodGluZ3MubGVuZ3RoIC0gMV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoKGFscGhhIC8gKDEgLSBhbHBoYSkpIDwgKHdlaWdodGluZ3NbMF0gLyB0b3RhbCkpIHtcbiAgICAgICAgICAgIC8vIFNjYWxlIHRvIG1ha2UgdGhlIHdlaWdodGluZ3Mgc3VtIHRvIDFcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB3ZWlnaHRpbmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgd2VpZ2h0aW5nc1tpXSA9IHdlaWdodGluZ3NbaV0gLyB0b3RhbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEFkZCBhbHBoYSB0byBiZWdpbm5pbmdcbiAgICAgICAgICAgIHRvdGFsIC09IHdlaWdodGluZ3MucG9wKCk7XG4gICAgICAgICAgICB3ZWlnaHRpbmdzLnVuc2hpZnQoYWxwaGEpO1xuXG4gICAgICAgICAgICAvLyBTY2FsZSByZXN0IG9mIHdlaWdodGluZ3MsIGtlZXBpbmcgYWxwaGEgYXMtaXNcbiAgICAgICAgICAgIHRvdGFsID0gdG90YWwgLyAoMSAtIGFscGhhKTtcbiAgICAgICAgICAgIGZvciAoaSA9IDE7IGkgPCB3ZWlnaHRpbmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgd2VpZ2h0aW5nc1tpXSA9IHdlaWdodGluZ3NbaV0gLyB0b3RhbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gd2VpZ2h0aW5ncztcbiAgICB9O1xuXG4gICAgLyoqIEdpdmVuIHVzZXIncyBjdXJyZW50IGdyYWRlLCByZXR1cm4gaG93IGxvbmcgdGhleSBzaG91bGQgaGF2ZSB0byBkbyB0aGUgbmV4dCBxdWVzdGlvbiBpbiBzZWNvbmRzKD8pICovXG4gICAgdGhpcy5xblRpbWVvdXQgPSBmdW5jdGlvbihzZXR0aW5ncywgZ3JhZGUpIHtcblxuICAgICAgICB2YXIgdE1heCwgdE1pbiwgZ3JhZGVhdmVyYWdlLCB0U3RkLCB0aW1lO1xuICAgICAgICAvLyBNYXggdGltZVxuICAgICAgICB0TWF4ID0gZ2V0U2V0dGluZyhzZXR0aW5ncywgJ3RpbWVvdXRfbWF4JywgMTApO1xuICAgICAgICAvL3BsYWNlaG9sZGVyIDogdE1pbiB3aWxsIGJlIHJhbmRvbWl6ZWQgKHdpdGggMiBiZWluZyB0aGUgbW9zdCBjb21tb24pIGFuZCBzYXZlZCB0byBNeSBTUUxcbiAgICAgICAgdE1pbiA9IGdldFNldHRpbmcoc2V0dGluZ3MsICd0aW1lb3V0X21pbicsIDMpO1xuICAgICAgICAvLyBnKiA6IHdpbGwgbGlrZWx5IGJlIGZpdmUgYnV0IG1pZ2h0IGNoYW5nZVxuICAgICAgICBncmFkZWF2ZXJhZ2UgPSBnZXRTZXR0aW5nKHNldHRpbmdzLCAndGltZW91dF9ncmFkZScsIDUpO1xuICAgICAgICAvL3dpbGwgYmUgMnNeMiB3aGVyZSBzID0gc3FydCgyKVxuICAgICAgICB0U3RkID0gZ2V0U2V0dGluZyhzZXR0aW5ncywgJ3RpbWVvdXRfc3RkJywgMiAqIE1hdGguc3FydCgyKSk7XG5cbiAgICAgICAgdGltZSA9IHRNYXggKiAoMS0oMS0odE1pbiAvIHRNYXgpKSAqIE1hdGguZXhwKC0oTWF0aC5wb3coKGdyYWRlLWdyYWRlYXZlcmFnZSksMikpL3RTdGQpKTtcbiAgICAgICAgdGltZSA9IE1hdGguZmxvb3IodGltZSAqIDYwKTtcbiAgICAgICAgcmV0dXJuIHRpbWU7XG4gICAgfTtcblxuICAgIC8qKiBJZiBzdHIgaXMgaW4gc2V0dGluZ3MgaGFzaCBhbmQgcGFyc2FibGUgYXMgYSBmbG9hdCwgcmV0dXJuIHRoYXQuXG4gICAgICAqIE90aGVyd2lzZSwgcmV0dXJuIGRlZlZhbHVlXG4gICAgICAqL1xuICAgIGZ1bmN0aW9uIGdldFNldHRpbmcoc2V0dGluZ3MsIHN0ciwgZGVmVmFsdWUpIHtcbiAgICAgICAgaWYgKGlzTmFOKHBhcnNlRmxvYXQoc2V0dGluZ3Nbc3RyXSkpKSB7XG4gICAgICAgICAgICByZXR1cm4gZGVmVmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBhcnNlRmxvYXQoc2V0dGluZ3Nbc3RyXSk7XG4gICAgfVxuXG4gICAgLyoqIENob29zZSBhIHJhbmRvbSBxdWVzdGlvbiBmcm9tIHFuRGlzdHJpYnV0aW9uLCBiYXNlZCBvbiB0aGUgcHJvYmFiaWxpdHlcbiAgICAgICogd2l0aGluLlxuICAgICAgKlxuICAgICAgKiBSZXR1cm5zIHRoYXQgcXVlc3Rpb25cbiAgICAgICovXG4gICAgdGhpcy5jaG9vc2VRdWVzdGlvbiA9IGZ1bmN0aW9uIChxbkRpc3RyaWJ1dGlvbikge1xuICAgICAgICAvLyBDaG9vc2UgYW4gaXRlbSBmcm9tIHFuRGlzdHJpYnV0aW9uIG9uY2UgdGhlIGN1bXVsYXRpdmUgcHJvYmFiaWxpdHlcbiAgICAgICAgLy8gaXMgZ3JlYXRlciB0aGFuIHRhcmdldFxuICAgICAgICB2YXIgaSA9IC0xLCB0b3RhbCA9IDAsIHRhcmdldCA9IE1hdGgucmFuZG9tKCk7XG4gICAgICAgIHdoaWxlICh0b3RhbCA8IHRhcmdldCAmJiBpIDwgcW5EaXN0cmlidXRpb24ubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgdG90YWwgKz0gcW5EaXN0cmlidXRpb25baV0ucHJvYmFiaWxpdHk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHFuRGlzdHJpYnV0aW9uW2ldLnFuO1xuICAgIH07XG5cbiAgICAvKiogUmV0dXJuIGEgUERGIGxpa2VseWhvb2Qgb2YgYSBxdWVzdGlvbiBiZWluZyBjaG9zZW4sIGdpdmVuOi1cbiAgICAgICogcXVlc3Rpb25zOiBBbiBhcnJheSBvZiBvYmplY3RzLCBjb250YWluaW5nOi1cbiAgICAgICogICAgIGNob3NlbjogTnVtYmVyIG9mIHRpbWVzIHF1ZXN0aW9uIGhhcyBiZWVuIGFuc3dlcmVkXG4gICAgICAqICAgICBjb3JyZWN0OiBPZiB0aG9zZSB0aW1lcywgaG93IG1hbnkgYSBzdHVkZW50IGdhdmUgYSBjb3JyZWN0IGFuc3dlclxuICAgICAgKiBhbnN3ZXJRdWV1ZTogQXJyYXkgb2YgYW5zd2VycywgbmV3ZXN0IGZpcnN0LlxuICAgICAgKiBncmFkZTogU3R1ZGVudCdzIGN1cnJlbnQgZ3JhZGUsIGFzIGNhbGN1bGF0ZWQgYnkgZ3JhZGVBbGxvY2F0aW9uKClcbiAgICAgICpcbiAgICAgICogUmV0dXJucyBhbiBhcnJheSBvZiBxdWVzdGlvbnMsIHByb2JhYmlsaXR5IGFuZCBkaWZmaWN1bHR5LlxuICAgICAgKi9cbiAgICB0aGlzLnF1ZXN0aW9uRGlzdHJpYnV0aW9uID0gZnVuY3Rpb24ocXVlc3Rpb25zLCBncmFkZSwgYW5zd2VyUXVldWUpIHtcbiAgICAgICAgdmFyIGksIGRpZmZpY3VsdHksIGNob3NlbixcbiAgICAgICAgICAgIHF1ZXN0aW9uQmlhcyA9IHt9LFxuICAgICAgICAgICAgdG90YWwgPSAwO1xuXG4gICAgICAgIC8vIGRpZmZpY3VsdHk6IEFycmF5IG9mIHsgcW46IHF1ZXN0aW9uLCBkaWZmaWN1bHR5OiAwLi4xIH0sIHNvcnRlZCBieSBkaWZmaWN1bHR5XG4gICAgICAgIGRpZmZpY3VsdHkgPSBxdWVzdGlvbnMubWFwKGZ1bmN0aW9uIChxbikge1xuICAgICAgICAgICAgLy8gU2lnbmlmaWNhbnQgbnVtZXIgb2YgYW5zd2Vycywgc28gcGxhY2Ugbm9ybWFsbHlcbiAgICAgICAgICAgIGlmKHFuLmNob3NlbiA+IDUpIHJldHVybiB7XCJxblwiOiBxbiwgXCJkaWZmaWN1bHR5XCI6IDEuMC0gKHFuLmNvcnJlY3QvcW4uY2hvc2VuKX07XG5cbiAgICAgICAgICAgIC8vIE1hcmsgbmV3IHF1ZXN0aW9ucyBhcyBlYXN5IC8gaGFyZCwgc28gdGhleSBhcmUgbGlrZWx5IHRvIGdldCB0aGVtIHJlZ2FyZGxlc3MuXG4gICAgICAgICAgICBpZihncmFkZSA8IDEuNSkgcmV0dXJuIHtcInFuXCI6IHFuLCBcImRpZmZpY3VsdHlcIjogKCgocW4uY2hvc2VuLXFuLmNvcnJlY3QpLzIuMCkgKyBNYXRoLnJhbmRvbSgpKS8xMDAuMH07XG4gICAgICAgICAgICByZXR1cm4ge1wicW5cIjogcW4sIFwiZGlmZmljdWx0eVwiOiAxLjAgLSgoKHFuLmNob3Nlbi1xbi5jb3JyZWN0KS8yLjApICsgTWF0aC5yYW5kb20oKSkvMTAwLjB9O1xuICAgICAgICB9KTtcbiAgICAgICAgZGlmZmljdWx0eSA9IGRpZmZpY3VsdHkuc29ydChmdW5jdGlvbiAoYSwgYikgeyByZXR1cm4gYS5kaWZmaWN1bHR5IC0gYi5kaWZmaWN1bHR5OyB9KTtcblxuICAgICAgICAvLyBCaWFzIHF1ZXN0aW9ucyBiYXNlZCBvbiBwcmV2aW91cyBhbnN3ZXJzIChOQjogTW9zdCByZWNlbnQgYW5zd2VycyB3aWxsIG92ZXJ3cml0ZSBvbGRlcilcbiAgICAgICAgZm9yIChpID0gTWF0aC5tYXgoYW5zd2VyUXVldWUubGVuZ3RoIC0gMjEsIDApOyBpIDwgYW5zd2VyUXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghYW5zd2VyUXVldWVbaV0uaGFzT3duUHJvcGVydHkoJ2NvcnJlY3QnKSkgY29udGludWU7XG5cbiAgICAgICAgICAgIC8vIElmIHF1ZXN0aW9uIGluY29ycmVjdCwgcHJvYmFibGl0eSBpbmNyZWFzZXMgd2l0aCB0aW1lLiBDb3JyZWN0IHF1ZXN0aW9ucyBsZXNzIGxpa2VseVxuICAgICAgICAgICAgcXVlc3Rpb25CaWFzW2Fuc3dlclF1ZXVlW2ldLnVyaV0gPSBhbnN3ZXJRdWV1ZVtpXS5jb3JyZWN0ID8gMC41IDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5wb3coMS4wNSwgYW5zd2VyUXVldWUubGVuZ3RoIC0gaSAtIDMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgYSBQREYgYmFzZWQgb24gZ3JhZGUsIG1hcCBxdWVzdGlvbnMgdG8gaXQgb3JkZXJlZCBieSBkaWZmaWN1bHR5XG4gICAgICAgIGlhX3BkZihkaWZmaWN1bHR5Lmxlbmd0aCwgZ3JhZGUsIGRpZmZpY3VsdHkubGVuZ3RoIC8gMTAuMCkubWFwKGZ1bmN0aW9uIChwcm9iLCBpKSB7XG4gICAgICAgICAgICAvLyBBcyB3ZSBnbywgYXBwbHkgcXVlc3Rpb24gYmlhcyBhbmQgZ2VuZXJhdGUgYSB0b3RhbCBzbyB3ZSBjYW4gcmVzY2FsZSB0byAxLlxuICAgICAgICAgICAgZGlmZmljdWx0eVtpXS5xdWVzdGlvbkJpYXMgPSAocXVlc3Rpb25CaWFzW2RpZmZpY3VsdHlbaV0ucW4udXJpXSB8fCAxKTtcbiAgICAgICAgICAgIHRvdGFsICs9IGRpZmZpY3VsdHlbaV0ucHJvYmFiaWxpdHkgPSBwcm9iICogZGlmZmljdWx0eVtpXS5xdWVzdGlvbkJpYXM7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFJlLW9yZGVyIGJhc2VkIG9uIHByb2JhYmlsaXR5LCByZXNjYWxlIHRvIDFcbiAgICAgICAgZGlmZmljdWx0eSA9IGRpZmZpY3VsdHkuc29ydChmdW5jdGlvbiAoYSwgYikgeyByZXR1cm4gYS5wcm9iYWJpbGl0eSAtIGIucHJvYmFiaWxpdHk7IH0pO1xuICAgICAgICBkaWZmaWN1bHR5Lm1hcChmdW5jdGlvbiAoZCkge1xuICAgICAgICAgICAgZC5wcm9iYWJpbGl0eSA9IGQucHJvYmFiaWxpdHkgLyB0b3RhbDtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGRpZmZpY3VsdHk7XG5cbiAgICAgICAgLy9Vc2U6IHBkZiA9IGlhX3BkZihpbmRleCwgZ3JhZGUsIHEpXG4gICAgICAgIC8vQmVmb3JlOiBpbmRleCBhbmQgZ3JhZGUgYXJlIGludGVnZXJzIGFuZCAwPHE8MVxuICAgICAgICAvL2luZGV4IHNwZWNpZmllcyBob3cgbWFueSBxdWVzdGlvbnMgdGhlcmUgYXJlIGluIHRoZSBjdXJyZW50IGV4ZXJzaXplXG4gICAgICAgIC8vZ3JhZGUgaXMgdGhlIHVzZXJzIGN1cnJlbnQgZ3JhZGUgKGN1cnJlbnRseSBvbiB0aGUgc2NhbGUgb2YgLTAuNSAtIDFcbiAgICAgICAgLy9BZnRlcjogcGRmIGlzIGFuIGFycmF5IHdpdGggdGhlIHByb2JhYmlsaXR5IGRlbnNpdHkgZGlzdHJpYnV0aW9uIG9mIHRoZSBjdXJyZW50IFxuICAgICAgICAvL2V4ZXJzaXplXG4gICAgICAgIC8vTm9rdHVuIHBkZiA9IGlhX3BkZihpbmRleCAsIGdyYWRlLCBxKVxuICAgICAgICAvL0Z5cmlyOiBpbmRleCBvZyBncmFkZSBlcnUgaGVpbHTDtmx1ciwgaW5kZXhcbiAgICAgICAgLy9lciBodmVyc3UgbWFyZ2FyIHNwdXJuaW5nYXIgZXJ1IMOtIGhlaWxkaW5hIGZ5cmlyIMO+YW5uIGdsw6ZydXBha2thLCBxIGVyXG4gICAgICAgIC8vdMO2bGZyw6bDsGkgc3R1w7B1bGxcbiAgICAgICAgLy8wPHE8MSBncmFkZSBlciBlaW5rdW4gZnlyaXIgw75hbm4gZ2zDpnJ1cGFra2FcbiAgICAgICAgLy9FZnRpcjogcGRmIGVyIGZ5bGtpIG1lw7Agw75ldHRsZWlrYSBkcmVpZmluZ2FyIGZ5cmlyIGh2ZXJqYSBzcHVybmluZ3VcbiAgICAgICAgZnVuY3Rpb24gaWFfcGRmKGluZGV4LCBncmFkZSwgcSlcbiAgICAgICAge1xuICAgICAgICAgICAgdmFyIGk7XG4gICAgICAgICAgICBncmFkZSA9IGdyYWRlIC8gMTA7ICAgICAgICAgICAgICAgIC8vZWlua2FubmlyIGZyw6EgMDoxXG4gICAgICAgICAgICB2YXIgeCA9IFtdO1xuICAgICAgICAgICAgZm9yKHZhciBoID0gMDsgaDwgaW5kZXg7IGgrKylcbiAgICAgICAgICAgICAgICB4W2hdID0gKGgrMSkvKGluZGV4KzEuMCk7XG4gICAgICAgICAgICB2YXIgYWxwaGEgPSBxKmdyYWRlO1xuICAgICAgICAgICAgdmFyIGJldGEgPSBxIC0gYWxwaGE7XG4gICAgICAgICAgICB2YXIgeSA9IFtdO1xuICAgICAgICAgICAgZm9yKGk9MDsgaTx4Lmxlbmd0aDtpKyspXG4gICAgICAgICAgICAgICAgeVtpXT0xLXhbaV07XG4gICAgICAgICAgICBhcnJheVBvd2VyKHgsIGFscGhhKTsgICAgICAgICAgICAgICAgICAgICAgICAvL3BkZj0oeF5hbHBoYSkqKDEteCleYmV0YVxuICAgICAgICAgICAgYXJyYXlQb3dlcih5LCBiZXRhKTtcbiAgICAgICAgICAgIHZhciBwZGYgPSBhcnJheU11bHRpcGx5KHgsIHkpO1xuICAgICAgICAgICAgdmFyIHN1bSA9IDAuMDsgICAgICAgICAgICAgICAgICAgICAgICAvL3N1bSBlciBzdW1tYW4gw7pyIMO2bGx1bSBzdMO2a3VtIMOtIHBkZlxuICAgICAgICAgICAgZm9yKHZhciBqPTA7IGo8eC5sZW5ndGg7IGorKylcbiAgICAgICAgICAgICAgICBzdW0gKz0gcGRmW2pdO1xuICAgICAgICAgICAgYXJyYXlEaXZpZGVzY2FsYXIocGRmLCBzdW0pO1xuICAgICAgICAgICAgcmV0dXJuIHBkZjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgZnVuY3Rpb24gYXJyYXlNdWx0aXBseShhcnJheXgsIGFycmF5eSlcbiAgICAgICAge1xuICAgICAgICAgICAgdmFyIGFycmF5eiA9IFtdO1xuICAgICAgICAgICAgZm9yKHZhciBpID0gMDsgaTxhcnJheXgubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICAgICAgYXJyYXl6W2ldID0gYXJyYXl4W2ldICogYXJyYXl5W2ldO1xuICAgICAgICAgICAgcmV0dXJuIGFycmF5ejtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgZnVuY3Rpb24gYXJyYXlQb3dlcihhcnJheSwgcG93ZXIpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGZvcih2YXIgaSA9IDA7IGk8IGFycmF5Lmxlbmd0aDsgaSsrKVxuICAgICAgICAgICAgICAgIGFycmF5W2ldID0gTWF0aC5wb3coYXJyYXlbaV0sIHBvd2VyKTtcbiAgICAgICAgICAgIHJldHVybiBhcnJheTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgZnVuY3Rpb24gYXJyYXlEaXZpZGVzY2FsYXIoYXJyYXksIHNjYWxhcilcbiAgICAgICAge1xuICAgICAgICAgICAgZm9yKHZhciBpID0gMDsgaTxhcnJheS5sZW5ndGg7IGkrKylcbiAgICAgICAgICAgICAgICBhcnJheVtpXSA9IGFycmF5W2ldL3NjYWxhcjtcbiAgICAgICAgICAgIHJldHVybiBhcnJheTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuIiwiLypqc2xpbnQgbm9tZW46IHRydWUsIHBsdXNwbHVzOiB0cnVlLCBicm93c2VyOnRydWUqL1xuLypnbG9iYWwgalF1ZXJ5Ki9cbnZhciBRdWl6ID0gcmVxdWlyZSgnLi9xdWl6bGliLmpzJyk7XG5cbihmdW5jdGlvbiAod2luZG93LCAkKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgdmFyIHF1aXosIHFzLCBoYW5kbGVFcnJvciwgdXBkYXRlU3RhdGUsXG4gICAgICAgIGpxUXVpeiA9ICQoJyN0dy1xdWl6JyksXG4gICAgICAgIGpxQmFyID0gJCgnI2xvYWQtYmFyJyk7XG4gICAgLy8gRG8gbm90aGluZyBpZiBub3Qgb24gdGhlIHJpZ2h0IHBhZ2VcbiAgICBpZiAoJCgnYm9keS5xdWl6LWxvYWQnKS5sZW5ndGggPT09IDApIHsgcmV0dXJuOyB9XG5cbiAgICAvKiogQ2FsbCBhbiBhcnJheSBvZiBBamF4IGNhbGxzLCBzcGxpY2luZyBpbiBleHRyYSBvcHRpb25zLCBvblByb2dyZXNzIGNhbGxlZCBvbiBlYWNoIHN1Y2Nlc3MsIG9uRG9uZSBhdCBlbmQgKi9cbiAgICBmdW5jdGlvbiBjYWxsQWpheChjYWxscywgZXh0cmEsIG9uUHJvZ3Jlc3MsIG9uRG9uZSkge1xuICAgICAgICB2YXIgZGZkcyA9IGNhbGxzLm1hcChmdW5jdGlvbiAoYSkge1xuICAgICAgICAgICAgcmV0dXJuICQuYWpheCgkLmV4dGVuZCh7fSwgYSwgZXh0cmEpKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChkZmRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgb25Eb25lKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZmRzLm1hcChmdW5jdGlvbiAoZCkgeyBkLmRvbmUob25Qcm9ncmVzcyk7IH0pO1xuICAgICAgICAgICAgJC53aGVuLmFwcGx5KG51bGwsIGRmZHMpLmRvbmUob25Eb25lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZVN0YXRlID0gZnVuY3Rpb24gKGN1clN0YXRlLCBtZXNzYWdlLCBlbmNvZGluZykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsIGpxQWxlcnQ7XG4gICAgICAgIC8vIEFkZCBtZXNzYWdlIHRvIHBhZ2UgaWYgd2UgbmVlZCB0b1xuICAgICAgICBpZiAobWVzc2FnZSkge1xuICAgICAgICAgICAganFBbGVydCA9ICQoJzxkaXYgY2xhc3M9XCJhbGVydFwiPicpLmFkZENsYXNzKGN1clN0YXRlID09PSAnZXJyb3InID8gJyBhbGVydC1lcnJvcicgOiAnYWxlcnQtaW5mbycpO1xuICAgICAgICAgICAgaWYgKGVuY29kaW5nID09PSAnaHRtbCcpIHtcbiAgICAgICAgICAgICAgICBqcUFsZXJ0Lmh0bWwobWVzc2FnZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGpxQWxlcnQudGV4dChtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGpxUXVpei5jaGlsZHJlbignZGl2LmFsZXJ0JykucmVtb3ZlKCk7XG4gICAgICAgICAgICBqcVF1aXoucHJlcGVuZChqcUFsZXJ0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjdXJTdGF0ZSA9PT0gJ3JlYWR5Jykge1xuICAgICAgICAgICAgJCgnI3R3LXByb2NlZWQnKS5hZGRDbGFzcyhcInJlYWR5XCIpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIHVwZGF0ZVByb2dyZXNzKGN1ciwgbWF4KSB7XG4gICAgICAgIGlmIChtYXggPT09IDApIHtcbiAgICAgICAgICAgIGpxQmFyLmNzcyh7XCJ3aWR0aFwiOiAnMCUnfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoY3VyIDwgbWF4KSB7XG4gICAgICAgICAgICBqcUJhci5jc3Moe1wid2lkdGhcIjogKGN1ciAvIG1heCkgKiAxMDAgKyAnJSd9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGpxQmFyLmNzcyh7XCJ3aWR0aFwiOiAnMTAwJSd9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGhhbmRsZUVycm9yID0gZnVuY3Rpb24gKG1lc3NhZ2UsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duKSB7XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAzKSB7XG4gICAgICAgICAgICAvLyB2YXIganFYSFIgPSBtZXNzYWdlXG4gICAgICAgICAgICB1cGRhdGVTdGF0ZSgnZXJyb3InLCBlcnJvclRocm93biArIFwiICh3aGlsc3QgcmVxdWVzdGluZyBcIiArIHRoaXMudXJsICsgXCIpXCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gSnVzdCBhIHN0cmluZ1xuICAgICAgICAgICAgdXBkYXRlU3RhdGUoJ2Vycm9yJywgbWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gQ2F0Y2ggYW55IHVuY2F1Z2h0IGV4Y2VwdGlvbnNcbiAgICB3aW5kb3cub25lcnJvciA9IGZ1bmN0aW9uIChtZXNzYWdlLCB1cmwsIGxpbmVudW1iZXIpIHtcbiAgICAgICAgdXBkYXRlU3RhdGUoXCJlcnJvclwiLCBcIkludGVybmFsIGVycm9yOiBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIiAoXCIgKyB1cmwgKyBcIjpcIiArIGxpbmVudW1iZXIgKyBcIilcIik7XG4gICAgfTtcblxuICAgIC8vIFdpcmUgdXAgcXVpeiBvYmplY3RcbiAgICBxdWl6ID0gbmV3IFF1aXoobG9jYWxTdG9yYWdlLCBmdW5jdGlvbiAobWVzc2FnZSwgZW5jb2RpbmcpIHtcbiAgICAgICAgdXBkYXRlU3RhdGUoJ2Vycm9yJywgbWVzc2FnZSwgZW5jb2RpbmcpO1xuICAgIH0pO1xuXG4gICAgLyoqIERvd25sb2FkIGEgdHV0b3JpYWwgZ2l2ZW4gYnkgVVJMICovXG4gICAgZnVuY3Rpb24gZG93bmxvYWRUdXRvcmlhbCh1cmwpIHtcbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgICAgICBjYWNoZTogZmFsc2UsXG4gICAgICAgICAgICB1cmw6IHVybCxcbiAgICAgICAgICAgIGVycm9yOiBoYW5kbGVFcnJvcixcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgdmFyIGksIGFqYXhDYWxscywgY291bnQgPSAwO1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIG5vb3AoKSB7IH1cblxuICAgICAgICAgICAgICAgIGlmICghcXVpei5pbnNlcnRUdXRvcmlhbChkYXRhLnVyaSwgZGF0YS50aXRsZSwgZGF0YS5sZWN0dXJlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gV3JpdGUgZmFpbGVkLCBnaXZlIHVwXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBIb3VzZWtlZXAsIHJlbW92ZSBhbGwgdXNlbGVzcyBxdWVzdGlvbnNcbiAgICAgICAgICAgICAgICB1cGRhdGVTdGF0ZShcImFjdGl2ZVwiLCBcIlJlbW92aW5nIG9sZCBxdWVzdGlvbnMuLi5cIik7XG4gICAgICAgICAgICAgICAgcXVpei5yZW1vdmVVbnVzZWRPYmplY3RzKCk7XG5cbiAgICAgICAgICAgICAgICAvLyBHZXQgYWxsIHRoZSBjYWxscyByZXF1aXJlZCB0byBoYXZlIGEgZnVsbCBzZXQgb2YgcXVlc3Rpb25zXG4gICAgICAgICAgICAgICAgdXBkYXRlU3RhdGUoXCJhY3RpdmVcIiwgXCJEb3dubG9hZGluZyBxdWVzdGlvbnMuLi5cIik7XG4gICAgICAgICAgICAgICAgYWpheENhbGxzID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGRhdGEubGVjdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgcXVpei5zZXRDdXJyZW50TGVjdHVyZSh7IFwidHV0VXJpXCI6IHVybCwgXCJsZWNVcmlcIjogZGF0YS5sZWN0dXJlc1tpXS51cmkgfSwgbm9vcCk7ICAvL1RPRE86IEVyZ1xuICAgICAgICAgICAgICAgICAgICAvL05COiBNZXJnZSBxdWl6LnN5bmNRdWVzdGlvbnMoKSdzIGFycmF5IHdpdGggYWpheENhbGxzXG4gICAgICAgICAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KGFqYXhDYWxscywgcXVpei5zeW5jUXVlc3Rpb25zKCkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIERvIHRoZSBjYWxscywgdXBkYXRpbmcgb3VyIHByb2dyZXNzIGJhclxuICAgICAgICAgICAgICAgIGNhbGxBamF4KGFqYXhDYWxscywge2Vycm9yOiBoYW5kbGVFcnJvcn0sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9UT0RPOiBBcmUgd2UgZ2VudWluZWx5IGNhcHR1cmluZyBmdWxsIGxvY2FsU3RvcmFnZT9cbiAgICAgICAgICAgICAgICAgICAgY291bnQgKz0gMTtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlUHJvZ3Jlc3MoY291bnQsIGFqYXhDYWxscy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvdW50IDwgYWpheENhbGxzLmxlbmd0aCkgeyByZXR1cm47IH1cbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlUHJvZ3Jlc3MoMSwgMSk7XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZVN0YXRlKFwicmVhZHlcIiwgXCJQcmVzcyB0aGUgYnV0dG9uIHRvIHN0YXJ0IHlvdXIgcXVpelwiKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgICB1cGRhdGVTdGF0ZShcImFjdGl2ZVwiLCBcIkRvd25sb2FkaW5nIGxlY3R1cmVzLi4uXCIpO1xuICAgIH1cblxuICAgIHFzID0gcXVpei5wYXJzZVFTKHdpbmRvdy5sb2NhdGlvbik7XG4gICAgaWYgKCFxcy50dXRVcmkgfHwgIXFzLmxlY1VyaSkge1xuICAgICAgICBoYW5kbGVFcnJvcihcIk1pc3NpbmcgdHV0b3JpYWwgb3IgbGVjdHVyZSBVUkkhXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChxcy5jbGVhcikge1xuICAgICAgICAvLyBFbXB0eSBsb2NhbFN0b3JhZ2UgZmlyc3RcbiAgICAgICAgd2luZG93LmxvY2FsU3RvcmFnZS5jbGVhcigpO1xuICAgIH1cbiAgICAkKCcjdHctcHJvY2VlZCcpLmF0dHIoJ2hyZWYnLCBxdWl6LnF1aXpVcmwocXMudHV0VXJpLCBxcy5sZWNVcmkpKTtcbiAgICBkb3dubG9hZFR1dG9yaWFsKHFzLnR1dFVyaSk7XG59KHdpbmRvdywgalF1ZXJ5KSk7XG4iLCIvKmpzbGludCBub21lbjogdHJ1ZSwgcGx1c3BsdXM6IHRydWUsIGJyb3dzZXI6dHJ1ZSovXG4vKmdsb2JhbCBqUXVlcnksIE1hdGhKYXgqL1xudmFyIFF1aXogPSByZXF1aXJlKCcuL3F1aXpsaWIuanMnKTtcblxuLyoqXG4gICogVmlldyBjbGFzcyB0byB0cmFuc2xhdGUgZGF0YSBpbnRvIERPTSBzdHJ1Y3R1cmVzXG4gICogICAgJDogalF1ZXJ5XG4gICogICAganFRdWl6OiBqUXVlcnktd3JhcHBlZCA8Zm9ybSBpZD1cInR3LXF1aXpcIj5cbiAgKiAgICBqcVByb2NlZWQ6IGpRdWVyeSB3cmFwcGVkIHByb2NlZWQgYnV0dG9uXG4gICovXG5mdW5jdGlvbiBRdWl6VmlldygkLCBqcVF1aXosIGpxVGltZXIsIGpxUHJvY2VlZCwganFGaW5pc2gsIGpxRGVidWdNZXNzYWdlKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgdGhpcy5qcVF1aXogPSBqcVF1aXo7XG4gICAgdGhpcy5qcVRpbWVyID0ganFUaW1lcjtcbiAgICB0aGlzLmpxUHJvY2VlZCA9IGpxUHJvY2VlZDtcbiAgICB0aGlzLmpxRmluaXNoID0ganFGaW5pc2g7XG4gICAgdGhpcy5qcURlYnVnTWVzc2FnZSA9IGpxRGVidWdNZXNzYWdlO1xuICAgIHRoaXMuanFHcmFkZSA9ICQoJyN0dy1ncmFkZScpO1xuICAgIHRoaXMuanFQcmFjdGljZSA9ICQoJyN0dy1wcmFjdGljZScpO1xuICAgIHRoaXMudGltZXJUaW1lID0gbnVsbDtcblxuICAgIC8qKiBTdGFydCB0aGUgdGltZXIgY291bnRpbmcgZG93biBmcm9tIHN0YXJ0VGltZSBzZWNvbmRzICovXG4gICAgdGhpcy50aW1lclN0YXJ0ID0gZnVuY3Rpb24gKHN0YXJ0VGltZSkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIGZ1bmN0aW9uIGZvcm1hdFRpbWUodCkge1xuICAgICAgICAgICAgdmFyIG91dCA9IFwiXCI7XG4gICAgICAgICAgICBmdW5jdGlvbiBwbHVyYWwoaSwgYmFzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBpICsgXCIgXCIgKyBiYXNlICsgKGkgIT09IDEgPyAncycgOiAnJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0ID4gNjApIHtcbiAgICAgICAgICAgICAgICBvdXQgPSBwbHVyYWwoTWF0aC5mbG9vcih0IC8gNjApLCAnbWluJykgKyAnICc7XG4gICAgICAgICAgICAgICAgdCA9IHQgJSA2MDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG91dCArPSBwbHVyYWwodCwgJ3NlYycpO1xuICAgICAgICAgICAgcmV0dXJuIG91dDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzdGFydFRpbWUpIHtcbiAgICAgICAgICAgIHNlbGYudGltZXJUaW1lID0gc3RhcnRUaW1lO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMudGltZXJUaW1lID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gU29tZXRoaW5nIGNhbGxlZCB0aW1lclN0b3AsIHNvIHN0b3AuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2VsZi50aW1lclRpbWUgPSBzZWxmLnRpbWVyVGltZSAtIDE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2VsZi50aW1lclRpbWUgPiAwKSB7XG4gICAgICAgICAgICBzZWxmLmpxVGltZXIudGV4dChmb3JtYXRUaW1lKHNlbGYudGltZXJUaW1lKSk7XG4gICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dChzZWxmLnRpbWVyU3RhcnQuYmluZChzZWxmKSwgMTAwMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBXYXNuJ3QgYXNrZWQgdG8gc3RvcCwgc28gaXQncyBhIGdlbnVpbmUgdGltZW91dFxuICAgICAgICAgICAgc2VsZi5qcVRpbWVyLnRleHQoXCJPdXQgb2YgdGltZVwiKTtcbiAgICAgICAgICAgIHNlbGYuanFQcm9jZWVkLnRyaWdnZXIoJ2NsaWNrJywgJ3RpbWVvdXQnKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKiogU3RvcCB0aGUgdGltZXIgYXQgaXQncyBjdXJyZW50IHZhbHVlICovXG4gICAgdGhpcy50aW1lclN0b3AgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgc2VsZi50aW1lclRpbWUgPSBudWxsO1xuICAgIH07XG5cbiAgICAvKiogVXBkYXRlIHRoZSBkZWJ1ZyBtZXNzYWdlIHdpdGggY3VycmVudCBVUkkgYW5kIGFuIGV4dHJhIHN0cmluZyAqL1xuICAgIHRoaXMudXBkYXRlRGVidWdNZXNzYWdlID0gZnVuY3Rpb24gKGxlY1VyaSwgcW4pIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAobGVjVXJpKSB7IHNlbGYuanFEZWJ1Z01lc3NhZ2VbMF0ubGVjVXJpID0gbGVjVXJpOyB9XG4gICAgICAgIHNlbGYuanFEZWJ1Z01lc3NhZ2UudGV4dChzZWxmLmpxRGVidWdNZXNzYWdlWzBdLmxlY1VyaSArIFwiXFxuXCIgKyBxbik7XG4gICAgfTtcblxuICAgIC8qKiBTd2l0Y2ggcXVpeiBzdGF0ZSwgb3B0aW9uYWxseSBzaG93aW5nIG1lc3NhZ2UgKi9cbiAgICB0aGlzLnVwZGF0ZVN0YXRlID0gZnVuY3Rpb24gKGN1clN0YXRlLCBtZXNzYWdlLCBlbmNvZGluZykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsIGpxQWxlcnQ7XG5cbiAgICAgICAgLy8gQWRkIG1lc3NhZ2UgdG8gcGFnZSBpZiB3ZSBuZWVkIHRvXG4gICAgICAgIGlmIChtZXNzYWdlKSB7XG4gICAgICAgICAgICBqcUFsZXJ0ID0gJCgnPGRpdiBjbGFzcz1cImFsZXJ0XCI+JykuYWRkQ2xhc3MoY3VyU3RhdGUgPT09ICdlcnJvcicgPyAnIGFsZXJ0LWVycm9yJyA6ICdhbGVydC1pbmZvJyk7XG4gICAgICAgICAgICBpZiAoZW5jb2RpbmcgPT09ICdodG1sJykge1xuICAgICAgICAgICAgICAgIGpxQWxlcnQuaHRtbChtZXNzYWdlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAganFBbGVydC50ZXh0KG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAganFRdWl6LmNoaWxkcmVuKCdkaXYuYWxlcnQnKS5yZW1vdmUoKTtcbiAgICAgICAgICAgIGpxUXVpei5wcmVwZW5kKGpxQWxlcnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgJChkb2N1bWVudCkuZGF0YSgndHctc3RhdGUnLCBjdXJTdGF0ZSk7XG5cbiAgICAgICAgLy8gU2V0IGJ1dHRvbiB0byBtYXRjaCBzdGF0ZVxuICAgICAgICBzZWxmLmpxUHJvY2VlZC5yZW1vdmVBdHRyKFwiZGlzYWJsZWRcIik7XG4gICAgICAgIHNlbGYuanFQcmFjdGljZS5yZW1vdmVBdHRyKFwiZGlzYWJsZWRcIik7XG4gICAgICAgIHNlbGYuanFGaW5pc2gucmVtb3ZlQXR0cihcImRpc2FibGVkXCIpO1xuICAgICAgICBpZiAoY3VyU3RhdGUgPT09ICduZXh0cW4nKSB7XG4gICAgICAgICAgICBzZWxmLmpxUHJvY2VlZC5odG1sKFwiTmV3IHF1ZXN0aW9uID4+PlwiKTtcbiAgICAgICAgfSBlbHNlIGlmIChjdXJTdGF0ZSA9PT0gJ2ludGVycm9nYXRlJykge1xuICAgICAgICAgICAgc2VsZi5qcVByb2NlZWQuaHRtbChcIlN1Ym1pdCBhbnN3ZXIgPj4+XCIpO1xuICAgICAgICAgICAgc2VsZi5qcVByYWN0aWNlLmF0dHIoXCJkaXNhYmxlZFwiLCB0cnVlKTtcbiAgICAgICAgICAgIHNlbGYuanFGaW5pc2guYXR0cihcImRpc2FibGVkXCIsIHRydWUpO1xuICAgICAgICB9IGVsc2UgaWYgKGN1clN0YXRlID09PSAncHJvY2Vzc2luZycpIHtcbiAgICAgICAgICAgIHNlbGYuanFQcm9jZWVkLmF0dHIoXCJkaXNhYmxlZFwiLCB0cnVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuanFQcm9jZWVkLmh0bWwoXCJSZXN0YXJ0IHF1aXogPj4+XCIpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKiBVcGRhdGUgc3luYyBidXR0b24sIGN1clN0YXRlIG9uZSBvZiAncHJvY2Vzc2luZycsICdvbmxpbmUnLCAnb2ZmbGluZScsICd1bmF1dGgnLCAnJyAqL1xuICAgIHRoaXMuc3luY1N0YXRlID0gZnVuY3Rpb24gKGN1clN0YXRlKSB7XG4gICAgICAgIHZhciBqcVN5bmMgPSAkKCcjdHctc3luYycpO1xuXG4gICAgICAgIGlmICghY3VyU3RhdGUpIHtcbiAgICAgICAgICAgIC8vIFdhbnQgdG8ga25vdyB3aGF0IHRoZSBzdGF0ZSBpc1xuICAgICAgICAgICAgcmV0dXJuIGpxU3luY1swXS5jbGFzc05hbWUgPT09ICdidG4gYWN0aXZlJyA/ICdwcm9jZXNzaW5nJ1xuICAgICAgICAgICAgICAgICAgICA6IGpxU3luY1swXS5jbGFzc05hbWUgPT09ICdidG4gYnRuLWRhbmdlciBidG4tdW5hdXRoJyA/ICd1bmF1dGgnXG4gICAgICAgICAgICAgICAgICAgIDoganFTeW5jWzBdLmNsYXNzTmFtZSA9PT0gJ2J0biBidG4tc3VjY2VzcycgPyAnb25saW5lJ1xuICAgICAgICAgICAgICAgICAgICAgICAgIDogJ3Vua25vd24nO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2V0dGluZyB0aGUgc3RhdGVcbiAgICAgICAgaWYgKGN1clN0YXRlID09PSAncHJvY2Vzc2luZycpIHtcbiAgICAgICAgICAgIGpxU3luY1swXS5jbGFzc05hbWUgPSAnYnRuIGFjdGl2ZSc7XG4gICAgICAgICAgICBqcVN5bmMudGV4dChcIlN5bmNpbmcuLi5cIik7XG4gICAgICAgIH0gZWxzZSBpZiAoY3VyU3RhdGUgPT09ICdvbmxpbmUnKSB7XG4gICAgICAgICAgICBqcVN5bmNbMF0uY2xhc3NOYW1lID0gJ2J0biBidG4tc3VjY2Vzcyc7XG4gICAgICAgICAgICBqcVN5bmMudGV4dChcIlNjb3JlcyBzYXZlZC5cIik7XG4gICAgICAgIH0gZWxzZSBpZiAoY3VyU3RhdGUgPT09ICdvZmZsaW5lJykge1xuICAgICAgICAgICAganFTeW5jWzBdLmNsYXNzTmFtZSA9ICdidG4gYnRuLWluZm8nO1xuICAgICAgICAgICAganFTeW5jLnRleHQoXCJDdXJyZW50bHkgb2ZmbGluZS4gU3luYyBvbmNlIG9ubGluZVwiKTtcbiAgICAgICAgfSBlbHNlIGlmIChjdXJTdGF0ZSA9PT0gJ3VuYXV0aCcpIHtcbiAgICAgICAgICAgIGpxU3luY1swXS5jbGFzc05hbWUgPSAnYnRuIGJ0bi1kYW5nZXIgYnRuLXVuYXV0aCc7XG4gICAgICAgICAgICBqcVN5bmMudGV4dChcIkNsaWNrIGhlcmUgdG8gbG9naW4sIHNvIHlvdXIgc2NvcmVzIGNhbiBiZSBzYXZlZFwiKTtcbiAgICAgICAgfSBlbHNlIGlmIChjdXJTdGF0ZSA9PT0gJ2Vycm9yJykge1xuICAgICAgICAgICAganFTeW5jWzBdLmNsYXNzTmFtZSA9ICdidG4gYnRuLWRhbmdlcic7XG4gICAgICAgICAgICBqcVN5bmMudGV4dChcIlN5bmNpbmcgZmFpbGVkIVwiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGpxU3luY1swXS5jbGFzc05hbWUgPSAnYnRuJztcbiAgICAgICAgICAgIGpxU3luYy50ZXh0KFwiU3luYyBhbnN3ZXJzXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjdXJTdGF0ZTtcbiAgICB9O1xuXG4gICAgdGhpcy5yZW5kZXJNYXRoID0gZnVuY3Rpb24gKG9uU3VjY2Vzcykge1xuICAgICAgICB2YXIganFRdWl6ID0gdGhpcy5qcVF1aXo7XG4gICAgICAgIGpxUXVpei5hZGRDbGFzcyhcIm1hdGhqYXgtYnVzeVwiKTtcbiAgICAgICAgTWF0aEpheC5IdWIuUXVldWUoW1wiVHlwZXNldFwiLCBNYXRoSmF4Lkh1YiwgdGhpcy5qcVF1aXpbMF1dKTtcbiAgICAgICAgTWF0aEpheC5IdWIuUXVldWUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAganFRdWl6LnJlbW92ZUNsYXNzKFwibWF0aGpheC1idXN5XCIpO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKG9uU3VjY2Vzcykge1xuICAgICAgICAgICAgTWF0aEpheC5IdWIuUXVldWUob25TdWNjZXNzKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKiogUmVuZGVyIG5leHQgcXVlc3Rpb24gKi9cbiAgICB0aGlzLnJlbmRlck5ld1F1ZXN0aW9uID0gZnVuY3Rpb24gKHFuLCBhLCBncmFkZVN0cmluZykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsIGksIGh0bWwgPSAnJztcbiAgICAgICAgc2VsZi51cGRhdGVEZWJ1Z01lc3NhZ2UobnVsbCwgYS51cmkucmVwbGFjZSgvLipcXC8vLCAnJykpO1xuICAgICAgICAvL1RPRE86IERvIHNvbWUgcHJvcGVyIERPTSBtYW5pcGx1YXRpb24/XG4gICAgICAgIGlmIChxbi50ZXh0KSB7IGh0bWwgKz0gJzxwPicgKyBxbi50ZXh0ICsgJzwvcD4nOyB9XG4gICAgICAgIGh0bWwgKz0gJzxvbCB0eXBlPVwiYVwiPic7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBhLm9yZGVyaW5nLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBodG1sICs9ICc8bGkgaWQ9XCJhbnN3ZXJfJyArIGkgKyAnXCI+JztcbiAgICAgICAgICAgIGh0bWwgKz0gJzxsYWJlbCBjbGFzcz1cInJhZGlvXCI+JztcbiAgICAgICAgICAgIGh0bWwgKz0gJzxpbnB1dCB0eXBlPVwicmFkaW9cIiBuYW1lPVwiYW5zd2VyXCIgdmFsdWU9XCInICsgaSArICdcIi8+JztcbiAgICAgICAgICAgIGh0bWwgKz0gcW4uY2hvaWNlc1thLm9yZGVyaW5nW2ldXTtcbiAgICAgICAgICAgIGh0bWwgKz0gJzwvbGFiZWw+PC9saT4nO1xuICAgICAgICB9XG4gICAgICAgIGh0bWwgKz0gJzwvb2w+JztcbiAgICAgICAgc2VsZi5qcVF1aXouaHRtbChodG1sKTtcbiAgICAgICAgc2VsZi5qcUdyYWRlLnRleHQoZ3JhZGVTdHJpbmcpO1xuICAgICAgICBzZWxmLnJlbmRlck1hdGgoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKGEuYWxsb3R0ZWRfdGltZSAmJiBhLnF1aXpfdGltZSkge1xuICAgICAgICAgICAgICAgIC8vIEFscmVhZHkgc3RhcnRlZCwgZG9jayBzZWNvbmRzIHNpbmNlIHN0YXJ0ZWRcbiAgICAgICAgICAgICAgICBzZWxmLnRpbWVyU3RhcnQoYS5hbGxvdHRlZF90aW1lIC0gKE1hdGgucm91bmQoKG5ldyBEYXRlKCkpLmdldFRpbWUoKSAvIDEwMDApIC0gYS5xdWl6X3RpbWUpKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYS5hbGxvdHRlZF90aW1lKSB7XG4gICAgICAgICAgICAgICAgc2VsZi50aW1lclN0YXJ0KGEuYWxsb3R0ZWRfdGltZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKiogQW5ub3RhdGUgd2l0aCBjb3JyZWN0IC8gaW5jb3JyZWN0IHNlbGVjdGlvbnMgKi9cbiAgICB0aGlzLnJlbmRlckFuc3dlciA9IGZ1bmN0aW9uIChhLCBhbnN3ZXJEYXRhLCBncmFkZVN0cmluZywgbGFzdEVpZ2h0KSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcywgaTtcbiAgICAgICAgc2VsZi5qcVF1aXouZmluZCgnaW5wdXQnKS5hdHRyKCdkaXNhYmxlZCcsICdkaXNhYmxlZCcpO1xuICAgICAgICBzZWxmLmpxUXVpei5maW5kKCcjYW5zd2VyXycgKyBhLnNlbGVjdGVkX2Fuc3dlcikuYWRkQ2xhc3MoJ3NlbGVjdGVkJyk7XG4gICAgICAgIC8vIE1hcmsgYWxsIGFuc3dlcnMgYXMgY29ycmVjdCAvIGluY29ycmVjdFxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYS5vcmRlcmluZ19jb3JyZWN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBzZWxmLmpxUXVpei5maW5kKCcjYW5zd2VyXycgKyBpKS5hZGRDbGFzcyhhLm9yZGVyaW5nX2NvcnJlY3RbaV0gPyAnY29ycmVjdCcgOiAnaW5jb3JyZWN0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi5qcVF1aXoucmVtb3ZlQ2xhc3MoJ2NvcnJlY3QnKTtcbiAgICAgICAgc2VsZi5qcVF1aXoucmVtb3ZlQ2xhc3MoJ2luY29ycmVjdCcpO1xuICAgICAgICBzZWxmLmpxUXVpei5hZGRDbGFzcyhhLmNvcnJlY3QgPyAnY29ycmVjdCcgOiAnaW5jb3JyZWN0Jyk7XG4gICAgICAgIGlmIChhbnN3ZXJEYXRhLmV4cGxhbmF0aW9uKSB7XG4gICAgICAgICAgICBzZWxmLmpxUXVpei5hcHBlbmQoJCgnPGRpdiBjbGFzcz1cImFsZXJ0IGV4cGxhbmF0aW9uXCI+JyArIGFuc3dlckRhdGEuZXhwbGFuYXRpb24gKyAnPC9kaXY+JykpO1xuICAgICAgICAgICAgc2VsZi5yZW5kZXJNYXRoKCk7XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi5qcUdyYWRlLnRleHQoZ3JhZGVTdHJpbmcpO1xuICAgICAgICB0aGlzLnJlbmRlclByZXZBbnN3ZXJzKGxhc3RFaWdodCk7XG4gICAgfTtcblxuICAgIC8qKiBSZW5kZXIgcHJldmlvdXMgYW5zd2VycyBpbiBhIGxpc3QgYmVsb3cgKi9cbiAgICB0aGlzLnJlbmRlclByZXZBbnN3ZXJzID0gZnVuY3Rpb24gKGxhc3RFaWdodCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgICAgICBqcUxpc3QgPSAkKFwiI3R3LXByZXZpb3VzLWFuc3dlcnNcIikuZmluZCgnb2wnKTtcbiAgICAgICAganFMaXN0LmVtcHR5KCk7XG4gICAgICAgIGpxTGlzdC5hcHBlbmQobGFzdEVpZ2h0Lm1hcChmdW5jdGlvbiAoYSkge1xuICAgICAgICAgICAgdmFyIHQgPSBuZXcgRGF0ZSgwKTtcbiAgICAgICAgICAgIHQuc2V0VVRDU2Vjb25kcyhhLmFuc3dlcl90aW1lKTtcblxuICAgICAgICAgICAgcmV0dXJuICQoJzxsaS8+JylcbiAgICAgICAgICAgICAgICAuYWRkQ2xhc3MoYS5jb3JyZWN0ID8gJ2NvcnJlY3QnIDogJ2luY29ycmVjdCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RpdGxlJyxcbiAgICAgICAgICAgICAgICAgICAgIChhLnNlbGVjdGVkX2Fuc3dlciA/ICdZb3UgY2hvc2UgJyArIFN0cmluZy5mcm9tQ2hhckNvZGUoOTcgKyBhLnNlbGVjdGVkX2Fuc3dlcikgKyAnXFxuJyA6ICcnKSArXG4gICAgICAgICAgICAgICAgICAgICAgJ0Fuc3dlcmVkICcgKyB0LnRvTG9jYWxlRGF0ZVN0cmluZygpICsgJyAnICsgdC50b0xvY2FsZVRpbWVTdHJpbmcoKSlcbiAgICAgICAgICAgICAgICAuYXBwZW5kKCQoJzxzcGFuLz4nKS50ZXh0KGEuY29ycmVjdCA/IFwi4pyUXCIgOiAn4pyXJykpO1xuICAgICAgICB9KSk7XG4gICAgfTtcblxuICAgIHRoaXMucmVuZGVyU3RhcnQgPSBmdW5jdGlvbiAodHV0VXJpLCB0dXRUaXRsZSwgbGVjVXJpLCBsZWNUaXRsZSwgZ3JhZGVTdHJpbmcsIGxhc3RFaWdodCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICQoXCIjdHctdGl0bGVcIikudGV4dCh0dXRUaXRsZSArIFwiIC0gXCIgKyBsZWNUaXRsZSk7XG4gICAgICAgIHNlbGYuanFRdWl6Lmh0bWwoJChcIjxwPkNsaWNrICdOZXcgcXVlc3Rpb24nIHRvIHN0YXJ0IHlvdXIgcXVpejwvcD5cIikpO1xuICAgICAgICBzZWxmLmpxR3JhZGUudGV4dChncmFkZVN0cmluZyk7XG4gICAgICAgIHRoaXMucmVuZGVyUHJldkFuc3dlcnMobGFzdEVpZ2h0KTtcbiAgICB9O1xufVxuXG4oZnVuY3Rpb24gKHdpbmRvdywgJCwgdW5kZWZpbmVkKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgdmFyIHF1aXosIHF1aXpWaWV3O1xuICAgIC8vIERvIG5vdGhpbmcgaWYgbm90IG9uIHRoZSByaWdodCBwYWdlXG4gICAgaWYgKCQoJ2JvZHkucXVpei1xdWl6JykubGVuZ3RoID09PSAwKSB7IHJldHVybjsgfVxuXG4gICAgLyoqIENhbGwgYW4gYXJyYXkgb2YgQWpheCBjYWxscywgc3BsaWNpbmcgaW4gZXh0cmEgb3B0aW9ucywgb25Qcm9ncmVzcyBjYWxsZWQgb24gZWFjaCBzdWNjZXNzLCBvbkRvbmUgYXQgZW5kICovXG4gICAgZnVuY3Rpb24gY2FsbEFqYXgoY2FsbHMsIGV4dHJhLCBvblByb2dyZXNzLCBvbkRvbmUpIHtcbiAgICAgICAgdmFyIGRmZHMgPSBjYWxscy5tYXAoZnVuY3Rpb24gKGEpIHtcbiAgICAgICAgICAgIHJldHVybiAkLmFqYXgoJC5leHRlbmQoe30sIGEsIGV4dHJhKSk7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoZGZkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIG9uRG9uZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGZkcy5tYXAoZnVuY3Rpb24gKGQpIHsgZC5kb25lKG9uUHJvZ3Jlc3MpOyB9KTtcbiAgICAgICAgICAgICQud2hlbi5hcHBseShudWxsLCBkZmRzKS5kb25lKG9uRG9uZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDYXRjaCBhbnkgdW5jYXVnaHQgZXhjZXB0aW9uc1xuICAgIHdpbmRvdy5vbmVycm9yID0gZnVuY3Rpb24gKG1lc3NhZ2UsIHVybCwgbGluZW51bWJlcikge1xuICAgICAgICBxdWl6Vmlldy51cGRhdGVTdGF0ZShcImVycm9yXCIsIFwiSW50ZXJuYWwgZXJyb3I6IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiIChcIiArIHVybCArIFwiOlwiICsgbGluZW51bWJlciArIFwiKVwiKTtcbiAgICB9O1xuXG4gICAgLy8gV2lyZSB1cCBxdWl6IG9iamVjdFxuICAgIHF1aXpWaWV3ID0gbmV3IFF1aXpWaWV3KCQsICQoJyN0dy1xdWl6JyksICQoJyN0dy10aW1lcicpLCAkKCcjdHctcHJvY2VlZCcpLCAkKCcjdHctZmluaXNoJyksICQoJyN0dy1kZWJ1Z21lc3NhZ2UnKSk7XG4gICAgcXVpeiA9IG5ldyBRdWl6KGxvY2FsU3RvcmFnZSwgZnVuY3Rpb24gKG1lc3NhZ2UsIGVuY29kaW5nKSB7XG4gICAgICAgIHF1aXpWaWV3LnVwZGF0ZVN0YXRlKFwiZXJyb3JcIiwgbWVzc2FnZSwgZW5jb2RpbmcpO1xuICAgIH0pO1xuXG4gICAgLy8gQ29tcGxhaW4gaWYgdGhlcmUncyBubyBsb2NhbHN0b3JhZ2VcbiAgICBpZiAoIXdpbmRvdy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgcXVpelZpZXcudXBkYXRlU3RhdGUoXCJlcnJvclwiLCBcIlNvcnJ5LCB3ZSBkbyBub3Qgc3VwcG9ydCB5b3VyIGJyb3dzZXJcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAod2luZG93LmFwcGxpY2F0aW9uQ2FjaGUpIHtcbiAgICAgICAgLy8gVHJpZ2dlciByZWxvYWQgaWYgbmVlZGVkXG4gICAgICAgIHdpbmRvdy5hcHBsaWNhdGlvbkNhY2hlLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZXJlYWR5JywgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIGlmICh3aW5kb3cuYXBwbGljYXRpb25DYWNoZS5zdGF0dXMgIT09IHdpbmRvdy5hcHBsaWNhdGlvbkNhY2hlLlVQREFURVJFQURZKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcXVpelZpZXcudXBkYXRlU3RhdGUoXCJyZWxvYWRcIiwgJ0EgbmV3IHZlcnNpb24gaXMgYXZhaWFibGUsIGNsaWNrIFwiUmVzdGFydCBxdWl6XCInKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gSGl0dGluZyB0aGUgYnV0dG9uIG1vdmVzIG9uIHRvIHRoZSBuZXh0IHN0YXRlIGluIHRoZSBzdGF0ZSBtYWNoaW5lXG4gICAgJCgnI3R3LXByb2NlZWQnKS5iaW5kKCdjbGljaycsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBxdWl6Vmlldy50aW1lclN0b3AoKTtcbiAgICAgICAgaWYgKCQodGhpcykuaGFzQ2xhc3MoXCJkaXNhYmxlZFwiKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHN3aXRjaCAoJChkb2N1bWVudCkuZGF0YSgndHctc3RhdGUnKSkge1xuICAgICAgICBjYXNlICdwcm9jZXNzaW5nJzpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgIGNhc2UgJ3JlbG9hZCc6XG4gICAgICAgICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKGZhbHNlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICduZXh0cW4nOlxuICAgICAgICAgICAgLy8gVXNlciByZWFkeSBmb3IgbmV4dCBxdWVzdGlvblxuICAgICAgICAgICAgcXVpelZpZXcudXBkYXRlU3RhdGUoXCJwcm9jZXNzaW5nXCIpO1xuICAgICAgICAgICAgcXVpei5nZXROZXdRdWVzdGlvbigkKCcjdHctcHJhY3RpY2UnKS5oYXNDbGFzcyhcImFjdGl2ZVwiKSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHF1aXpWaWV3LnJlbmRlck5ld1F1ZXN0aW9uLmFwcGx5KHF1aXpWaWV3LCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIHF1aXpWaWV3LnVwZGF0ZVN0YXRlKCdpbnRlcnJvZ2F0ZScpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnaW50ZXJyb2dhdGUnOlxuICAgICAgICAgICAgLy8gRGlzYWJsZSBhbGwgY29udHJvbHMgYW5kIG1hcmsgYW5zd2VyXG4gICAgICAgICAgICBxdWl6Vmlldy51cGRhdGVTdGF0ZShcInByb2Nlc3NpbmdcIik7XG4gICAgICAgICAgICBxdWl6LnNldFF1ZXN0aW9uQW5zd2VyKHBhcnNlSW50KCQoJ2lucHV0OnJhZGlvW25hbWU9YW5zd2VyXTpjaGVja2VkJykudmFsKCksIDEwKSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHF1aXpWaWV3LnJlbmRlckFuc3dlci5hcHBseShxdWl6VmlldywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICBxdWl6Vmlldy51cGRhdGVTdGF0ZSgnbmV4dHFuJyk7XG4gICAgICAgICAgICAgICAgLy9UT0RPOiBFZ2gsIG11c3QgYmUgYSBjbGVhbmVyIHdheVxuICAgICAgICAgICAgICAgIHF1aXpWaWV3LnN5bmNTdGF0ZSgnZGVmYXVsdCcpO1xuICAgICAgICAgICAgICAgICQoJyN0dy1zeW5jJykudHJpZ2dlcignY2xpY2snLCAnbm9mb3JjZScpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHF1aXpWaWV3LnVwZGF0ZVN0YXRlKCdlcnJvcicsIFwiRXJyb3I6IFF1aXogaW4gdW5rb3duIHN0YXRlXCIpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAkKCcjdHctcHJhY3RpY2UnKS5iaW5kKCdjbGljaycsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsIGpxVGhpcyA9ICQodGhpcyk7XG4gICAgICAgIGlmIChqcVRoaXMuYXR0cihcImRpc2FibGVkXCIpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGpxVGhpcy5oYXNDbGFzcyhcImFjdGl2ZVwiKSkge1xuICAgICAgICAgICAganFUaGlzLnJlbW92ZUNsYXNzKFwiYWN0aXZlXCIpO1xuICAgICAgICAgICAgJCgnZGl2LnN0YXR1cycpLnJlbW92ZUNsYXNzKFwicHJhY3RpY2VcIik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBqcVRoaXMuYWRkQ2xhc3MoXCJhY3RpdmVcIik7XG4gICAgICAgICAgICAkKCdkaXYuc3RhdHVzJykuYWRkQ2xhc3MoXCJwcmFjdGljZVwiKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgJCgnI3R3LWZpbmlzaCcpLmJpbmQoJ2NsaWNrJywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIGlmICgkKHRoaXMpLmF0dHIoXCJkaXNhYmxlZFwiKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAkKCcjdHctc3luYycpLmJpbmQoJ2NsaWNrJywgZnVuY3Rpb24gKGV2ZW50LCBub0ZvcmNlKSB7XG4gICAgICAgIHZhciBzeW5jQ2FsbDtcblxuICAgICAgICBmdW5jdGlvbiBvbkVycm9yKGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93bikge1xuICAgICAgICAgICAgaWYgKGpxWEhSLnN0YXR1cyA9PT0gNDAxIHx8IGpxWEhSLnN0YXR1cyA9PT0gNDAzKSB7XG4gICAgICAgICAgICAgICAgcXVpelZpZXcuc3luY1N0YXRlKCd1bmF1dGgnKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcXVpelZpZXcuc3luY1N0YXRlKCdlcnJvcicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHF1aXpWaWV3LnN5bmNTdGF0ZSgpID09PSAncHJvY2Vzc2luZycpIHtcbiAgICAgICAgICAgIC8vIERvbid0IHdhbnQgdG8gcmVwZWF0ZWRseSBzeW5jXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHF1aXpWaWV3LnN5bmNTdGF0ZSgpID09PSAndW5hdXRoJykge1xuICAgICAgICAgICAgd2luZG93Lm9wZW4ocXVpei5wb3J0YWxSb290VXJsKGRvY3VtZW50LmxvY2F0aW9uKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAnL2xvZ2luP2NhbWVfZnJvbT0nICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuY29kZVVSSUNvbXBvbmVudChkb2N1bWVudC5sb2NhdGlvbi5wYXRobmFtZS5yZXBsYWNlKC9cXC9cXHcrXFwuaHRtbCQvLCAnL2Nsb3NlLmh0bWwnKSksXG4gICAgICAgICAgICAgICAgICAgICAgIFwibG9naW53aW5kb3dcIik7XG4gICAgICAgICAgICBxdWl6Vmlldy5zeW5jU3RhdGUoJ2RlZmF1bHQnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBxdWl6Vmlldy5zeW5jU3RhdGUoJ3Byb2Nlc3NpbmcnKTtcbiAgICAgICAgaWYgKCF3aW5kb3cubmF2aWdhdG9yLm9uTGluZSkge1xuICAgICAgICAgICAgcXVpelZpZXcuc3luY1N0YXRlKCdvZmZsaW5lJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGZXRjaCBBSkFYIGNhbGxcbiAgICAgICAgc3luY0NhbGwgPSBxdWl6LnN5bmNMZWN0dXJlKCFub0ZvcmNlKTtcbiAgICAgICAgaWYgKHN5bmNDYWxsID09PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBTeW5jIHNheXMgdGhlcmUncyBub3RoaW5nIHRvIGRvXG4gICAgICAgICAgICBxdWl6Vmlldy5zeW5jU3RhdGUoJ2RlZmF1bHQnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN5bmMgY3VycmVudCBsZWN0dXJlIGFuZCBpdCdzIHF1ZXN0aW9uc1xuICAgICAgICBjYWxsQWpheChbc3luY0NhbGxdLCB7ZXJyb3I6IG9uRXJyb3J9LCBudWxsLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjYWxsQWpheChxdWl6LnN5bmNRdWVzdGlvbnMoKSwge2Vycm9yOiBvbkVycm9yfSwgbnVsbCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHF1aXpWaWV3LnN5bmNTdGF0ZSgnb25saW5lJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gICAgcXVpelZpZXcuc3luY1N0YXRlKCdkZWZhdWx0Jyk7XG5cbiAgICAvLyBMb2FkIHRoZSBsZWN0dXJlIHJlZmVyZW5jZWQgaW4gVVJMLCBpZiBzdWNjZXNzZnVsIGhpdCB0aGUgYnV0dG9uIHRvIGdldCBmaXJzdCBxdWVzdGlvbi5cbiAgICBxdWl6LnNldEN1cnJlbnRMZWN0dXJlKHF1aXoucGFyc2VRUyh3aW5kb3cubG9jYXRpb24pLCBmdW5jdGlvbiAodHV0VXJpLCB0dXRUaXRsZSwgbGVjVXJpLCBsZWNUaXRsZSwgZ3JhZGUsIGxhc3RFaWdodCkge1xuICAgICAgICBxdWl6Vmlldy51cGRhdGVEZWJ1Z01lc3NhZ2UobGVjVXJpLCAnJyk7XG4gICAgICAgIHF1aXpWaWV3LnJlbmRlclN0YXJ0LmFwcGx5KHF1aXpWaWV3LCBhcmd1bWVudHMpO1xuICAgICAgICBxdWl6Vmlldy51cGRhdGVTdGF0ZShcIm5leHRxblwiKTtcbiAgICB9KTtcblxufSh3aW5kb3csIGpRdWVyeSkpO1xuIiwiLypqc2xpbnQgbm9tZW46IHRydWUsIHBsdXNwbHVzOiB0cnVlLCBicm93c2VyOnRydWUqL1xudmFyIGlhYWxpYiA9IG5ldyAocmVxdWlyZSgnLi9pYWEuanMnKSkoKTtcblxuLyoqXG4gICogTWFpbiBxdWl6IG9iamVjdFxuICAqICByYXdMb2NhbFN0b3JhZ2U6IEJyb3dzZXIgbG9jYWwgc3RvcmFnZSBvYmplY3RcbiAgKiAgaGFuZGxlRXJyb3I6IEZ1bmN0aW9uIHRoYXQgZGlzcGxheXMgZXJyb3IgbWVzc2FnZSB0byB1c2VyXG4gICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIFF1aXoocmF3TG9jYWxTdG9yYWdlLCBoYW5kbGVFcnJvcikge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIHRoaXMuaGFuZGxlRXJyb3IgPSBoYW5kbGVFcnJvcjtcbiAgICB0aGlzLnR1dG9yaWFsVXJpID0gbnVsbDtcbiAgICB0aGlzLmN1clR1dG9yaWFsID0gbnVsbDtcbiAgICB0aGlzLmxlY0luZGV4ID0gbnVsbDtcblxuICAgIC8vIFdyYXBwZXIgdG8gbGV0IGxvY2Fsc3RvcmFnZSB0YWtlIEpTT05cbiAgICBmdW5jdGlvbiBKU09OTG9jYWxTdG9yYWdlKGJhY2tpbmcsIG9uUXVvdGFFeGNlZWRlZCkge1xuICAgICAgICB0aGlzLmJhY2tpbmcgPSBiYWNraW5nO1xuXG4gICAgICAgIHRoaXMucmVtb3ZlSXRlbSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBiYWNraW5nLnJlbW92ZUl0ZW0oa2V5KTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmdldEl0ZW0gPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBiYWNraW5nLmdldEl0ZW0oa2V5KTtcbiAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKHZhbHVlKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLnNldEl0ZW0gPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBiYWNraW5nLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeSh2YWx1ZSkpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGlmIChlLm5hbWUudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdxdW90YScpID4gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgb25RdW90YUV4Y2VlZGVkKGtleSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmxpc3RJdGVtcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBpLCBvdXQgPSBbXTtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBiYWNraW5nLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgb3V0LnB1c2goYmFja2luZy5rZXkoaSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG91dDtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgdGhpcy5scyA9IG5ldyBKU09OTG9jYWxTdG9yYWdlKHJhd0xvY2FsU3RvcmFnZSwgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICBoYW5kbGVFcnJvcignTm8gbW9yZSBsb2NhbCBzdG9yYWdlIGF2YWlsYWJsZS4gUGxlYXNlIDxhIGhyZWY9XCJzdGFydC5odG1sXCI+cmV0dXJuIHRvIHRoZSBtZW51PC9hPiBhbmQgZGVsZXRlIHNvbWUgdHV0b3JpYWxzIHlvdSBhcmUgbm8gbG9uZ2VyIHVzaW5nLicsICdodG1sJyk7XG4gICAgfSk7XG5cbiAgICAvKiogUmVtb3ZlIHR1dG9yaWFsIGZyb20gbG9jYWxTdG9yYWdlLCBpbmNsdWRpbmcgYWxsIGxlY3R1cmVzLCByZXR1cm4gdHJ1ZSBpZmYgc3VjY2Vzc2Z1bCAqL1xuICAgIHRoaXMucmVtb3ZlVHV0b3JpYWwgPSBmdW5jdGlvbiAodHV0VXJpKSB7XG4gICAgICAgIHZhciBpLCBqLCBsZWN0dXJlcywgcXVlc3Rpb25zLCB0d0luZGV4LCBzZWxmID0gdGhpcztcblxuICAgICAgICAvLyBSZW1vdmUgcXVlc3Rpb24gb2JqZWN0cyBhc3NvY2lhdGVkIHdpdGggdGhpcyB0dXRvcmlhbFxuICAgICAgICBsZWN0dXJlcyA9IHNlbGYubHMuZ2V0SXRlbSh0dXRVcmkpLmxlY3R1cmVzO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVjdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHF1ZXN0aW9ucyA9IGxlY3R1cmVzW2ldLnF1ZXN0aW9ucztcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBsZWN0dXJlc1tpXS5xdWVzdGlvbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxzLnJlbW92ZUl0ZW0obGVjdHVyZXNbaV0ucXVlc3Rpb25zW2pdLnVyaSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZW1vdmUgdHV0b3JpYWwsIGFuZCByZWZlcmVuY2UgaW4gaW5kZXhcbiAgICAgICAgdGhpcy5scy5yZW1vdmVJdGVtKHR1dFVyaSk7XG4gICAgICAgIHR3SW5kZXggPSBzZWxmLmxzLmdldEl0ZW0oJ19pbmRleCcpO1xuICAgICAgICBpZiAoIXR3SW5kZXgpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgICAgIGRlbGV0ZSB0d0luZGV4W3R1dFVyaV07XG4gICAgICAgIHJldHVybiAhIShzZWxmLmxzLnNldEl0ZW0oJ19pbmRleCcsIHR3SW5kZXgpKTtcbiAgICB9O1xuXG4gICAgLyoqIEluc2VydCBxdWVzdGlvbnMgaW50byBsb2NhbFN0b3JhZ2UgKi9cbiAgICB0aGlzLmluc2VydFF1ZXN0aW9ucyA9IGZ1bmN0aW9uIChxbnMsIG9uU3VjY2Vzcykge1xuICAgICAgICB2YXIgaSwgcW5VcmlzID0gT2JqZWN0LmtleXMocW5zKTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHFuVXJpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmxzLnNldEl0ZW0ocW5VcmlzW2ldLCBxbnNbcW5VcmlzW2ldXSkpIHsgcmV0dXJuOyB9XG4gICAgICAgIH1cbiAgICAgICAgb25TdWNjZXNzKCk7XG4gICAgfTtcblxuICAgIC8qKiBSZXR1cm4gZGVlcCBhcnJheSBvZiBsZWN0dXJlcyBhbmQgdGhlaXIgVVJJcyAqL1xuICAgIHRoaXMuZ2V0QXZhaWxhYmxlTGVjdHVyZXMgPSBmdW5jdGlvbiAob25TdWNjZXNzKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcywgaywgdCxcbiAgICAgICAgICAgIHR1dG9yaWFscyA9IFtdLFxuICAgICAgICAgICAgdHdJbmRleCA9IHNlbGYubHMuZ2V0SXRlbSgnX2luZGV4Jyk7XG5cbiAgICAgICAgZnVuY3Rpb24gbGVjVG9PYmplY3QobCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBcInVyaVwiOiBzZWxmLnF1aXpVcmwoaywgbC51cmkpLFxuICAgICAgICAgICAgICAgIFwidGl0bGVcIjogbC50aXRsZSxcbiAgICAgICAgICAgICAgICBcImdyYWRlXCI6IHNlbGYuZ3JhZGVTdHJpbmcoQXJyYXkubGFzdChsLmFuc3dlclF1ZXVlKSlcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgLyoganNoaW50IGlnbm9yZTpzdGFydCAqLyAvLyBodHRwczovL2dpdGh1Yi5jb20vanNoaW50L2pzaGludC9pc3N1ZXMvMTAxNlxuICAgICAgICBmb3IgKGsgaW4gdHdJbmRleCkge1xuICAgICAgICAvKiBqc2hpbnQgaWdub3JlOmVuZCAqL1xuICAgICAgICAgICAgaWYgKHR3SW5kZXguaGFzT3duUHJvcGVydHkoaykpIHtcbiAgICAgICAgICAgICAgICB0ID0gc2VsZi5scy5nZXRJdGVtKGspO1xuICAgICAgICAgICAgICAgIHR1dG9yaWFscy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgXCJ1cmlcIjogayxcbiAgICAgICAgICAgICAgICAgICAgXCJ0aXRsZVwiOiB0LnRpdGxlLFxuICAgICAgICAgICAgICAgICAgICBcImxlY3R1cmVzXCI6IHQubGVjdHVyZXMubWFwKGxlY1RvT2JqZWN0KSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvL1RPRE86IFNvcnQgdHV0b3JpYWxzP1xuICAgICAgICBvblN1Y2Nlc3ModHV0b3JpYWxzKTtcbiAgICB9O1xuXG4gICAgLyoqIFNldCB0aGUgY3VycmVudCB0dXRvcmlhbC9sZWN0dXJlICovXG4gICAgdGhpcy5zZXRDdXJyZW50TGVjdHVyZSA9IGZ1bmN0aW9uIChwYXJhbXMsIG9uU3VjY2Vzcykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsIGksIGxlY3R1cmU7XG4gICAgICAgIGlmICghKHBhcmFtcy50dXRVcmkgJiYgcGFyYW1zLmxlY1VyaSkpIHtcbiAgICAgICAgICAgIHNlbGYuaGFuZGxlRXJyb3IoXCJNaXNzaW5nIGxlY3R1cmUgcGFyYW1ldGVyczogdHV0VXJpLCBwYXJhbXMubGVjVXJpXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmluZCB0dXRvcmlhbFxuICAgICAgICBzZWxmLmN1clR1dG9yaWFsID0gc2VsZi5scy5nZXRJdGVtKHBhcmFtcy50dXRVcmkpO1xuICAgICAgICBpZiAoIXNlbGYuY3VyVHV0b3JpYWwpIHtcbiAgICAgICAgICAgIHNlbGYuaGFuZGxlRXJyb3IoXCJVbmtub3duIHR1dG9yaWFsOiBcIiArIHBhcmFtcy50dXRVcmkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYudHV0b3JpYWxVcmkgPSBwYXJhbXMudHV0VXJpO1xuXG4gICAgICAgIC8vIEZpbmQgbGVjdHVyZSB3aXRoaW4gdHV0b3JpYWxcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHNlbGYuY3VyVHV0b3JpYWwubGVjdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGxlY3R1cmUgPSBzZWxmLmN1clR1dG9yaWFsLmxlY3R1cmVzW2ldO1xuICAgICAgICAgICAgaWYgKGxlY3R1cmUudXJpID09PSBwYXJhbXMubGVjVXJpKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5sZWNJbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgaWFhbGliLmdyYWRlQWxsb2NhdGlvbihsZWN0dXJlLnNldHRpbmdzLCBzZWxmLmN1ckFuc3dlclF1ZXVlKCkpO1xuICAgICAgICAgICAgICAgIHJldHVybiBvblN1Y2Nlc3MoXG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy50dXRVcmksXG4gICAgICAgICAgICAgICAgICAgIHNlbGYuY3VyVHV0b3JpYWwudGl0bGUsXG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy5sZWNVcmksXG4gICAgICAgICAgICAgICAgICAgIGxlY3R1cmUudGl0bGUsXG4gICAgICAgICAgICAgICAgICAgIHNlbGYuZ3JhZGVTdHJpbmcoQXJyYXkubGFzdChsZWN0dXJlLmFuc3dlclF1ZXVlKSksXG4gICAgICAgICAgICAgICAgICAgIHNlbGYubGFzdEVpZ2h0KClcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHNlbGYuaGFuZGxlRXJyb3IoXCJMZWN0dXJlIFwiICsgcGFyYW1zLmxlY1VyaSArIFwibm90IHBhcnQgb2YgY3VycmVudCB0dXRvcmlhbFwiKTtcbiAgICB9O1xuXG4gICAgLyoqIFJldHVybiB0aGUgY3VycmVudCBsZWN0dXJlICovXG4gICAgdGhpcy5nZXRDdXJyZW50TGVjdHVyZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAoc2VsZi5sZWNJbmRleCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgXCJObyBsZWN0dXJlIHNlbGVjdGVkXCI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNlbGYuY3VyVHV0b3JpYWwubGVjdHVyZXNbc2VsZi5sZWNJbmRleF07XG4gICAgfTtcblxuICAgIC8qKiBSZXR1cm4gdGhlIGFuc3dlciBxdWV1ZSBmb3IgdGhlIGN1cnJlbnQgbGVjdHVyZSAqL1xuICAgIHRoaXMuY3VyQW5zd2VyUXVldWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcywgY3VyTGVjdHVyZSA9IHNlbGYuZ2V0Q3VycmVudExlY3R1cmUoKTtcbiAgICAgICAgaWYgKCFjdXJMZWN0dXJlLmFuc3dlclF1ZXVlKSB7XG4gICAgICAgICAgICBjdXJMZWN0dXJlLmFuc3dlclF1ZXVlID0gW107XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGN1ckxlY3R1cmUuYW5zd2VyUXVldWU7XG4gICAgfTtcblxuICAgIC8qKiBSZXR1cm4gbGFzdCBlaWdodCBub24tcHJhY3RpY2UgcXVlc3Rpb25zIGluIHJldmVyc2Ugb3JkZXIgKi9cbiAgICB0aGlzLmxhc3RFaWdodCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLCBpLCBhLFxuICAgICAgICAgICAgYW5zd2VyUXVldWUgPSBzZWxmLmN1ckFuc3dlclF1ZXVlKCksXG4gICAgICAgICAgICBvdXQgPSBbXTtcblxuICAgICAgICBmb3IgKGkgPSBhbnN3ZXJRdWV1ZS5sZW5ndGg7IGkgPiAwOyBpLS0pIHtcbiAgICAgICAgICAgIGEgPSBhbnN3ZXJRdWV1ZVtpIC0gMV07XG4gICAgICAgICAgICBpZiAoYS5hbnN3ZXJfdGltZSAmJiAhYS5wcmFjdGljZSkge1xuICAgICAgICAgICAgICAgIG91dC5wdXNoKGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG91dC5sZW5ndGggPj0gOCkgeyByZXR1cm4gb3V0OyB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dDtcbiAgICB9O1xuXG4gICAgLyoqIENob29zZSBhIG5ldyBxdWVzdGlvbiBmcm9tIHRoZSBjdXJyZW50IHR1dG9yaWFsL2xlY3R1cmUgKi9cbiAgICB0aGlzLmdldE5ld1F1ZXN0aW9uID0gZnVuY3Rpb24gKHByYWN0aWNlTW9kZSwgb25TdWNjZXNzKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcywgYSwgYW5zd2VyUXVldWUgPSBzZWxmLmN1ckFuc3dlclF1ZXVlKCk7XG5cbiAgICAgICAgaWYgKGFuc3dlclF1ZXVlLmxlbmd0aCA9PT0gMCB8fCBBcnJheS5sYXN0KGFuc3dlclF1ZXVlKS5hbnN3ZXJfdGltZSkge1xuICAgICAgICAgICAgLy8gQXNzaWduIG5ldyBxdWVzdGlvbiBpZiBsYXN0IGhhcyBiZWVuIGFuc3dlcmVkXG4gICAgICAgICAgICBhID0gaWFhbGliLm5ld0FsbG9jYXRpb24oc2VsZi5jdXJUdXRvcmlhbCwgc2VsZi5sZWNJbmRleCwgYW5zd2VyUXVldWUsIHByYWN0aWNlTW9kZSk7XG4gICAgICAgICAgICBpZiAoIWEpIHtcbiAgICAgICAgICAgICAgICBzZWxmLmhhbmRsZUVycm9yKFwiTGVjdHVyZSBoYXMgbm8gcXVlc3Rpb25zIVwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhbnN3ZXJRdWV1ZS5wdXNoKGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gR2V0IHF1ZXN0aW9uIGRhdGEgdG8gZ28gd2l0aCBsYXN0IHF1ZXN0aW9uIG9uIHF1ZXVlXG4gICAgICAgICAgICBhID0gQXJyYXkubGFzdChhbnN3ZXJRdWV1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBzZWxmLmdldFF1ZXN0aW9uRGF0YShhLnVyaSwgZnVuY3Rpb24gKHFuKSB7XG4gICAgICAgICAgICAvLyBHZW5lcmF0ZSBvcmRlcmluZywgZmllbGQgdmFsdWUgLT4gaW50ZXJuYWwgdmFsdWVcbiAgICAgICAgICAgIGEub3JkZXJpbmcgPSBhLm9yZGVyaW5nIHx8IEFycmF5LnNodWZmbGUocW4uc2h1ZmZsZSB8fCBbXSk7XG4gICAgICAgICAgICB3aGlsZSAoYS5vcmRlcmluZy5sZW5ndGggPCBxbi5jaG9pY2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIC8vIFBhZCBvdXQgb3JkZXJpbmcgd2l0aCBtaXNzaW5nIGl0ZW1zIG9uIGVuZFxuICAgICAgICAgICAgICAgIC8vTkI6IEFzc3VtaW5nIHRoYXQgeW91IGNhbid0IGhhdmUgZml4ZWQgaXRlbXMgYW55d2hlcmUgZWxzZSBmb3Igbm93LlxuICAgICAgICAgICAgICAgIGEub3JkZXJpbmcucHVzaChhLm9yZGVyaW5nLmxlbmd0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhLnF1aXpfdGltZSA9IGEucXVpel90aW1lIHx8IE1hdGgucm91bmQoKG5ldyBEYXRlKCkpLmdldFRpbWUoKSAvIDEwMDApO1xuICAgICAgICAgICAgYS5zeW5jZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmIChzZWxmLmxzLnNldEl0ZW0oc2VsZi50dXRvcmlhbFVyaSwgc2VsZi5jdXJUdXRvcmlhbCkpIHsgb25TdWNjZXNzKHFuLCBhLCBzZWxmLmdyYWRlU3RyaW5nKGEpKTsgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqIFJldHVybiB0aGUgZnVsbCBkYXRhIGZvciBhIHF1ZXN0aW9uICovXG4gICAgdGhpcy5nZXRRdWVzdGlvbkRhdGEgPSBmdW5jdGlvbiAodXJpLCBvblN1Y2Nlc3MpIHtcbiAgICAgICAgdmFyIHFuLCBzZWxmID0gdGhpcztcbiAgICAgICAgcW4gPSBzZWxmLmxzLmdldEl0ZW0odXJpKTtcbiAgICAgICAgaWYgKCFxbikge1xuICAgICAgICAgICAgc2VsZi5oYW5kbGVFcnJvcihcIkNhbm5vdCBmaW5kIHF1ZXN0aW9uIFwiICsgdXJpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9uU3VjY2Vzcyhxbik7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqIFVzZXIgaGFzIHNlbGVjdGVkIGFuIGFuc3dlciAqL1xuICAgIHRoaXMuc2V0UXVlc3Rpb25BbnN3ZXIgPSBmdW5jdGlvbiAoc2VsZWN0ZWRBbnN3ZXIsIG9uU3VjY2Vzcykge1xuICAgICAgICAvLyBGZXRjaCBxdWVzdGlvbiBvZmYgYW5zd2VyIHF1ZXVlLCBhZGQgYW5zd2VyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcywgYW5zd2VyRGF0YSwgYSA9IEFycmF5Lmxhc3Qoc2VsZi5jdXJBbnN3ZXJRdWV1ZSgpKTtcbiAgICAgICAgYS5hbnN3ZXJfdGltZSA9IE1hdGgucm91bmQoKG5ldyBEYXRlKCkpLmdldFRpbWUoKSAvIDEwMDApO1xuICAgICAgICBhLnNlbGVjdGVkX2Fuc3dlciA9IHNlbGVjdGVkQW5zd2VyO1xuICAgICAgICBhLnN0dWRlbnRfYW5zd2VyID0gYS5vcmRlcmluZ1tzZWxlY3RlZEFuc3dlcl07XG4gICAgICAgIGEuc3luY2VkID0gZmFsc2U7XG5cbiAgICAgICAgLy8gTWFyayB0aGVpciB3b3JrXG4gICAgICAgIHNlbGYuZ2V0UXVlc3Rpb25EYXRhKGEudXJpLCBmdW5jdGlvbiAocW4pIHtcbiAgICAgICAgICAgIHZhciBpLFxuICAgICAgICAgICAgICAgIGN1ckxlY3R1cmUgPSBzZWxmLmdldEN1cnJlbnRMZWN0dXJlKCksXG4gICAgICAgICAgICAgICAgYW5zd2VyRGF0YSA9IHR5cGVvZiBxbi5hbnN3ZXIgPT09ICdzdHJpbmcnID8gSlNPTi5wYXJzZSh3aW5kb3cuYXRvYihxbi5hbnN3ZXIpKSA6IHFuLmFuc3dlcjtcbiAgICAgICAgICAgIC8vIEdlbmVyYXRlIGFycmF5IHNob3dpbmcgd2hpY2ggYW5zd2VycyB3ZXJlIGNvcnJlY3RcbiAgICAgICAgICAgIGEub3JkZXJpbmdfY29ycmVjdCA9IGEub3JkZXJpbmcubWFwKGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFuc3dlckRhdGEuY29ycmVjdC5pbmRleE9mKHYpID4gLTE7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIC8vIFN0dWRlbnQgY29ycmVjdCBpZmYgdGhlaXIgYW5zd2VyIGlzIGluIGxpc3RcbiAgICAgICAgICAgIGEuY29ycmVjdCA9IGFuc3dlckRhdGEuY29ycmVjdC5pbmRleE9mKGEuc3R1ZGVudF9hbnN3ZXIpID4gLTE7XG5cbiAgICAgICAgICAgIC8vIFNldCBhcHByb3ByaWF0ZSBncmFkZVxuICAgICAgICAgICAgaWFhbGliLmdyYWRlQWxsb2NhdGlvbihjdXJMZWN0dXJlLnNldHRpbmdzLCBzZWxmLmN1ckFuc3dlclF1ZXVlKCkpO1xuICAgICAgICAgICAgYS5sZWNfYW5zd2VyZWQgPSAoYS5sZWNfYW5zd2VyZWQgfHwgMCkgKyAxO1xuICAgICAgICAgICAgYS5sZWNfY29ycmVjdCA9IChhLmxlY19jb3JyZWN0IHx8IDApICsgKGEuY29ycmVjdCA/IDEgOiAwKTtcblxuICAgICAgICAgICAgLy8gVXBkYXRlIHF1ZXN0aW9uIHdpdGggbmV3IGNvdW50c1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGN1ckxlY3R1cmUucXVlc3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGEudXJpID09PSBjdXJMZWN0dXJlLnF1ZXN0aW9uc1tpXS51cmkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3VyTGVjdHVyZS5xdWVzdGlvbnNbaV0uY2hvc2VuICs9IDE7XG4gICAgICAgICAgICAgICAgICAgIGN1ckxlY3R1cmUucXVlc3Rpb25zW2ldLmNvcnJlY3QgKz0gYS5jb3JyZWN0ID8gMSA6IDA7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNlbGYubHMuc2V0SXRlbShzZWxmLnR1dG9yaWFsVXJpLCBzZWxmLmN1clR1dG9yaWFsKSkge1xuICAgICAgICAgICAgICAgIG9uU3VjY2VzcyhhLCBhbnN3ZXJEYXRhLCBzZWxmLmdyYWRlU3RyaW5nKGEpLCBzZWxmLmxhc3RFaWdodCgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qKiBHbyB0aHJvdWdoIGFsbCB0dXRvcmlhbHMvbGVjdHVyZXMsIHJlbW92ZSBhbnkgbGVjdHVyZXMgdGhhdCBkb24ndCBoYXZlIGFuIG93bmVyICovXG4gICAgdGhpcy5yZW1vdmVVbnVzZWRPYmplY3RzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsIGksIHQsIHEsIGssIHR1dG9yaWFsLCBsZWN0dXJlcyxcbiAgICAgICAgICAgIGxzQ29udGVudCA9IHt9LFxuICAgICAgICAgICAgcmVtb3ZlZEl0ZW1zID0gW10sXG4gICAgICAgICAgICBsc0xpc3QgPSBzZWxmLmxzLmxpc3RJdGVtcygpLFxuICAgICAgICAgICAgdHdJbmRleCA9IHNlbGYubHMuZ2V0SXRlbSgnX2luZGV4Jyk7XG5cbiAgICAgICAgLy8gRm9ybSBvYmplY3Qgb2YgZXZlcnl0aGluZyBpbiBsb2NhbFN0b3JhZ2VcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGxzTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbHNDb250ZW50W2xzTGlzdFtpXV0gPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTWFyayBldmVyeXRoaW5nIHdlIGZpbmQgYSByZWZlcmVuY2UgdG8gd2l0aCAxXG4gICAgICAgIGxzQ29udGVudC5faW5kZXggPSAxO1xuICAgICAgICBmb3IgKHQgaW4gdHdJbmRleCkge1xuICAgICAgICAgICAgaWYgKHR3SW5kZXguaGFzT3duUHJvcGVydHkodCkpIHtcbiAgICAgICAgICAgICAgICB0dXRvcmlhbCA9IHNlbGYubHMuZ2V0SXRlbSh0KTtcbiAgICAgICAgICAgICAgICBpZiAoIXR1dG9yaWFsKSB7IGNvbnRpbnVlOyB9XG4gICAgICAgICAgICAgICAgbHNDb250ZW50W3RdID0gMTtcbiAgICAgICAgICAgICAgICBsZWN0dXJlcyA9IHR1dG9yaWFsLmxlY3R1cmVzO1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZWN0dXJlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHEgaW4gbGVjdHVyZXNbaV0ucXVlc3Rpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGVjdHVyZXNbaV0ucXVlc3Rpb25zLmhhc093blByb3BlcnR5KHEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbHNDb250ZW50W2xlY3R1cmVzW2ldLnF1ZXN0aW9uc1txXS51cmldID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIGFueXRoaW5nIGRpZG4ndCBnZXQgYSByZWZlcmVuY2UsIHJlbW92ZSBpdFxuICAgICAgICBmb3IgKGsgaW4gbHNDb250ZW50KSB7XG4gICAgICAgICAgICBpZiAobHNDb250ZW50Lmhhc093blByb3BlcnR5KGspICYmIGxzQ29udGVudFtrXSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJlbW92ZWRJdGVtcy5wdXNoKGspO1xuICAgICAgICAgICAgICAgIHNlbGYubHMucmVtb3ZlSXRlbShrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVtb3ZlZEl0ZW1zO1xuICAgIH07XG5cbiAgICAvKiogSW5zZXJ0IHR1dG9yaWFsIGludG8gbG9jYWxTdG9yYWdlICovXG4gICAgdGhpcy5pbnNlcnRUdXRvcmlhbCA9IGZ1bmN0aW9uICh0dXRVcmksIHR1dFRpdGxlLCBsZWN0dXJlcykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsIGksIHR3SW5kZXgsXG4gICAgICAgICAgICBvbGRMZWN0dXJlcyA9IHt9O1xuICAgICAgICBzZWxmLmN1clR1dG9yaWFsID0gc2VsZi5scy5nZXRJdGVtKHR1dFVyaSk7XG4gICAgICAgIHNlbGYudHV0b3JpYWxVcmkgPSB0dXRVcmk7XG5cbiAgICAgICAgaWYgKHNlbGYubHMuZ2V0SXRlbSh0dXRVcmkpKSB7XG4gICAgICAgICAgICAvLyBTb3J0IG9sZCBsZWN0dXJlcyBpbnRvIGEgZGljdCBieSBVUklcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBzZWxmLmN1clR1dG9yaWFsLmxlY3R1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgb2xkTGVjdHVyZXNbc2VsZi5jdXJUdXRvcmlhbC5sZWN0dXJlc1tpXS51cmldID0gc2VsZi5jdXJUdXRvcmlhbC5sZWN0dXJlc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFR1dG9yaWFsIGFscmVhZHkgZXhpc3RzLCB1cGRhdGUgZWFjaCBsZWN0dXJlXG4gICAgICAgICAgICBzZWxmLmN1clR1dG9yaWFsLnRpdGxlID0gdHV0VGl0bGU7XG4gICAgICAgICAgICBzZWxmLmN1clR1dG9yaWFsLmxlY3R1cmVzID0gW107XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVjdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAob2xkTGVjdHVyZXNbbGVjdHVyZXNbaV0udXJpXSkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmN1clR1dG9yaWFsLmxlY3R1cmVzLnB1c2gob2xkTGVjdHVyZXNbbGVjdHVyZXNbaV0udXJpXSk7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYubGVjSW5kZXggPSBpO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnVwZGF0ZUxlY3R1cmUobGVjdHVyZXNbaV0sIDApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuY3VyVHV0b3JpYWwubGVjdHVyZXMucHVzaChsZWN0dXJlc1tpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gQWRkIHdob2xlIHR1dG9yaWFsIHRvIGxvY2FsU3RvcmFnZVxuICAgICAgICAgICAgc2VsZi5jdXJUdXRvcmlhbCA9IHsgXCJ0aXRsZVwiOiB0dXRUaXRsZSwgXCJsZWN0dXJlc1wiOiBsZWN0dXJlcyB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICghc2VsZi5scy5zZXRJdGVtKHNlbGYudHV0b3JpYWxVcmksIHNlbGYuY3VyVHV0b3JpYWwpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgaW5kZXggd2l0aCBsaW5rIHRvIGRvY3VtZW50XG4gICAgICAgIHR3SW5kZXggPSBzZWxmLmxzLmdldEl0ZW0oJ19pbmRleCcpIHx8IHt9O1xuICAgICAgICB0d0luZGV4W3R1dFVyaV0gPSAxO1xuICAgICAgICByZXR1cm4gISEoc2VsZi5scy5zZXRJdGVtKCdfaW5kZXgnLCB0d0luZGV4KSk7XG4gICAgfTtcblxuICAgIC8qKiBNZWxkIG5ldyBsZWN0dXJlIHRvZ2V0aGVyIHdpdGggY3VycmVudCAqL1xuICAgIHRoaXMudXBkYXRlTGVjdHVyZSA9IGZ1bmN0aW9uIChuZXdMZWN0dXJlLCBzeW5jaW5nTGVuZ3RoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgICAgIGN1ckxlY3R1cmUgPSBzZWxmLmdldEN1cnJlbnRMZWN0dXJlKCk7XG5cbiAgICAgICAgLy8gRW5zdXJlIGFueSBjb3VudHMgaW4gYW5zd2VyUXVldWUgYXJlIGNvbnNpc3RlbnRcbiAgICAgICAgZnVuY3Rpb24gdXBkYXRlQ291bnRzKGV4dHJhLCBwcmV2KSB7XG4gICAgICAgICAgICB2YXIgaSwgbGVjQW5zd2VyZWQgPSAwLCBsZWNDb3JyZWN0ID0gMDtcbiAgICAgICAgICAgIGlmIChleHRyYS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXh0cmE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZWNBbnN3ZXJlZCA9IHByZXYgPyBwcmV2LmxlY19hbnN3ZXJlZCA6IDA7XG4gICAgICAgICAgICBsZWNDb3JyZWN0ID0gcHJldiA/IHByZXYubGVjX2NvcnJlY3QgOiAwO1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGV4dHJhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbGVjQW5zd2VyZWQgKz0gZXh0cmFbaV0uYW5zd2VyX3RpbWUgPyAxIDogMDtcbiAgICAgICAgICAgICAgICBsZWNDb3JyZWN0ICs9IGV4dHJhW2ldLmNvcnJlY3QgPyAxIDogMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIEFycmF5Lmxhc3QoZXh0cmEpLmxlY19hbnN3ZXJlZCA9IGxlY0Fuc3dlcmVkO1xuICAgICAgICAgICAgQXJyYXkubGFzdChleHRyYSkubGVjX2NvcnJlY3QgPSBsZWNDb3JyZWN0O1xuICAgICAgICAgICAgcmV0dXJuIGV4dHJhO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTWVsZCBhbnN3ZXJRdWV1ZSBmcm9tIHNlcnZlciB3aXRoIGFueSBuZXcgaXRlbXMuXG4gICAgICAgIGN1ckxlY3R1cmUuYW5zd2VyUXVldWUgPSBuZXdMZWN0dXJlLmFuc3dlclF1ZXVlLmNvbmNhdChcbiAgICAgICAgICAgIHVwZGF0ZUNvdW50cyhjdXJMZWN0dXJlLmFuc3dlclF1ZXVlLnNsaWNlKHN5bmNpbmdMZW5ndGgpLCBBcnJheS5sYXN0KG5ld0xlY3R1cmUuYW5zd2VyUXVldWUpKVxuICAgICAgICApO1xuXG4gICAgICAgIC8vIFVwZGF0ZSBsb2NhbCBjb3B5IG9mIGxlY3R1cmVcbiAgICAgICAgY3VyTGVjdHVyZS5zZXR0aW5ncyA9IG5ld0xlY3R1cmUuc2V0dGluZ3M7XG4gICAgICAgIGN1ckxlY3R1cmUucXVlc3Rpb25zID0gbmV3TGVjdHVyZS5xdWVzdGlvbnM7XG4gICAgICAgIGN1ckxlY3R1cmUucmVtb3ZlZF9xdWVzdGlvbnMgPSBuZXdMZWN0dXJlLnJlbW92ZWRfcXVlc3Rpb25zO1xuICAgICAgICByZXR1cm4gc2VsZi5scy5zZXRJdGVtKHNlbGYudHV0b3JpYWxVcmksIHNlbGYuY3VyVHV0b3JpYWwpO1xuICAgIH07XG5cbiAgICAvKiogR2VuZXJhdGUgQUpBWCBjYWxsIHRoYXQgd2lsbCBzeW5jIHRoZSBjdXJyZW50IGxlY3R1cmUgKi9cbiAgICB0aGlzLnN5bmNMZWN0dXJlID0gZnVuY3Rpb24gKGZvcmNlKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcywgc3luY2luZ0xlbmd0aCwgY3VyTGVjdHVyZSA9IHNlbGYuZ2V0Q3VycmVudExlY3R1cmUoKTtcbiAgICAgICAgLy8gUmV0dXJuIHRydWUgaWZmIGV2ZXJ5IGFuc3dlclF1ZXVlIGl0ZW0gaGFzIGJlZW4gc3luY2VkXG4gICAgICAgIGZ1bmN0aW9uIGlzU3luY2VkKGxlY3R1cmUpIHtcbiAgICAgICAgICAgIHZhciBpO1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGxlY3R1cmUuYW5zd2VyUXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIWxlY3R1cmUuYW5zd2VyUXVldWVbaV0uc3luY2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWZvcmNlICYmIGlzU3luY2VkKGN1ckxlY3R1cmUpKSB7XG4gICAgICAgICAgICAvLyBOb3RoaW5nIHRvIGRvLCBzdG9wLlxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBOb3RlIGhvdyBsb25nIHF1ZXVlIGlzIG5vdywgc28gd2UgZG9uJ3QgbG9vc2UgcXVlc3Rpb25zIGluIHByb2dyZXNzXG4gICAgICAgIHN5bmNpbmdMZW5ndGggPSBjdXJMZWN0dXJlLmFuc3dlclF1ZXVlLmxlbmd0aDtcbiAgICAgICAgd2hpbGUgKHN5bmNpbmdMZW5ndGggPiAwICYmICFjdXJMZWN0dXJlLmFuc3dlclF1ZXVlW3N5bmNpbmdMZW5ndGggLSAxXS5hbnN3ZXJfdGltZSkge1xuICAgICAgICAgICAgLy8gTGFzdCBpdGVtIGhhc24ndCBiZWVuIGFuc3dlcmVkIHlldCwgbGVhdmUgaXQgYWxvbmVcbiAgICAgICAgICAgIHN5bmNpbmdMZW5ndGggPSBzeW5jaW5nTGVuZ3RoIC0gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdlbmVyYXRlIEFKQVggY2FsbFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KGN1ckxlY3R1cmUpLFxuICAgICAgICAgICAgdXJsOiBjdXJMZWN0dXJlLnVyaSxcbiAgICAgICAgICAgIHR5cGU6ICdQT1NUJyxcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgc2VsZi51cGRhdGVMZWN0dXJlKGRhdGEsIHN5bmNpbmdMZW5ndGgpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgLyoqIEdlbmVyYXRlIGFycmF5IG9mIEFKQVggY2FsbHMsIGNhbGwgdGhlbSB0byBoYXZlIGEgY29tcGxldGUgc2V0IG9mIHF1ZXN0aW9ucyAqL1xuICAgIHRoaXMuc3luY1F1ZXN0aW9ucyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLCBpLCBxdWVzdGlvbkRmZHMsXG4gICAgICAgICAgICBtaXNzaW5nUW5zID0gW10sXG4gICAgICAgICAgICBjdXJMZWN0dXJlID0gc2VsZi5nZXRDdXJyZW50TGVjdHVyZSgpO1xuXG4gICAgICAgIC8vIFJlbW92ZSBsb2NhbCBjb3B5IG9mIGRlYWQgcXVlc3Rpb25zXG4gICAgICAgIGlmIChjdXJMZWN0dXJlLnJlbW92ZWRfcXVlc3Rpb25zKSB7XG4gICAgICAgICAgICBjdXJMZWN0dXJlLnJlbW92ZWRfcXVlc3Rpb25zLm1hcChmdW5jdGlvbiAocW4pIHtcbiAgICAgICAgICAgICAgICBzZWxmLmxzLnJlbW92ZUl0ZW0ocW4pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBXaGljaCBxdWVzdGlvbnMgYXJlIHN0YWxlP1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY3VyTGVjdHVyZS5xdWVzdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChzZWxmLmxzLmdldEl0ZW0oY3VyTGVjdHVyZS5xdWVzdGlvbnNbaV0udXJpKSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIC8vVE9ETzogU2hvdWxkIGJlIGNoZWNraW5nIHF1ZXN0aW9uIGFnZSB0b29cbiAgICAgICAgICAgICAgICBtaXNzaW5nUW5zLnB1c2goaSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWlzc2luZ1Fucy5sZW5ndGggPj0gTWF0aC5taW4oMTAsIGN1ckxlY3R1cmUucXVlc3Rpb25zLmxlbmd0aCkpIHtcbiAgICAgICAgICAgIC8vIE1vc3QgcXVlc3Rpb25zIGFyZSBtaXNzaW5nLCBzbyBqdXN0IGZldGNoIGV2ZXJ5dGhpbmdcbiAgICAgICAgICAgIHJldHVybiBbe1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgICAgICAgICAgY2FjaGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHVybDogY3VyTGVjdHVyZS5xdWVzdGlvbl91cmksXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5pbnNlcnRRdWVzdGlvbnMoZGF0YSwgZnVuY3Rpb24gKCkge30pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1dO1xuICAgICAgICB9XG4gICAgICAgIC8vIE90aGVyd2lzZSwgZmV0Y2ggbmV3IHF1ZXN0aW9uc1xuICAgICAgICByZXR1cm4gbWlzc2luZ1Fucy5tYXAoZnVuY3Rpb24gKGkpIHtcbiAgICAgICAgICAgIHZhciBxblVyaSA9IGN1ckxlY3R1cmUucXVlc3Rpb25zW2ldLnVyaTtcbiAgICAgICAgICAgIC8vIE5ldyBxdWVzdGlvbiB3ZSBkb24ndCBoYXZlIHlldFxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcIkdFVFwiLFxuICAgICAgICAgICAgICAgIGNhY2hlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB1cmw6IHFuVXJpLFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBxbnMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgcW5zW3FuVXJpXSA9IGRhdGE7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuaW5zZXJ0UXVlc3Rpb25zKHFucywgZnVuY3Rpb24gKCkge30pO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqIEhlbHBlciB0byB0dXJuIHRoZSBsYXN0IGl0ZW0gaW4gYW4gYW5zd2VyUXVldWUgaW50byBhIGdyYWRlIHN0cmluZyAqL1xuICAgIHRoaXMuZ3JhZGVTdHJpbmcgPSBmdW5jdGlvbiAoYSkge1xuICAgICAgICBpZiAoIWEpIHsgcmV0dXJuOyB9XG4gICAgICAgIHJldHVybiBcIlwiICtcbiAgICAgICAgICAgIChhLmhhc093blByb3BlcnR5KCdsZWNfYW5zd2VyZWQnKSA/IFwiQW5zd2VyZWQgXCIgKyBhLmxlY19hbnN3ZXJlZCArIFwiIHF1ZXN0aW9ucywgXCIgKyBhLmxlY19jb3JyZWN0ICsgXCIgY29ycmVjdGx5LiBcIiA6IFwiXCIpICtcbiAgICAgICAgICAgIFwiXFxuWW91ciBncmFkZTogXCIgKyAoYS5oYXNPd25Qcm9wZXJ0eSgnZ3JhZGVfYWZ0ZXInKSA/IGEuZ3JhZGVfYWZ0ZXIgOiBhLmhhc093blByb3BlcnR5KCdncmFkZV9iZWZvcmUnKSA/IGEuZ3JhZGVfYmVmb3JlIDogMCkgK1xuICAgICAgICAgICAgKGEuaGFzT3duUHJvcGVydHkoJ2dyYWRlX25leHRfcmlnaHQnKSA/IFwiLCBpZiB5b3UgZ2V0IHRoZSBuZXh0IHF1ZXN0aW9uIHJpZ2h0OlwiICsgYS5ncmFkZV9uZXh0X3JpZ2h0IDogXCJcIik7XG4gICAgfTtcblxuICAgIC8qKiBIZWxwZXIgdG8gZm9ybSBhIFVSTCB0byBhIHNlbGVjdGVkIHF1aXogKi9cbiAgICB0aGlzLnF1aXpVcmwgPSBmdW5jdGlvbiAodHV0VXJpLCBsZWNVcmkpIHtcbiAgICAgICAgcmV0dXJuICdxdWl6Lmh0bWw/dHV0VXJpPScgKyBlbmNvZGVVUklDb21wb25lbnQodHV0VXJpKSArICc7bGVjVXJpPScgKyBlbmNvZGVVUklDb21wb25lbnQobGVjVXJpKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICAqIEdpdmVuIFVSTCBvYmplY3QsIGNob3AgcXVlcnlzdHJpbmcgdXAgaW50byBhIGtleS92YWx1ZSBvYmplY3RcbiAgICAgICogZS5nLiBxdWl6LnBhcnNlUVMod2luZG93LmxvY2F0aW9uKVxuICAgICAgKi9cbiAgICB0aGlzLnBhcnNlUVMgPSBmdW5jdGlvbiAodXJsKSB7XG4gICAgICAgIHZhciBpLCBwYXJ0LFxuICAgICAgICAgICAgb3V0ID0ge30sXG4gICAgICAgICAgICBxcyA9IHVybC5zZWFyY2gucmVwbGFjZSgvXlxcPy8sICcnKS5zcGxpdCgvO3wmLyk7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBxcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgcGFydCA9IHFzW2ldLnNwbGl0KCc9Jyk7XG4gICAgICAgICAgICBvdXRbcGFydFswXV0gPSBkZWNvZGVVUklDb21wb25lbnQocGFydFsxXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICAqIEJhc2VkIG9uIGxvY2F0aW9uIChlLmcuIGRvY3VtZW50LmxvY2F0aW9uKSBSZXR1cm4gd2hhdCBpcyBwcm9iYWJseSB0aGVcbiAgICAgICogUGxvbmUgcm9vdFxuICAgICAgKi9cbiAgICB0aGlzLnBvcnRhbFJvb3RVcmwgPSBmdW5jdGlvbiAobG9jYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIGxvY2F0aW9uLnByb3RvY29sICsgJy8vJyArIGxvY2F0aW9uLmhvc3QgKyAnLyc7XG4gICAgfTtcbn07XG4iLCIvKmpzbGludCBub21lbjogdHJ1ZSwgcGx1c3BsdXM6IHRydWUsIGJyb3dzZXI6dHJ1ZSovXG4vKmdsb2JhbCBqUXVlcnkqL1xudmFyIFF1aXogPSByZXF1aXJlKCcuL3F1aXpsaWIuanMnKTtcblxuZnVuY3Rpb24gU3RhcnRWaWV3KCQsIGpxUXVpeiwganFTZWxlY3QpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICB0aGlzLmpxUXVpeiA9IGpxUXVpejtcbiAgICB0aGlzLmpxU2VsZWN0ID0ganFTZWxlY3Q7XG5cbiAgICAvKiogUHV0IGFuIGFsZXJ0IGRpdiBhdCB0aGUgdG9wIG9mIHRoZSBwYWdlICovXG4gICAgdGhpcy5yZW5kZXJBbGVydCA9IGZ1bmN0aW9uICh0eXBlLCBtZXNzYWdlKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgc2VsZi5qcVF1aXouY2hpbGRyZW4oJ2Rpdi5hbGVydCcpLnJlbW92ZSgpO1xuICAgICAgICBzZWxmLmpxUXVpei5wcmVwZW5kKCQoJzxkaXYgY2xhc3M9XCJhbGVydFwiPicpXG4gICAgICAgICAgICAuYWRkQ2xhc3MoXCJhbGVydC1cIiArIHR5cGUpXG4gICAgICAgICAgICAudGV4dChtZXNzYWdlKSk7XG4gICAgfTtcblxuICAgIC8qKiBHZW5lcmF0ZSBleHBhbmRpbmcgbGlzdCBmb3IgdHV0b3JpYWxzIC8gbGVjdHVyZXMgKi9cbiAgICB0aGlzLnJlbmRlckNob29zZUxlY3R1cmUgPSBmdW5jdGlvbiAocXVpeiwgaXRlbXMpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBzZWxmLmpxU2VsZWN0LmVtcHR5KCk7XG5cbiAgICAgICAgLy8gRXJyb3IgbWVzc2FnZSBpZiB0aGVyZSdzIG5vIGl0ZW1zXG4gICAgICAgIGlmICghaXRlbXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBzZWxmLnJlbmRlckFsZXJ0KFwiaW5mb1wiLCAnWW91IGhhdmUgbm8gdHV0b3JpYWxzIGxvYWRlZCB5ZXQuIFBsZWFzZSB2aXNpdCB0dXRvcndlYiBieSBjbGlja2luZyBcIkdldCBtb3JlIHR1dG9yaWFsc1wiLCBhbmQgY2hvb3NlIGEgZGVwYXJ0bWVudCBhbmQgdHV0b3JpYWwnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFtbaHJlZiwgdGl0bGUsIGl0ZW1zXSwgW2hyZWYsIHRpdGxlLCBpdGVtc10sIC4uLl0gPT4gbWFya3VwXG4gICAgICAgIC8vIGl0ZW1zIGNhbiBhbHNvIGJlIHt1cmk6ICcnLCB0aXRsZTogJyd9XG4gICAgICAgIGZ1bmN0aW9uIGxpc3RUb01hcmt1cChpdGVtcykge1xuICAgICAgICAgICAgdmFyIGksIGpxQSwgaXRlbSwganFVbCA9ICQoJzx1bC8+Jyk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGl0ZW1zID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaXRlbSA9IGl0ZW1zW2ldO1xuICAgICAgICAgICAgICAgIGpxQSA9ICQoJzxhLz4nKS5hdHRyKCdocmVmJywgaXRlbS51cmkpLnRleHQoaXRlbS50aXRsZSk7XG4gICAgICAgICAgICAgICAgaWYgKGl0ZW0uZ3JhZGUpIHtcbiAgICAgICAgICAgICAgICAgICAganFBLmFwcGVuZCgkKCc8c3BhbiBjbGFzcz1cImdyYWRlXCIvPicpLnRleHQoaXRlbS5ncmFkZSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBqcVVsLmFwcGVuZCgkKCc8bGkvPicpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKGpxQSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hcHBlbmQobGlzdFRvTWFya3VwKGl0ZW0ubGVjdHVyZXMpKVxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBqcVVsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVjdXJzaXZlbHkgdHVybiB0dXRvcmlhbHMsIGxlY3R1cmVzIGludG8gYSB1bCwgcG9wdWxhdGUgZXhpc3RpbmcgdWwuXG4gICAgICAgIHNlbGYuanFTZWxlY3QuYXBwZW5kKGxpc3RUb01hcmt1cChpdGVtcykuY2hpbGRyZW4oKSk7XG4gICAgfTtcbn1cblxuKGZ1bmN0aW9uICh3aW5kb3csICQsIHVuZGVmaW5lZCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIHZhciBxdWl6LCB2aWV3LFxuICAgICAgICBqcVF1aXogPSAkKCcjdHctcXVpeicpLFxuICAgICAgICBqcVNlbGVjdCA9ICQoJyN0dy1zZWxlY3QnKSxcbiAgICAgICAganFQcm9jZWVkID0gJCgnI3R3LXByb2NlZWQnKSxcbiAgICAgICAganFTeW5jID0gJCgnI3R3LXN5bmMnKSxcbiAgICAgICAganFEZWxldGUgPSAkKCcjdHctZGVsZXRlJyk7XG5cbiAgICAvLyBEbyBub3RoaW5nIGlmIG5vdCBvbiB0aGUgcmlnaHQgcGFnZVxuICAgIGlmICgkKCdib2R5LnF1aXotc3RhcnQnKS5sZW5ndGggPT09IDApIHsgcmV0dXJuOyB9XG5cbiAgICAvLyBDYXRjaCBhbnkgdW5jYXVnaHQgZXhjZXB0aW9uc1xuICAgIHdpbmRvdy5vbmVycm9yID0gZnVuY3Rpb24gKG1lc3NhZ2UsIHVybCwgbGluZW51bWJlcikge1xuICAgICAgICB2aWV3LnJlbmRlckFsZXJ0KFwiZXJyb3JcIiwgXCJJbnRlcm5hbCBlcnJvcjogXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiIChcIiArIHVybCArIFwiOlwiICsgbGluZW51bWJlciArIFwiKVwiKTtcbiAgICB9O1xuXG4gICAgLy8gV2lyZSB1cCBxdWl6IG9iamVjdFxuICAgIHZpZXcgPSBuZXcgU3RhcnRWaWV3KCQsIGpxUXVpeiwganFTZWxlY3QpO1xuICAgIHF1aXogPSBuZXcgUXVpeihsb2NhbFN0b3JhZ2UsIGZ1bmN0aW9uIChtZXNzYWdlKSB7XG4gICAgICAgIHZpZXcucmVuZGVyQWxlcnQoXCJlcnJvclwiLCBtZXNzYWdlKTtcbiAgICB9KTtcblxuICAgIC8vIFJlZnJlc2ggbWVudSwgYm90aCBvbiBzdGFydHVwIGFuZCBhZnRlciBtdW5naW5nIHF1aXp6ZXNcbiAgICBmdW5jdGlvbiByZWZyZXNoTWVudSgpIHtcbiAgICAgICAgcXVpei5nZXRBdmFpbGFibGVMZWN0dXJlcyhmdW5jdGlvbiAobGVjdHVyZXMpIHtcbiAgICAgICAgICAgIHZpZXcucmVuZGVyQ2hvb3NlTGVjdHVyZShxdWl6LCBsZWN0dXJlcyk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZWZyZXNoTWVudSgpO1xuXG4gICAgLy8gUG9pbnQgdG8gcm9vdCBvZiBjdXJyZW50IHNpdGVcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndHctaG9tZScpLmhyZWYgPSBxdWl6LnBvcnRhbFJvb3RVcmwoZG9jdW1lbnQubG9jYXRpb24pO1xuXG4gICAgLy8gSWYgYnV0dG9uIGlzIGRpc2FibGVkLCBkbyBub3RoaW5nXG4gICAganFQcm9jZWVkLmNsaWNrKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGlmICgkKHRoaXMpLmhhc0NsYXNzKFwiZGlzYWJsZWRcIikpIHtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gU3luYyBhbGwgdHV0b3JpYWxzXG4gICAganFTeW5jLmNsaWNrKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIC8vVE9ETzogU3luYyB0dXRvcmlhbHMgaW4gdHVyblxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9KTtcblxuICAgIC8vIFJlbW92ZSBzZWxlY3RlZCB0dXRvcmlhbFxuICAgIGpxRGVsZXRlLmNsaWNrKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgaWYgKCQodGhpcykuaGFzQ2xhc3MoXCJkaXNhYmxlZFwiKSkge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIC8vVE9ETzogU3luYyBmaXJzdFxuICAgICAgICBxdWl6LnJlbW92ZVR1dG9yaWFsKCQoc2VsZikuZGF0YSgndHV0VXJpJykpO1xuICAgICAgICByZWZyZXNoTWVudSgpO1xuICAgICAgICBqcVByb2NlZWQuYWRkQ2xhc3MoXCJkaXNhYmxlZFwiKTtcbiAgICAgICAganFEZWxldGUuYWRkQ2xhc3MoXCJkaXNhYmxlZFwiKTtcbiAgICB9KTtcblxuICAgIC8vIENsaWNrIG9uIHRoZSBzZWxlY3QgYm94IG9wZW5zIC8gY2xvc2VzIGl0ZW1zXG4gICAganFTZWxlY3QuY2xpY2soZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgdmFyIGpxVGFyZ2V0ID0gJChlLnRhcmdldCk7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAganFTZWxlY3QuZmluZChcIi5zZWxlY3RlZFwiKS5yZW1vdmVDbGFzcyhcInNlbGVjdGVkXCIpO1xuICAgICAgICBqcVByb2NlZWQuYWRkQ2xhc3MoXCJkaXNhYmxlZFwiKTtcbiAgICAgICAganFEZWxldGUuYWRkQ2xhc3MoXCJkaXNhYmxlZFwiKTtcbiAgICAgICAgaWYgKGpxVGFyZ2V0LnBhcmVudCgpLnBhcmVudCgpWzBdID09PSB0aGlzKSB7XG4gICAgICAgICAgICAvLyBBIDFzdCBsZXZlbCB0dXRvcmlhbCwgSnVzdCBvcGVuL2Nsb3NlIGl0ZW1cbiAgICAgICAgICAgIGpxVGFyZ2V0LnBhcmVudCgpLnRvZ2dsZUNsYXNzKFwiZXhwYW5kZWRcIik7XG4gICAgICAgICAgICBpZiAoanFUYXJnZXQucGFyZW50KCkuaGFzQ2xhc3MoXCJleHBhbmRlZFwiKSkge1xuICAgICAgICAgICAgICAgIGpxRGVsZXRlLmRhdGEoJ3R1dFVyaScsIGUudGFyZ2V0LmhyZWYpO1xuICAgICAgICAgICAgICAgIGpxRGVsZXRlLnJlbW92ZUNsYXNzKFwiZGlzYWJsZWRcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZS50YXJnZXQudGFnTmFtZSA9PT0gJ0EnIHx8IGUudGFyZ2V0LnRhZ05hbWUgPT09ICdTUEFOJykge1xuICAgICAgICAgICAgaWYgKGUudGFyZ2V0LnRhZ05hbWUgPT09ICdTUEFOJykge1xuICAgICAgICAgICAgICAgIGpxVGFyZ2V0ID0ganFUYXJnZXQucGFyZW50KCdhJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBBIHF1aXogbGluaywgc2VsZWN0IGl0XG4gICAgICAgICAgICBqcVRhcmdldC5hZGRDbGFzcyhcInNlbGVjdGVkXCIpO1xuICAgICAgICAgICAganFQcm9jZWVkLnJlbW92ZUNsYXNzKFwiZGlzYWJsZWRcIik7XG4gICAgICAgICAgICBqcURlbGV0ZS5yZW1vdmVDbGFzcyhcImRpc2FibGVkXCIpO1xuICAgICAgICAgICAganFQcm9jZWVkLmF0dHIoJ2hyZWYnLCBqcVRhcmdldC5hdHRyKCdocmVmJykpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbn0od2luZG93LCBqUXVlcnkpKTtcbiJdfQ==
