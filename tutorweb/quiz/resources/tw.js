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
                getSetting(settings, 'grade_alpha', 0.125),
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
            // Ignore curve and weight evenly
            for (i = 0; i < weightings.length; i++) {
                weightings[i] = 1 / (nmax - 1);
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
        if (arguments.length === 3 && arguments[0].responseJSON &&
                                      arguments[0].responseJSON.error == 'Redirect') {
            // Redirect error
            updateState('error', 'You have not accepted the terms and conditions. Please ' +
                                 '<a href="'+arguments[0].responseJSON.location+'" target="_blank">Click here and click the accept button</a>. ' +
                                 'Reload this page when finished', 'html');
        } else if (arguments.length === 3) {
            // var jqXHR = message
            updateState('error', errorThrown + " (whilst requesting " + this.url + ")");
        } else {
            // Just a string
            updateState('error', message);
        }
    };

    // Catch any uncaught exceptions
    window.onerror = function (message, url, linenumber) {
        if (message.toLowerCase().indexOf('quota') > -1) {
            updateState("error", 'No more local storage available. Please <a href="start.html">return to the menu</a> and delete some tutorials you are no longer using.', 'html');
        } else {
            updateState("error", "Internal error: " +
                             message +
                             " (" + url + ":" + linenumber + ")");
        }
    };

    // Wire up quiz object
    quiz = new Quiz(localStorage);

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
var View = require('./view.js');

/**
  * View class to translate data into DOM structures
  *    $: jQuery
  *    jqQuiz: jQuery-wrapped <form id="tw-quiz">
  *    jqActions: <ul> that contains action buttons
  */
function QuizView($) {
    "use strict";
    this.jqTimer = $('#tw-timer');
    this.jqDebugMessage = $('#tw-debugmessage');
    this.jqGrade = $('#tw-grade');
    this.timerTime = null;

    /** Start the timer counting down from startTime seconds */
    this.timerStart = function (onFinish, startTime) {
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
            self.jqTimer.show();
            self.jqTimer.children('span').text(formatTime(self.timerTime));
            window.setTimeout(self.timerStart.bind(self, onFinish), 1000);
        } else {
            // Wasn't asked to stop, so it's a genuine timeout
            self.jqTimer.show();
            self.jqTimer.children('span').text("Out of time");
            onFinish();
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

    /** Render next question */
    this.renderNewQuestion = function (qn, a, gradeString, onFinish) {
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
        self.renderMath(onFinish);
    };

    /** Annotate with correct / incorrect selections */
    this.renderAnswer = function (a, answerData, gradeString) {
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

    this.renderStart = function (continuing, tutUri, tutTitle, lecUri, lecTitle, gradeString) {
        var self = this;
        $("#tw-title").text(tutTitle + " - " + lecTitle);
        self.jqQuiz.empty().append($("<p/>").text(
            continuing ? "Click 'Continue question' to carry on" : "Click 'New question' to start"));
        self.jqGrade.text(gradeString);
        self.updateDebugMessage(lecUri, '');
    };
}
QuizView.prototype = new View($);

(function (window, $, undefined) {
    "use strict";
    var quiz, twView;
    // Do nothing if not on the right page
    if ($('body.quiz-quiz').length === 0) { return; }

    // Wire up Quiz View
    twView = new QuizView($);
    window.onerror = twView.errorHandler();

    // Complain if there's no localstorage
    if (!window.localStorage) {
        throw "Sorry, we do not support your browser";
    }

    // Trigger reload if appCache needs it
    if (window.applicationCache) {
        window.applicationCache.addEventListener('updateready', function (e) {
            if (window.applicationCache.status !== window.applicationCache.UPDATEREADY) {
                return;
            }
            throw 'tutorweb::info::A new version is avaiable, click "Restart quiz"';
        });
    }

    // Create Quiz model
    quiz = new Quiz(localStorage);

    /** Main state machine, perform actions and update what you can do next */
    twView.stateMachine(function updateState(curState, fallback) {
        $(document).data('tw-state', curState);
        twView.timerStop();

        switch (curState) {
        case 'initial':
            // Load the lecture referenced in URL, if successful hit the button to get first question.
            quiz.setCurrentLecture(quiz.parseQS(window.location), function (continuing) {
                twView.renderStart.apply(twView, arguments);
                twView.renderPrevAnswers(quiz.lastEight());
                if (continuing == 'practice') {
                    updateState('quiz-practice');
                } else if (continuing == 'real') {
                    updateState('quiz-real');
                } else {
                    twView.updateActions(['gohome', 'quiz-practice', 'quiz-real']);
                }
            });
            break;
        case 'quiz-real':
        case 'quiz-practice':
            twView.updateActions([]);
            quiz.getNewQuestion(curState.endsWith('-practice'), function (qn, a, gradeString) {
                var markState = curState.endsWith('-practice') ? 'mark-practice' : 'mark-real';
                twView.renderNewQuestion.call(twView, qn, a, gradeString, function () {
                    // Once MathJax is finished, start the timer
                    twView.timerStart(updateState.bind(null, markState), a.remaining_time);
                });
                twView.updateActions([markState]);
            });
            break;
        case 'mark-real':
        case 'mark-practice':
            // Disable all controls and mark answer
            twView.updateActions([]);
            quiz.setQuestionAnswer(parseInt($('input:radio[name=answer]:checked').val(), 10), function () {
                twView.renderAnswer.apply(twView, arguments);
                twView.renderPrevAnswers(quiz.lastEight());
                $('#tw-sync').trigger('click', 'noforce');
                if (curState === 'mark-practice') {
                    twView.updateActions(['gohome', 'quiz-real', 'quiz-practice']);
                } else {
                    twView.updateActions(['gohome', 'quiz-practice', 'quiz-real']);
                }
            });
            break;
        default:
            fallback(curState);
        }
    });

    $('#tw-sync').bind('click', function (event, noForce) {
        var syncCall;

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

        function onError(jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 401 || jqXHR.status === 403) {
                twView.syncState('unauth');
            } else {
                twView.syncState('error');
            }
        }

        if (twView.syncState() === 'processing') {
            // Don't want to repeatedly sync
            return;
        }
        if (twView.syncState() === 'unauth') {
            // Only show dialog if user has explcitly clicked button
            if (!noForce) {
                window.open(quiz.portalRootUrl(document.location) +
                            '/login?came_from=' +
                            encodeURIComponent(document.location.pathname.replace(/\/\w+\.html$/, '/close.html')),
                            "loginwindow");
                twView.syncState('default');
            }
            return;
        }
        twView.syncState('processing');
        if (!window.navigator.onLine) {
            twView.syncState('offline');
            return;
        }

        // Fetch AJAX call
        syncCall = quiz.syncLecture(!noForce);
        if (syncCall === null) {
            // Sync says there's nothing to do
            twView.syncState('default');
            return;
        }

        // Sync current lecture and it's questions
        callAjax([syncCall], {error: onError}, null, function () {
            callAjax(quiz.syncQuestions(), {error: onError}, null, function () {
                twView.syncState('online');
            });
        });
    });
    twView.syncState('default');
}(window, jQuery));

},{"./quizlib.js":4,"./view.js":7}],4:[function(require,module,exports){
/*jslint nomen: true, plusplus: true, browser:true*/
var iaalib = new (require('./iaa.js'))();

/**
  * Main quiz object
  *  rawLocalStorage: Browser local storage object
  */
module.exports = function Quiz(rawLocalStorage) {
    "use strict";
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
                    (lastAns && !lastAns.answer_time ? lastAns.practice ? 'practice' : 'real' : false),
                    params.tutUri,
                    self.curTutorial.title,
                    params.lecUri,
                    lecture.title,
                    self.gradeString(lastAns)
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
            a.remaining_time = a.allotted_time;
            if (a.allotted_time && a.quiz_time) {
                a.remaining_time -= Math.round((new Date()).getTime() / 1000) - a.quiz_time;
            }
            if (self.ls.setItem(self.tutorialUri, self.curTutorial)) { onSuccess(qn, a, self.gradeString(a)); }
        });
    };

    /** Return the full data for a question */
    this.getQuestionData = function (uri, onSuccess) {
        var qn, self = this;
        qn = self.ls.getItem(uri);
        if (!qn) {
            throw "Cannot find question " + uri;
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
        if (typeof a.selected_answer === "undefined") {
            a.selected_answer = null;
        }
        a.student_answer = a.ordering[selectedAnswer];
        if (typeof a.student_answer === "undefined") {
            a.student_answer = null;
        }
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
                onSuccess(a, answerData, self.gradeString(a));
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

},{"./iaa.js":1}],5:[function(require,module,exports){
/*jslint nomen: true, plusplus: true, browser:true*/
/*global jQuery, MathJax*/
var Quiz = require('./quizlib.js');
var View = require('./view.js');
var QS = require("querystring");

/**
  * View class to translate data into DOM structures
  *    $: jQuery
  *    jqQuiz: jQuery-wrapped <form id="tw-quiz">
  *    jqActions: <ul> that contains action buttons
  */
function SlideView($) {
    "use strict";
    this.renderSlide = function (url) {
        var self = this,
            request = new XMLHttpRequest();

        request.open('GET', url, true);
        request.onload = function() {
          if (request.status >= 200 && request.status < 400){
            self.jqQuiz.html(request.responseText);
            self.jqQuiz.removeClass('busy');
          } else {
            throw "tutorweb::error::" + request.status + " whilst requesting " + url;
          }
        };
        request.onerror = function(event) {
             throw "tutorweb::error::Could not fetch " + url;
        };
        request.send();
    };

    this.renderSlides = function (jqSlides) {
        var self = this;

        self.jqQuiz.find('.slide-collection').replaceWith(jqSlides);
        self.jqQuiz.removeClass('busy');
        self.jqQuiz.find('.slide-content figure').click(function (e) {
            $(this).toggleClass('show-code');
        });
    };

    this.selectSlide = function (slideId) {
        var self = this, jqPrevId, jqNextId,
            jqPrevButton = self.jqQuiz.find('#tw-slide-prev'),
            jqNextButton = self.jqQuiz.find('#tw-slide-next'),
            jqCollection = self.jqQuiz.find('.slide-collection').children();

        jqCollection.map(function (i, sl) {
            var jqNext, jqPrev, jqSl = $(sl);
            if ((slideId === "" && i === 0) || (slideId === jqSl.attr('id'))) {
                jqSl.addClass('selected');
                slideId = jqSl.attr('id');
                $("#tw-slide-title").text(jqSl.find('h2').text());

                jqPrevId = jqSl.prev().attr('id');
                jqPrevButton.attr('href', '#' + (jqPrevId || slideId));
                jqPrevButton.toggleClass('disabled', typeof jqPrevId == 'undefined');

                jqNextId = jqSl.next().attr('id');
                jqNextButton.attr('href', '#' + (jqNextId || slideId));
                jqNextButton.toggleClass('disabled', typeof jqNextId == 'undefined');
            } else {
                jqSl.removeClass('selected');
            }
        });
    };
}
SlideView.prototype = new View($);

(function (window, $, undefined) {
    "use strict";
    var quiz, twView;

    /** Call an array of Ajax calls, splicing in extra options, onProgress called on each success, onDone at end */
    function callAjax(calls, extra, onProgress, onDone) {
        var handleError = function (jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 401 || jqXHR.status === 403) {
                throw "tutorweb::error::Unauthorized to fetch " + this.url;
            } else {
                throw "tutorweb::error::Could not fetch " + this.url;
            }
        };

        var dfds = calls.map(function (a) {
            return $.ajax($.extend({error: handleError}, a, extra));
        });
        if (dfds.length === 0) {
            onDone();
        } else {
            dfds.map(function (d) { d.done(onProgress); });
            $.when.apply(null, dfds).done(onDone);
        }
    }

    // Do nothing if not on the right page
    if ($('body.page-slide').length === 0) { return; }

    // Wire up quiz object
    twView = new SlideView($);
    window.onerror = twView.errorHandler();

    // Create Quiz model
    quiz = new Quiz(localStorage);

    // Start state machine
    twView.stateMachine(function updateState(curState, fallback) {
        switch (curState) {
        case 'initial':
            this.updateActions(['go-drill', 'gohome']);
            quiz.setCurrentLecture(quiz.parseQS(window.location), function (continuing, tutUri, tutTitle, lecUri, lecTitle, gradeString) {
                $("#tw-title").text(tutTitle + " - " + lecTitle);
                updateState('fetch-slides');
            });
            break;
        case 'fetch-slides':
            callAjax([quiz.fetchSlides()], {}, function () {}, function (docString) {
                var doc = $('<div/>').html(docString);
                twView.renderSlides(doc.find('.slide-collection'));
                twView.selectSlide(window.location.hash.replace(/^#!?/, ""));
            });
            break;
        default:
            fallback(curState);
        }
    });

    window.onhashchange = function () {
        twView.selectSlide(window.location.hash.replace(/^#!?/, ""));
    };
}(window, jQuery));

},{"./quizlib.js":4,"./view.js":7,"querystring":10}],6:[function(require,module,exports){
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

        // Open tutorial if it's the only one
        if (items.length === 1) {
            self.jqSelect.find("> li:first-child > a").trigger("click");
        }
    };
}

(function (window, $, undefined) {
    "use strict";
    var quiz, view,
        unsyncedLectures = [],
        jqQuiz = $('#tw-quiz'),
        jqLogout = $('#tw-logout'),
        jqSelect = $('#tw-select'),
        jqProceed = $('#tw-proceed'),
        jqSync = $('#tw-sync'),
        jqDelete = $('#tw-delete'),
        jqViewSlides = $('#tw-view-slides');

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
    quiz = new Quiz(localStorage);

    // Refresh menu, both on startup and after munging quizzes
    function refreshMenu() {
        quiz.getAvailableLectures(function (tutorials) {
            view.renderChooseLecture(quiz, tutorials);

            // Get all lecture titles from unsynced lectures
            unsyncedLectures = [].concat.apply([], tutorials.map(function (t) {
                return (t.lectures.filter(function (l) { return !l.synced; })
                                  .map(function (l) { return l.title; }));
            }));
        });
    }

    // Point to root of current site
    document.getElementById('tw-home').href = quiz.portalRootUrl(document.location);

    // If button is disabled, do nothing
    jqProceed.click(function (e) {
        if ($(this).hasClass("disabled")) {
            e.preventDefault();
            return false;
        }
    });

    // Logout should log out of Plone, but after asking first
    jqLogout.attr('href', quiz.portalRootUrl(document.location) + '/logout');
    jqLogout.click(function (e) {
        var unSyncedLecture = unsyncedLectures[0];

        if (unSyncedLecture && !window.confirm("Your answers to " + unSyncedLecture + " haven't been sent to the Tutor-Web server.\nIf you click okay some answers will be lost")) {
            e.preventDefault();
            return false;
        }

        localStorage.clear();
        return true;
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
        jqViewSlides.addClass("disabled");
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
            jqViewSlides.removeClass("disabled");
            jqViewSlides.attr('href', jqTarget.attr('href').replace(/quiz\.html/, 'slide.html'));
        }
    });

    refreshMenu();

}(window, jQuery));

},{"./quizlib.js":4}],7:[function(require,module,exports){
/**
  * View class for all pages
  */
module.exports = function View($) {
    "use strict";
    this.jqQuiz = $('#tw-quiz');
    this.jqActions = $('#tw-actions');
    this.locale = {
        "reload": "Restart",
        "gohome": "Back to main menu",
        "go-drill": "Take a drill",
        "quiz-practice": "Practice question",
        "quiz-real": "New question",
        "mark-practice": "Submit answer >>>",
        "mark-real": "Submit answer >>>",
    };

    /** Regenerate button collection to contain given buttons */
    this.updateActions = function (actions) {
        var self = this;

        self.jqActions.empty().append(actions.map(function (a, i) {
            return $('<button/>')
                .attr('data-state', a)
                .attr('class', 'btn' + (i + 1 == actions.length ? ' btn-primary' : ''))
                .text(self.locale[a] || a);
        }));
    };

    /** Tell MathJax to render anything on the page */
    this.renderMath = function (onSuccess) {
        var jqQuiz = this.jqQuiz;
        jqQuiz.addClass("busy");
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, this.jqQuiz[0]]);
        MathJax.Hub.Queue(function () {
            jqQuiz.removeClass("busy");
        });
        if (onSuccess) {
            MathJax.Hub.Queue(onSuccess);
        }
    };

    /** Add a message to the page */
    this.showAlert = function (state, message, encoding) {
        var jqQuiz = this.jqQuiz,
            jqAlert = $('<div class="alert">').addClass(state === 'error' ? ' alert-error' : 'alert-info');

        if (encoding === 'html') {
            jqAlert.html(message);
        } else {
            jqAlert.text(message);
        }
        jqQuiz.children('div.alert').remove();
        jqQuiz.prepend(jqAlert);
    };

    /** Return an error handler to attach to window.onerror */
    this.errorHandler = function () {
        var self = this;
        return function (message, url, linenumber) {
            self.jqQuiz.removeClass('busy');
            if (message.toLowerCase().indexOf('quota') > -1) {
                self.showAlert("error", 'No more local storage available. Please <a href="start.html">return to the menu</a> and delete some tutorials you are no longer using.', 'html');
            } else if (message.indexOf('tutorweb::') !== -1) {
                self.showAlert.apply(self, message.split(/\:\:/).splice(1));
            } else {
                self.showAlert("error", "Internal error: " + message + " (" + url + ":" + linenumber + ")");
            }
            // The only action now should be to reload the page
            $('.tw-action').remove();
            self.updateActions(['gohome', 'reload']);
        };
    };

    /** Initalise and start a state machine to control the page */
    this.stateMachine = function (updateState) {
        var self = this;
        // State machine to use when nothing else works
        function fallback(curState) {
            switch (curState) {
            case 'processing':
                break;
            case 'request-reload':
                self.updateActions(['reload']);
                break;
            case 'reload':
                window.location.reload(false);
                break;
            case 'gohome':
                window.location.href = 'start.html';
                break;
            case 'go-drill':
                window.location.href = 'quiz.html' + window.location.search;
                break;
            default:
                throw "tutorweb::error::Unknown state '" + curState + "'";
            }
        }

        // Hitting the button moves on to the next state in the state machine
        $('#tw-actions, .tw-action').bind('click', function (event) {
            event.preventDefault();
            updateState.call(self, event.target.getAttribute('data-state'), fallback);
        });
        updateState.call(self, "initial", fallback);
    };
};

},{}],8:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],9:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return obj[k].map(function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],10:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":8,"./encode":9}]},{},[1,2,3,4,5,6,7])


//# sourceMappingURL=tw.js.map