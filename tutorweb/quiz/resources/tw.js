(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
    this.newAllocation = function(curTutorial, lecIndex, answerQueue, practiceMode) {
        var questions, gradenow,
            settings = curTutorial.lectures[lecIndex].settings || {"hist_sel": curTutorial.lectures[lecIndex].hist_sel};
        if (Math.random() < parseFloat(settings.hist_sel || 0)) {
            questions = curTutorial.lectures[Math.floor(Math.random() * (lecIndex + 1))].questions;
        } else {
            questions = curTutorial.lectures[lecIndex].questions;
        }
        if (!questions || !questions.length) {
            return null;
        }

        gradenow = this.callGrade(answerQueue);
        return {
            "uri": questions[this.item_allocation(questions, gradenow[0])].uri,
            "allotted_time": this.qnTimeout(settings, gradenow[0]),
            "grade_before": gradenow[0], //TODO: Previous question || 0
            "grade_after_right": practiceMode ? gradenow[0] : gradenow[1],
            "grade_after_wrong": practiceMode ? gradenow[0] : gradenow[2],
            "lec_answered" : Array.last(answerQueue) === null ? 0 : (Array.last(answerQueue).lec_answered || 0),
            "lec_correct" : Array.last(answerQueue) === null ? 0 : (Array.last(answerQueue).lec_correct || 0),
            "practice": practiceMode
        };
    };

    this.gradeAllocation = function(answerQueue, practiceMode) {
    };

    /** Given user's current grade, return how long they should have to do the next question in seconds(?) */
    this.qnTimeout = function(settings, grade) {
        function getSetting(n, defValue) {
            if (isNaN(parseFloat(settings[n]))) {
                return defValue;
            }
            return parseFloat(settings[n]);
        }

        var tMax, tMin, gradeaverage, tStd, time;
        // Max time
        tMax = getSetting('timeout_max', 10);
        //placeholder : tMin will be randomized (with 2 being the most common) and saved to My SQL
        tMin = getSetting('timeout_min', 3);
        // g* : will likely be five but might change
        gradeaverage = getSetting('timeout_grade', 5);
        //will be 2s^2 where s = sqrt(2)
        tStd = getSetting('timeout_std', 2 * Math.sqrt(2));

        time = tMax * (1-(1-(tMin / tMax)) * Math.exp(-(Math.pow((grade-gradeaverage),2))/tStd));
        time = Math.floor(time * 60);
        return time;
    };

	/** Choose a question from the array based on the current grade
	  * questions: An array of objects, containing:-
	  *     chosen: Number of times question has been answered
	  *     correct: Of those times, how many a student gave a correct answer
	  * grade: Student's current grade, as calculated by callGrade()
	  *
	  * Return the index of the question to answer
	  */
	this.item_allocation = function(questions, grade)
	{
		var i;
		var dparam = questions.length / 10.0;
		var numquestions = questions.length;
		var difficulty = questions.map(function (qn) {
			// Significant numer of answers, so place normally
			if(qn.chosen > 5) return 1.0- (qn.correct/qn.chosen);

			// Make sure low-n items gets placed at extremes
			if(grade < 0) return (((qn.chosen-qn.correct)/2.0) + Math.random())/100.0;
			return 1.0 -(((qn.chosen-qn.correct)/2.0) + Math.random())/100.0;
		});
		var ranks = ranking(difficulty);
		var pdf = ia_pdf(numquestions, grade, dparam);
		var probvec = new Array();
		probvec.length = numquestions;
		for(i = 0; i<numquestions; i++)
		{
				for(var j = 0; j<numquestions; j++)
				{
						if(ranks[j] == i)
						{
								probvec[j] = pdf[i];
						}
				}
		}
		var utmp = Math.random();
		var selectedindex=ia_inverse_cdf(probvec, utmp);
		return(selectedindex);


		//returns a reverse cdf(cumulative distribution function) for 
		//a given pdf and a given u = F(x)
		//finnur �fugt cdf (cumulative distribution function) mi�a� vi�
		//gefi� pdf og eitthva� gefi� u = F(x)
		function ia_inverse_cdf(pdf, u)
		{
			var i = 0;
			var cumsum=pdf[0];
			while(u>cumsum)
			{
				i += 1;
				cumsum += pdf[i];
			}
			return i;
		}

		//ranks is an array with values from 0 - vector.length-1
		//in the order of the sizes of the items in vector
		//ex: vector[3, 5, 1, 2, 7] becomes rankings[2, 3, 0, 1, 4]
		//ranks er vigur me� gildi fr� 0-vector.length-1
		//og ra�ast upp eftir st�r� � gildunum � vector
		//d�mi: vector[3, 5, 1, 2, 7] v�ri ranking[2, 3, 0, 1, 4]
		function ranking(vector)
		{
			var rank = new Array();
			rank.length = vector.length;
			var found = new Array();
			found.length = vector.length;
			for(var a = 0; a<found.length; a++)
				found[a] = false;
			for(var i = 0; i<vector.length; i++){
				var min = 10000;
				var index = 0;
				for(var j = 0; j<vector.length; j++)
				{
						if(vector[j] <= min && !found[j]){
							index = j;
							min = vector[j];}
				}
				rank[index] = i;
				found[index] = true;
			}
			return rank;
		}


		//Use: pdf = ia_pdf(index, grade, q)
		//Before: index and grade are integers and 0<q<1
		//index specifies how many questions there are in the current exersize
		//grade is the users current grade (currently on the scale of -0.5 - 1
		//After: pdf is an array with the probability density distribution of the current 
		//exersize
		//Noktun pdf = ia_pdf(index , grade, q)
		//Fyrir: index og grade eru heilt�lur, index
		//er hversu margar spurningar eru � heildina fyrir �ann gl�rupakka, q er
		//t�lfr��i stu�ull
		//0<q<1 grade er einkun fyrir �ann gl�rupakka
		//Eftir: pdf er fylki me� �ettleika dreifingar fyrir hverja spurningu
		function ia_pdf(index, grade, q)
		{
			grade = grade / 10;                //einkannir fr� 0:1
			var x = new Array();
			for(var h = 0; h< index; h++)
				x[h] = (h+1)/(index+1.0);
			var alpha = q*grade;
			var beta = q - alpha;
			var y = new Array();
			for(i=0; i<x.length;i++)
				y[i]=1-x[i];
			arrayPower(x, alpha);                        //pdf=(x^alpha)*(1-x)^beta
			arrayPower(y, beta);
			var pdf = arrayMultiply(x, y);
			var sum = 0.0;                        //sum er summan �r �llum st�kum � pdf
			for(var j=0; j<x.length; j++)
				sum += pdf[j];
			arrayDividescalar(pdf, sum);
			return pdf;
		}
		
		function arrayMultiply(arrayx, arrayy)
		{
			var arrayz = new Array();
			for(var i = 0; i<arrayx.length; i++)
				arrayz[i] = arrayx[i] * arrayy[i];
			return arrayz	
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
}
	this.callGrade = function(answerQueue)
	{
		var currgrade, gradevec = new Array();
		for(var j = answerQueue.length-1; j >= 0; j--)
		{
			if(!answerQueue[j].practice)
			{
			if(typeof answerQueue[j].correct === 'undefined') gradevec.push(-0.5);
			else{
			if(answerQueue[j].correct) gradevec.push(1);
			else gradevec.push(-0.5);
			}
			}
		}
		currgrade = averageWeights(gradevec);
		if(currgrade[0] < 0) currgrade[0] = 0;
		if(currgrade[1] < 0) currgrade[1] = 0;
		if(currgrade[2] < 0) currgrade[2] = 0;
		return currgrade;
		
		//Use: var x = lastEight(answers)
		//Before: answers is an array with the answer pattern, 0 for wrong 1 for right
		//After: x is a 2 item array, the first item is the current score
		//the second is what the score will be if you answer correctly
		function lastEight(answers) 
		{
		var nomans = answers.slice();    //make a copy so the original is not touched
		if(nomans.length < 8)	//increase the size of the array if needed
		{
			while(nomans.length < 8) 
				nomans.push(0); 
		}
		var current = 0;		//current number of correct answers
		for(i = 0; i < 8 ; i++)
			current += nomans[i];
		var returner = Math.round((current/8*10)*4)/4;	//convert to 0-10 format (rounded to .25)
		var grade = new Array();
		grade[0] = returner;
		if(nomans[7] === 0) // determines if the score will change
		{
			current++;
			returner = Math.round((current/8*10)*4)/4; //ToDo possibly fix rounding
		}
		grade[1] = returner;
		return grade;
		}

		//Use: var x = bestEight(answers, d)
		//Before: answers is an array with the quiz history of the user for the 
		//current lecture, 0 for wrong and 1 for right, d is a boolean that is true if
		//the user has eight right answers somewere in the current lecture
		//After: x is a 3 item array, x[0] being the current grade, x[1] being the grade 
		//the next question is answered correctly and x[2] is a boolean that tells us if the
		//user has reached eight answers correct in a row
		function bestEight(answers, d)
		{
		var grade;
		if(d)		//no calculations neccesary if d
		{
			grade[0] = 10;
			grade[1] = 10;
			grade[2] = true;
			return grade;
		}
		var nomans = answers.slice();
		if(nomans.length < 8)	//increase the size of the array if needed
		{
			while(nomans.length < 8) 
				nomans.push(0); 
		}
		var current = 0;		//current number of correct answers
		for(i = 0; i < 8 ; i++)
			current += nomans[i];
		var returner = Math.round((current/8*10)*4)/4;	//convert to 0-10 format
		var grade = new Array();
		grade[0] = returner;
		if(returner == 10)
			grade[2] = true;
		else grade[2] = false;
		if(nomans[7] === 0) // determines if the score will change
		{
			current++;
			returner = Math.round((current/8*10)*4)/4;
		}
		grade[1] = returner;
		return grade;
		}	

		//Use: var vector = sevenWithweights(answers);
		//Before: answers is an array with values either 1 or 0 depending or right or wrong answers in the past
		//After: vector is a 2 item array giving current grade and next grade if you answer correctly
		//the first seven(last seven answers) are given a straight 0.1 weight, up to 7, while the rest is given a weight 
		//based on how many questions total have been answered (up to 23) with the latest having more weight	
		function sevenWithweights(answers) //ToDo - all print comments turn to console.log commands for debugging, and see if you can make +1 more smooth
		{
		var nomans = answers.slice(); //copy array not use the original
		var grade = new Array();
		var returner = 0;	//intermediary to be copied to grade[]
		var sum = 0;	//total sum to be tallied
		var debug = 0;
		var cumsum  = 0;	//sum of all weighted answers
		if(nomans.length < 7)
		{
			while(nomans.length < 7)
				nomans.push(0);
		}        
		for(i=0; i<7; i++){
			nomans[i] = nomans[i]/10;
			sum += nomans[i];}	//works like the other functions
		var weight = 7;
		while (weight < 23 && weight < nomans.length)	//determine how many answers after the seventh
			weight ++;    
		i=7;
		while(i<weight && i< nomans.length){
			nomans[i] = nomans[i]*((23-i)/(23-7)); //ToDo find out why this works
			if (nomans[i] === 0)
				cumsum += 1/2;
			else    
				cumsum += nomans[i];
			i++;
		}
		i=7;
		while(i<weight && i< nomans.length){
		   nomans[i] = nomans[i]/(cumsum)*0.3;
		   sum += nomans[i];
		   debug += nomans[i];
		   i++;}
		returner = (Math.round((sum*10)*4)/4).toFixed(2);
		grade[0] = parseFloat(returner);
		nomans = answers.slice();
		nomans.splice(0,0,1); // Next answer: ToDo can this be optimized?
		if(nomans.length < 7)
		{
			while(nomans.length < 7)
				nomans.push(0);
		}     
		returner = 0;
		sum = 0;	//total sum to be tallied
		debug = 0;
		cumsum  = 0;	//sum of all weighted answers
		for(i=0; i<7; i++){
			nomans[i] = nomans[i]/10;
			sum += nomans[i];}	//works like the other functions
		weight = 7;
		while (weight < 23 && weight < nomans.length)	//determine how many answers after the seventh
			weight ++;    
		i=7;
		while(i<weight && i< nomans.length){
			nomans[i] = nomans[i]*((23-i)/(23-7)); //ToDo find out why this works
			if (nomans[i] === 0)
				cumsum += 1/2;
			else    
				cumsum += nomans[i];
			i++;
		}
		i=7;
		while(i<weight && i< nomans.length){
		   nomans[i] = nomans[i]/(cumsum)*0.3;
		   sum += nomans[i];
		   i++;}
		returner = (Math.round((sum*10)*4)/4).toFixed(2);
		grade[1] = parseFloat(returner);
		return grade;  
		}

		//Use: var vector = averageWeights(answers);
		//Before: answers is an array with items consisting of 1's of 0's
		//After: vetor is a 2 item array giving a grade from 1-10 by using the formula:
		// (sum of n first items) / n * 10, where n = total number of items / 2.
		function averageWeights(answers)
		{
			var i;
			var nomans = answers.slice();	//make a copy so as to not change the original
			var t = nomans.length;		//likely redundant
			var sum = 0;		
			var n = Math.round(nomans.length/2); //divider for average
			var grade = new Array();
			if(nomans.length < 8){		//push 0 until 8
				while(nomans.length < 8){
					nomans.push(0);
				}
			}         
			if(nomans.length <= 16){	// works just like lastEight();
				for(i = 0; i<8; i++)
					sum += nomans[i];    
				sum = (Math.round((sum/8*10)*4)/4).toFixed(2);
				grade[0] = parseFloat(sum);
			}
			else if(nomans.length <= 60){	// takes more answers into your grade the more you try
				for (i=0; i<n; i++)
					sum += nomans[i];
				sum = (Math.round((sum/n*10)*4)/4).toFixed(2);  
				grade[0] = parseFloat(sum);
			} 
			else{
				for(i=0; i<30; i++)		// peaks at 60+ answers taking the first 30 answers into the grade
					sum += nomans[i];
				sum = (Math.round((sum/30*10)*4)/4).toFixed(2);
				grade[0] = parseFloat(sum);
			}
			nomans.splice(0,0,1);		//ToDo: just like the others, this might be better, however not in its current state
			sum = 0;
			n= Math.round(nomans.length /2);
			if(nomans.length < 8){
				while(nomans.length < 8){
					nomans.push(0);
				}
			}         
			if(nomans.length <= 16){
				for(i = 0; i<8; i++)
					sum += nomans[i];    
				sum = (Math.round((sum/8*10)*4)/4).toFixed(2);
				grade[1] = parseFloat(sum);
			}
			else if(nomans.length <= 60){
				for (i=0; i<n; i++)
					sum += nomans[i];
				sum = (Math.round((sum/n*10)*4)/4).toFixed(2);  
				grade[1] = parseFloat(sum);
			} 
			else{
				for(i=0; i<30; i++)
					sum += nomans[i];
				sum = (Math.round((sum/30*10)*4)/4).toFixed(2);
				grade[1] = parseFloat(sum);
			}
			nomans.shift();
			nomans.splice(0,0,-0.5);		//ToDo: just like the others, this might be better, however not in its current state
			sum = 0;
			n= Math.round(nomans.length /2);
			if(nomans.length < 8){
				while(nomans.length < 8){
					nomans.push(0);
				}
			}         
			if(nomans.length <= 16){
				for(i = 0; i<8; i++)
					sum += nomans[i];    
				sum = (Math.round((sum/8*10)*4)/4).toFixed(2);
				grade[2] = parseFloat(sum);
			}
			else if(nomans.length <= 60){
				for (i=0; i<n; i++)
					sum += nomans[i];
				sum = (Math.round((sum/n*10)*4)/4).toFixed(2);  
				grade[2] = parseFloat(sum);
			} 
			else{
				for(i=0; i<30; i++)
					sum += nomans[i];
				sum = (Math.round((sum/30*10)*4)/4).toFixed(2);
				grade[2] = parseFloat(sum);
			}
		return grade;
		}
	}
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
    if ($('body.quiz-load').length == 0) { return; }

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
        updateState("error", "Internal error: "
                           + message
                           + " (" + url + ":" + linenumber + ")");
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
                    quiz.setCurrentLecture({ "tutUri": url, "lecUri": data.lectures[i].uri }, function () {});  //TODO: Erg
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
    this.renderNewQuestion = function (qn, a) {
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
        self.jqGrade.text("Answered " + a.lec_answered + " questions, " + a.lec_correct + " correctly."
                         + "\nYour grade: " + a.grade_before
                         + "\nYour grade if you get the next question right:" + a.grade_after_right);
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
                     (a.selected_answer ? 'You chose ' + String.fromCharCode(97 + a.selected_answer) + '\n' : '')
                     + 'Answered ' + t.toLocaleDateString() + ' ' + t.toLocaleTimeString())
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
        quizView.updateState("error", "Internal error: "
                                    + message
                                    + " (" + url + ":" + linenumber + ")");
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
            quiz.getNewQuestion($('#tw-practice').hasClass("active"), function (qn, ordering) {
                quizView.renderNewQuestion(qn, ordering);
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
            window.open(quiz.portalRootUrl(document.location)
                       + '/login?came_from='
                       + encodeURIComponent(document.location.pathname.replace(/\/\w+\.html$/, '/close.html')),
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
        a.selected_answer = selectedAnswer;
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
    if ($('body.quiz-start').length == 0) { return; }

    // Catch any uncaught exceptions
    window.onerror = function (message, url, linenumber) {
        view.renderAlert("error", "Internal error: "
                                + message
                                + " (" + url + ":" + linenumber + ")");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvc3J2L2RldmVsL3dvcmsvaWNlcy50dXRvcndlYi9zcmMvdHV0b3J3ZWIucXVpei9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL3Nydi9kZXZlbC93b3JrL2ljZXMudHV0b3J3ZWIvc3JjL3R1dG9yd2ViLnF1aXovbGliL2lhYS5qcyIsIi9zcnYvZGV2ZWwvd29yay9pY2VzLnR1dG9yd2ViL3NyYy90dXRvcndlYi5xdWl6L2xpYi9sb2FkLmpzIiwiL3Nydi9kZXZlbC93b3JrL2ljZXMudHV0b3J3ZWIvc3JjL3R1dG9yd2ViLnF1aXovbGliL3F1aXouanMiLCIvc3J2L2RldmVsL3dvcmsvaWNlcy50dXRvcndlYi9zcmMvdHV0b3J3ZWIucXVpei9saWIvcXVpemxpYi5qcyIsIi9zcnYvZGV2ZWwvd29yay9pY2VzLnR1dG9yd2ViL3NyYy90dXRvcndlYi5xdWl6L2xpYi9zdGFydC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyWUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2ZUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gSUFBKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgLyoqXG4gICAgICAqIFBpY2sgYSBuZXcgcXVlc3Rpb24gZnJvbSB0aGUgY3VycmVudCBsZWN0dXJlIGJ5IGdlbmVyYXRpbmcgYSBuZXdcbiAgICAgICogYW5zd2VyUXVldWUgZW50cnlcbiAgICAgICpcbiAgICAgICogYW5zd2VyUXVldWUgcmVwcmVzZW50cyB0aGUgcXVlc3Rpb25zIGFzc2lnbmVkIHRvIGEgdXNlciBhbmQgdGhlaXIgYW5zd2Vycy5cbiAgICAgICogV2hlbiBhIHN0dWRlbnQgcmVxdWVzdHMgYSBuZXcgcXVlc3Rpb24sIHRoaXMgd2lsbCBiZSBjYWxsZWQgdG8gZ2VuZXJhdGVcbiAgICAgICogdGhlIG5leHQgYW5zd2VyUXVldWUgbWVtYmVyLiBPbmNlIHRoZXkgY2hvb3NlIGFuIGFuc3dlciwgaXQgd2lsbCBiZVxuICAgICAgKiBhbm5vdGF0ZWQgd2l0aCB0aGUgYW5zd2VyIHRoZXkgY2hvc2UuXG4gICAgICAqXG4gICAgICAqIGN1dFR1dG9yaWFsIC0gVGhlIGRhdGEgc3RydWN0dXJlIGZvciB0aGUgY3VycmVudCB0dXRvcmlhbFxuICAgICAgKiBsZWNJbmRleCAtIFRoZSBpbmRleCBvZiB0aGUgbGVjdHVyZSB0aGUgc3R1ZGVudCBpcyBjdXJyZW50bHkgdGFraW5nXG4gICAgICAqIGFuc3dlclF1ZXVlIC0gUHJldmlvdXMgc3R1ZGVudCBhbnN3ZXJzLCBtb3N0IHJlY2VudCBsYXN0XG4gICAgICAqIHByYWN0aWNlTW9kZSAtIFRydWUgaWYgc3R1ZGVudCBoYXMgZW5nYWdlZCBwcmFjdGljZSBtb2RlXG4gICAgICAqL1xuICAgIHRoaXMubmV3QWxsb2NhdGlvbiA9IGZ1bmN0aW9uKGN1clR1dG9yaWFsLCBsZWNJbmRleCwgYW5zd2VyUXVldWUsIHByYWN0aWNlTW9kZSkge1xuICAgICAgICB2YXIgcXVlc3Rpb25zLCBncmFkZW5vdyxcbiAgICAgICAgICAgIHNldHRpbmdzID0gY3VyVHV0b3JpYWwubGVjdHVyZXNbbGVjSW5kZXhdLnNldHRpbmdzIHx8IHtcImhpc3Rfc2VsXCI6IGN1clR1dG9yaWFsLmxlY3R1cmVzW2xlY0luZGV4XS5oaXN0X3NlbH07XG4gICAgICAgIGlmIChNYXRoLnJhbmRvbSgpIDwgcGFyc2VGbG9hdChzZXR0aW5ncy5oaXN0X3NlbCB8fCAwKSkge1xuICAgICAgICAgICAgcXVlc3Rpb25zID0gY3VyVHV0b3JpYWwubGVjdHVyZXNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKGxlY0luZGV4ICsgMSkpXS5xdWVzdGlvbnM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBxdWVzdGlvbnMgPSBjdXJUdXRvcmlhbC5sZWN0dXJlc1tsZWNJbmRleF0ucXVlc3Rpb25zO1xuICAgICAgICB9XG4gICAgICAgIGlmICghcXVlc3Rpb25zIHx8ICFxdWVzdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGdyYWRlbm93ID0gdGhpcy5jYWxsR3JhZGUoYW5zd2VyUXVldWUpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgXCJ1cmlcIjogcXVlc3Rpb25zW3RoaXMuaXRlbV9hbGxvY2F0aW9uKHF1ZXN0aW9ucywgZ3JhZGVub3dbMF0pXS51cmksXG4gICAgICAgICAgICBcImFsbG90dGVkX3RpbWVcIjogdGhpcy5xblRpbWVvdXQoc2V0dGluZ3MsIGdyYWRlbm93WzBdKSxcbiAgICAgICAgICAgIFwiZ3JhZGVfYmVmb3JlXCI6IGdyYWRlbm93WzBdLCAvL1RPRE86IFByZXZpb3VzIHF1ZXN0aW9uIHx8IDBcbiAgICAgICAgICAgIFwiZ3JhZGVfYWZ0ZXJfcmlnaHRcIjogcHJhY3RpY2VNb2RlID8gZ3JhZGVub3dbMF0gOiBncmFkZW5vd1sxXSxcbiAgICAgICAgICAgIFwiZ3JhZGVfYWZ0ZXJfd3JvbmdcIjogcHJhY3RpY2VNb2RlID8gZ3JhZGVub3dbMF0gOiBncmFkZW5vd1syXSxcbiAgICAgICAgICAgIFwibGVjX2Fuc3dlcmVkXCIgOiBBcnJheS5sYXN0KGFuc3dlclF1ZXVlKSA9PT0gbnVsbCA/IDAgOiAoQXJyYXkubGFzdChhbnN3ZXJRdWV1ZSkubGVjX2Fuc3dlcmVkIHx8IDApLFxuICAgICAgICAgICAgXCJsZWNfY29ycmVjdFwiIDogQXJyYXkubGFzdChhbnN3ZXJRdWV1ZSkgPT09IG51bGwgPyAwIDogKEFycmF5Lmxhc3QoYW5zd2VyUXVldWUpLmxlY19jb3JyZWN0IHx8IDApLFxuICAgICAgICAgICAgXCJwcmFjdGljZVwiOiBwcmFjdGljZU1vZGVcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgdGhpcy5ncmFkZUFsbG9jYXRpb24gPSBmdW5jdGlvbihhbnN3ZXJRdWV1ZSwgcHJhY3RpY2VNb2RlKSB7XG4gICAgfTtcblxuICAgIC8qKiBHaXZlbiB1c2VyJ3MgY3VycmVudCBncmFkZSwgcmV0dXJuIGhvdyBsb25nIHRoZXkgc2hvdWxkIGhhdmUgdG8gZG8gdGhlIG5leHQgcXVlc3Rpb24gaW4gc2Vjb25kcyg/KSAqL1xuICAgIHRoaXMucW5UaW1lb3V0ID0gZnVuY3Rpb24oc2V0dGluZ3MsIGdyYWRlKSB7XG4gICAgICAgIGZ1bmN0aW9uIGdldFNldHRpbmcobiwgZGVmVmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChpc05hTihwYXJzZUZsb2F0KHNldHRpbmdzW25dKSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVmVmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcGFyc2VGbG9hdChzZXR0aW5nc1tuXSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdE1heCwgdE1pbiwgZ3JhZGVhdmVyYWdlLCB0U3RkLCB0aW1lO1xuICAgICAgICAvLyBNYXggdGltZVxuICAgICAgICB0TWF4ID0gZ2V0U2V0dGluZygndGltZW91dF9tYXgnLCAxMCk7XG4gICAgICAgIC8vcGxhY2Vob2xkZXIgOiB0TWluIHdpbGwgYmUgcmFuZG9taXplZCAod2l0aCAyIGJlaW5nIHRoZSBtb3N0IGNvbW1vbikgYW5kIHNhdmVkIHRvIE15IFNRTFxuICAgICAgICB0TWluID0gZ2V0U2V0dGluZygndGltZW91dF9taW4nLCAzKTtcbiAgICAgICAgLy8gZyogOiB3aWxsIGxpa2VseSBiZSBmaXZlIGJ1dCBtaWdodCBjaGFuZ2VcbiAgICAgICAgZ3JhZGVhdmVyYWdlID0gZ2V0U2V0dGluZygndGltZW91dF9ncmFkZScsIDUpO1xuICAgICAgICAvL3dpbGwgYmUgMnNeMiB3aGVyZSBzID0gc3FydCgyKVxuICAgICAgICB0U3RkID0gZ2V0U2V0dGluZygndGltZW91dF9zdGQnLCAyICogTWF0aC5zcXJ0KDIpKTtcblxuICAgICAgICB0aW1lID0gdE1heCAqICgxLSgxLSh0TWluIC8gdE1heCkpICogTWF0aC5leHAoLShNYXRoLnBvdygoZ3JhZGUtZ3JhZGVhdmVyYWdlKSwyKSkvdFN0ZCkpO1xuICAgICAgICB0aW1lID0gTWF0aC5mbG9vcih0aW1lICogNjApO1xuICAgICAgICByZXR1cm4gdGltZTtcbiAgICB9O1xuXG5cdC8qKiBDaG9vc2UgYSBxdWVzdGlvbiBmcm9tIHRoZSBhcnJheSBiYXNlZCBvbiB0aGUgY3VycmVudCBncmFkZVxuXHQgICogcXVlc3Rpb25zOiBBbiBhcnJheSBvZiBvYmplY3RzLCBjb250YWluaW5nOi1cblx0ICAqICAgICBjaG9zZW46IE51bWJlciBvZiB0aW1lcyBxdWVzdGlvbiBoYXMgYmVlbiBhbnN3ZXJlZFxuXHQgICogICAgIGNvcnJlY3Q6IE9mIHRob3NlIHRpbWVzLCBob3cgbWFueSBhIHN0dWRlbnQgZ2F2ZSBhIGNvcnJlY3QgYW5zd2VyXG5cdCAgKiBncmFkZTogU3R1ZGVudCdzIGN1cnJlbnQgZ3JhZGUsIGFzIGNhbGN1bGF0ZWQgYnkgY2FsbEdyYWRlKClcblx0ICAqXG5cdCAgKiBSZXR1cm4gdGhlIGluZGV4IG9mIHRoZSBxdWVzdGlvbiB0byBhbnN3ZXJcblx0ICAqL1xuXHR0aGlzLml0ZW1fYWxsb2NhdGlvbiA9IGZ1bmN0aW9uKHF1ZXN0aW9ucywgZ3JhZGUpXG5cdHtcblx0XHR2YXIgaTtcblx0XHR2YXIgZHBhcmFtID0gcXVlc3Rpb25zLmxlbmd0aCAvIDEwLjA7XG5cdFx0dmFyIG51bXF1ZXN0aW9ucyA9IHF1ZXN0aW9ucy5sZW5ndGg7XG5cdFx0dmFyIGRpZmZpY3VsdHkgPSBxdWVzdGlvbnMubWFwKGZ1bmN0aW9uIChxbikge1xuXHRcdFx0Ly8gU2lnbmlmaWNhbnQgbnVtZXIgb2YgYW5zd2Vycywgc28gcGxhY2Ugbm9ybWFsbHlcblx0XHRcdGlmKHFuLmNob3NlbiA+IDUpIHJldHVybiAxLjAtIChxbi5jb3JyZWN0L3FuLmNob3Nlbik7XG5cblx0XHRcdC8vIE1ha2Ugc3VyZSBsb3ctbiBpdGVtcyBnZXRzIHBsYWNlZCBhdCBleHRyZW1lc1xuXHRcdFx0aWYoZ3JhZGUgPCAwKSByZXR1cm4gKCgocW4uY2hvc2VuLXFuLmNvcnJlY3QpLzIuMCkgKyBNYXRoLnJhbmRvbSgpKS8xMDAuMDtcblx0XHRcdHJldHVybiAxLjAgLSgoKHFuLmNob3Nlbi1xbi5jb3JyZWN0KS8yLjApICsgTWF0aC5yYW5kb20oKSkvMTAwLjA7XG5cdFx0fSk7XG5cdFx0dmFyIHJhbmtzID0gcmFua2luZyhkaWZmaWN1bHR5KTtcblx0XHR2YXIgcGRmID0gaWFfcGRmKG51bXF1ZXN0aW9ucywgZ3JhZGUsIGRwYXJhbSk7XG5cdFx0dmFyIHByb2J2ZWMgPSBuZXcgQXJyYXkoKTtcblx0XHRwcm9idmVjLmxlbmd0aCA9IG51bXF1ZXN0aW9ucztcblx0XHRmb3IoaSA9IDA7IGk8bnVtcXVlc3Rpb25zOyBpKyspXG5cdFx0e1xuXHRcdFx0XHRmb3IodmFyIGogPSAwOyBqPG51bXF1ZXN0aW9uczsgaisrKVxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRpZihyYW5rc1tqXSA9PSBpKVxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHByb2J2ZWNbal0gPSBwZGZbaV07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHR9XG5cdFx0dmFyIHV0bXAgPSBNYXRoLnJhbmRvbSgpO1xuXHRcdHZhciBzZWxlY3RlZGluZGV4PWlhX2ludmVyc2VfY2RmKHByb2J2ZWMsIHV0bXApO1xuXHRcdHJldHVybihzZWxlY3RlZGluZGV4KTtcblxuXG5cdFx0Ly9yZXR1cm5zIGEgcmV2ZXJzZSBjZGYoY3VtdWxhdGl2ZSBkaXN0cmlidXRpb24gZnVuY3Rpb24pIGZvciBcblx0XHQvL2EgZ2l2ZW4gcGRmIGFuZCBhIGdpdmVuIHUgPSBGKHgpXG5cdFx0Ly9maW5udXIg77+9ZnVndCBjZGYgKGN1bXVsYXRpdmUgZGlzdHJpYnV0aW9uIGZ1bmN0aW9uKSBtae+/vWHvv70gdmnvv71cblx0XHQvL2dlZmnvv70gcGRmIG9nIGVpdHRodmHvv70gZ2Vmae+/vSB1ID0gRih4KVxuXHRcdGZ1bmN0aW9uIGlhX2ludmVyc2VfY2RmKHBkZiwgdSlcblx0XHR7XG5cdFx0XHR2YXIgaSA9IDA7XG5cdFx0XHR2YXIgY3Vtc3VtPXBkZlswXTtcblx0XHRcdHdoaWxlKHU+Y3Vtc3VtKVxuXHRcdFx0e1xuXHRcdFx0XHRpICs9IDE7XG5cdFx0XHRcdGN1bXN1bSArPSBwZGZbaV07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaTtcblx0XHR9XG5cblx0XHQvL3JhbmtzIGlzIGFuIGFycmF5IHdpdGggdmFsdWVzIGZyb20gMCAtIHZlY3Rvci5sZW5ndGgtMVxuXHRcdC8vaW4gdGhlIG9yZGVyIG9mIHRoZSBzaXplcyBvZiB0aGUgaXRlbXMgaW4gdmVjdG9yXG5cdFx0Ly9leDogdmVjdG9yWzMsIDUsIDEsIDIsIDddIGJlY29tZXMgcmFua2luZ3NbMiwgMywgMCwgMSwgNF1cblx0XHQvL3JhbmtzIGVyIHZpZ3VyIG1l77+9IGdpbGRpIGZy77+9IDAtdmVjdG9yLmxlbmd0aC0xXG5cdFx0Ly9vZyByYe+/vWFzdCB1cHAgZWZ0aXIgc3Tvv71y77+9IO+/vSBnaWxkdW51bSDvv70gdmVjdG9yXG5cdFx0Ly9k77+9bWk6IHZlY3RvclszLCA1LCAxLCAyLCA3XSB277+9cmkgcmFua2luZ1syLCAzLCAwLCAxLCA0XVxuXHRcdGZ1bmN0aW9uIHJhbmtpbmcodmVjdG9yKVxuXHRcdHtcblx0XHRcdHZhciByYW5rID0gbmV3IEFycmF5KCk7XG5cdFx0XHRyYW5rLmxlbmd0aCA9IHZlY3Rvci5sZW5ndGg7XG5cdFx0XHR2YXIgZm91bmQgPSBuZXcgQXJyYXkoKTtcblx0XHRcdGZvdW5kLmxlbmd0aCA9IHZlY3Rvci5sZW5ndGg7XG5cdFx0XHRmb3IodmFyIGEgPSAwOyBhPGZvdW5kLmxlbmd0aDsgYSsrKVxuXHRcdFx0XHRmb3VuZFthXSA9IGZhbHNlO1xuXHRcdFx0Zm9yKHZhciBpID0gMDsgaTx2ZWN0b3IubGVuZ3RoOyBpKyspe1xuXHRcdFx0XHR2YXIgbWluID0gMTAwMDA7XG5cdFx0XHRcdHZhciBpbmRleCA9IDA7XG5cdFx0XHRcdGZvcih2YXIgaiA9IDA7IGo8dmVjdG9yLmxlbmd0aDsgaisrKVxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRpZih2ZWN0b3Jbal0gPD0gbWluICYmICFmb3VuZFtqXSl7XG5cdFx0XHRcdFx0XHRcdGluZGV4ID0gajtcblx0XHRcdFx0XHRcdFx0bWluID0gdmVjdG9yW2pdO31cblx0XHRcdFx0fVxuXHRcdFx0XHRyYW5rW2luZGV4XSA9IGk7XG5cdFx0XHRcdGZvdW5kW2luZGV4XSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmFuaztcblx0XHR9XG5cblxuXHRcdC8vVXNlOiBwZGYgPSBpYV9wZGYoaW5kZXgsIGdyYWRlLCBxKVxuXHRcdC8vQmVmb3JlOiBpbmRleCBhbmQgZ3JhZGUgYXJlIGludGVnZXJzIGFuZCAwPHE8MVxuXHRcdC8vaW5kZXggc3BlY2lmaWVzIGhvdyBtYW55IHF1ZXN0aW9ucyB0aGVyZSBhcmUgaW4gdGhlIGN1cnJlbnQgZXhlcnNpemVcblx0XHQvL2dyYWRlIGlzIHRoZSB1c2VycyBjdXJyZW50IGdyYWRlIChjdXJyZW50bHkgb24gdGhlIHNjYWxlIG9mIC0wLjUgLSAxXG5cdFx0Ly9BZnRlcjogcGRmIGlzIGFuIGFycmF5IHdpdGggdGhlIHByb2JhYmlsaXR5IGRlbnNpdHkgZGlzdHJpYnV0aW9uIG9mIHRoZSBjdXJyZW50IFxuXHRcdC8vZXhlcnNpemVcblx0XHQvL05va3R1biBwZGYgPSBpYV9wZGYoaW5kZXggLCBncmFkZSwgcSlcblx0XHQvL0Z5cmlyOiBpbmRleCBvZyBncmFkZSBlcnUgaGVpbHTvv71sdXIsIGluZGV4XG5cdFx0Ly9lciBodmVyc3UgbWFyZ2FyIHNwdXJuaW5nYXIgZXJ1IO+/vSBoZWlsZGluYSBmeXJpciDvv71hbm4gZ2zvv71ydXBha2thLCBxIGVyXG5cdFx0Ly9077+9bGZy77+977+9aSBzdHXvv711bGxcblx0XHQvLzA8cTwxIGdyYWRlIGVyIGVpbmt1biBmeXJpciDvv71hbm4gZ2zvv71ydXBha2thXG5cdFx0Ly9FZnRpcjogcGRmIGVyIGZ5bGtpIG1l77+9IO+/vWV0dGxlaWthIGRyZWlmaW5nYXIgZnlyaXIgaHZlcmphIHNwdXJuaW5ndVxuXHRcdGZ1bmN0aW9uIGlhX3BkZihpbmRleCwgZ3JhZGUsIHEpXG5cdFx0e1xuXHRcdFx0Z3JhZGUgPSBncmFkZSAvIDEwOyAgICAgICAgICAgICAgICAvL2Vpbmthbm5pciBmcu+/vSAwOjFcblx0XHRcdHZhciB4ID0gbmV3IEFycmF5KCk7XG5cdFx0XHRmb3IodmFyIGggPSAwOyBoPCBpbmRleDsgaCsrKVxuXHRcdFx0XHR4W2hdID0gKGgrMSkvKGluZGV4KzEuMCk7XG5cdFx0XHR2YXIgYWxwaGEgPSBxKmdyYWRlO1xuXHRcdFx0dmFyIGJldGEgPSBxIC0gYWxwaGE7XG5cdFx0XHR2YXIgeSA9IG5ldyBBcnJheSgpO1xuXHRcdFx0Zm9yKGk9MDsgaTx4Lmxlbmd0aDtpKyspXG5cdFx0XHRcdHlbaV09MS14W2ldO1xuXHRcdFx0YXJyYXlQb3dlcih4LCBhbHBoYSk7ICAgICAgICAgICAgICAgICAgICAgICAgLy9wZGY9KHheYWxwaGEpKigxLXgpXmJldGFcblx0XHRcdGFycmF5UG93ZXIoeSwgYmV0YSk7XG5cdFx0XHR2YXIgcGRmID0gYXJyYXlNdWx0aXBseSh4LCB5KTtcblx0XHRcdHZhciBzdW0gPSAwLjA7ICAgICAgICAgICAgICAgICAgICAgICAgLy9zdW0gZXIgc3VtbWFuIO+/vXIg77+9bGx1bSBzdO+/vWt1bSDvv70gcGRmXG5cdFx0XHRmb3IodmFyIGo9MDsgajx4Lmxlbmd0aDsgaisrKVxuXHRcdFx0XHRzdW0gKz0gcGRmW2pdO1xuXHRcdFx0YXJyYXlEaXZpZGVzY2FsYXIocGRmLCBzdW0pO1xuXHRcdFx0cmV0dXJuIHBkZjtcblx0XHR9XG5cdFx0XG5cdFx0ZnVuY3Rpb24gYXJyYXlNdWx0aXBseShhcnJheXgsIGFycmF5eSlcblx0XHR7XG5cdFx0XHR2YXIgYXJyYXl6ID0gbmV3IEFycmF5KCk7XG5cdFx0XHRmb3IodmFyIGkgPSAwOyBpPGFycmF5eC5sZW5ndGg7IGkrKylcblx0XHRcdFx0YXJyYXl6W2ldID0gYXJyYXl4W2ldICogYXJyYXl5W2ldO1xuXHRcdFx0cmV0dXJuIGFycmF5elx0XG5cdFx0fVxuXHRcdFxuXHRcdGZ1bmN0aW9uIGFycmF5UG93ZXIoYXJyYXksIHBvd2VyKVxuXHRcdHtcblx0XHRcdGZvcih2YXIgaSA9IDA7IGk8IGFycmF5Lmxlbmd0aDsgaSsrKVxuXHRcdFx0XHRhcnJheVtpXSA9IE1hdGgucG93KGFycmF5W2ldLCBwb3dlcik7XG5cdFx0XHRyZXR1cm4gYXJyYXk7XHRcblx0XHR9XG5cdFx0XG5cdFx0ZnVuY3Rpb24gYXJyYXlEaXZpZGVzY2FsYXIoYXJyYXksIHNjYWxhcilcblx0XHR7XG5cdFx0XHRmb3IodmFyIGkgPSAwOyBpPGFycmF5Lmxlbmd0aDsgaSsrKVxuXHRcdFx0XHRhcnJheVtpXSA9IGFycmF5W2ldL3NjYWxhcjtcblx0XHRcdHJldHVybiBhcnJheTtcdFxuXHRcdH1cbn1cblx0dGhpcy5jYWxsR3JhZGUgPSBmdW5jdGlvbihhbnN3ZXJRdWV1ZSlcblx0e1xuXHRcdHZhciBjdXJyZ3JhZGUsIGdyYWRldmVjID0gbmV3IEFycmF5KCk7XG5cdFx0Zm9yKHZhciBqID0gYW5zd2VyUXVldWUubGVuZ3RoLTE7IGogPj0gMDsgai0tKVxuXHRcdHtcblx0XHRcdGlmKCFhbnN3ZXJRdWV1ZVtqXS5wcmFjdGljZSlcblx0XHRcdHtcblx0XHRcdGlmKHR5cGVvZiBhbnN3ZXJRdWV1ZVtqXS5jb3JyZWN0ID09PSAndW5kZWZpbmVkJykgZ3JhZGV2ZWMucHVzaCgtMC41KTtcblx0XHRcdGVsc2V7XG5cdFx0XHRpZihhbnN3ZXJRdWV1ZVtqXS5jb3JyZWN0KSBncmFkZXZlYy5wdXNoKDEpO1xuXHRcdFx0ZWxzZSBncmFkZXZlYy5wdXNoKC0wLjUpO1xuXHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRjdXJyZ3JhZGUgPSBhdmVyYWdlV2VpZ2h0cyhncmFkZXZlYyk7XG5cdFx0aWYoY3VycmdyYWRlWzBdIDwgMCkgY3VycmdyYWRlWzBdID0gMDtcblx0XHRpZihjdXJyZ3JhZGVbMV0gPCAwKSBjdXJyZ3JhZGVbMV0gPSAwO1xuXHRcdGlmKGN1cnJncmFkZVsyXSA8IDApIGN1cnJncmFkZVsyXSA9IDA7XG5cdFx0cmV0dXJuIGN1cnJncmFkZTtcblx0XHRcblx0XHQvL1VzZTogdmFyIHggPSBsYXN0RWlnaHQoYW5zd2Vycylcblx0XHQvL0JlZm9yZTogYW5zd2VycyBpcyBhbiBhcnJheSB3aXRoIHRoZSBhbnN3ZXIgcGF0dGVybiwgMCBmb3Igd3JvbmcgMSBmb3IgcmlnaHRcblx0XHQvL0FmdGVyOiB4IGlzIGEgMiBpdGVtIGFycmF5LCB0aGUgZmlyc3QgaXRlbSBpcyB0aGUgY3VycmVudCBzY29yZVxuXHRcdC8vdGhlIHNlY29uZCBpcyB3aGF0IHRoZSBzY29yZSB3aWxsIGJlIGlmIHlvdSBhbnN3ZXIgY29ycmVjdGx5XG5cdFx0ZnVuY3Rpb24gbGFzdEVpZ2h0KGFuc3dlcnMpIFxuXHRcdHtcblx0XHR2YXIgbm9tYW5zID0gYW5zd2Vycy5zbGljZSgpOyAgICAvL21ha2UgYSBjb3B5IHNvIHRoZSBvcmlnaW5hbCBpcyBub3QgdG91Y2hlZFxuXHRcdGlmKG5vbWFucy5sZW5ndGggPCA4KVx0Ly9pbmNyZWFzZSB0aGUgc2l6ZSBvZiB0aGUgYXJyYXkgaWYgbmVlZGVkXG5cdFx0e1xuXHRcdFx0d2hpbGUobm9tYW5zLmxlbmd0aCA8IDgpIFxuXHRcdFx0XHRub21hbnMucHVzaCgwKTsgXG5cdFx0fVxuXHRcdHZhciBjdXJyZW50ID0gMDtcdFx0Ly9jdXJyZW50IG51bWJlciBvZiBjb3JyZWN0IGFuc3dlcnNcblx0XHRmb3IoaSA9IDA7IGkgPCA4IDsgaSsrKVxuXHRcdFx0Y3VycmVudCArPSBub21hbnNbaV07XG5cdFx0dmFyIHJldHVybmVyID0gTWF0aC5yb3VuZCgoY3VycmVudC84KjEwKSo0KS80O1x0Ly9jb252ZXJ0IHRvIDAtMTAgZm9ybWF0IChyb3VuZGVkIHRvIC4yNSlcblx0XHR2YXIgZ3JhZGUgPSBuZXcgQXJyYXkoKTtcblx0XHRncmFkZVswXSA9IHJldHVybmVyO1xuXHRcdGlmKG5vbWFuc1s3XSA9PT0gMCkgLy8gZGV0ZXJtaW5lcyBpZiB0aGUgc2NvcmUgd2lsbCBjaGFuZ2Vcblx0XHR7XG5cdFx0XHRjdXJyZW50Kys7XG5cdFx0XHRyZXR1cm5lciA9IE1hdGgucm91bmQoKGN1cnJlbnQvOCoxMCkqNCkvNDsgLy9Ub0RvIHBvc3NpYmx5IGZpeCByb3VuZGluZ1xuXHRcdH1cblx0XHRncmFkZVsxXSA9IHJldHVybmVyO1xuXHRcdHJldHVybiBncmFkZTtcblx0XHR9XG5cblx0XHQvL1VzZTogdmFyIHggPSBiZXN0RWlnaHQoYW5zd2VycywgZClcblx0XHQvL0JlZm9yZTogYW5zd2VycyBpcyBhbiBhcnJheSB3aXRoIHRoZSBxdWl6IGhpc3Rvcnkgb2YgdGhlIHVzZXIgZm9yIHRoZSBcblx0XHQvL2N1cnJlbnQgbGVjdHVyZSwgMCBmb3Igd3JvbmcgYW5kIDEgZm9yIHJpZ2h0LCBkIGlzIGEgYm9vbGVhbiB0aGF0IGlzIHRydWUgaWZcblx0XHQvL3RoZSB1c2VyIGhhcyBlaWdodCByaWdodCBhbnN3ZXJzIHNvbWV3ZXJlIGluIHRoZSBjdXJyZW50IGxlY3R1cmVcblx0XHQvL0FmdGVyOiB4IGlzIGEgMyBpdGVtIGFycmF5LCB4WzBdIGJlaW5nIHRoZSBjdXJyZW50IGdyYWRlLCB4WzFdIGJlaW5nIHRoZSBncmFkZSBcblx0XHQvL3RoZSBuZXh0IHF1ZXN0aW9uIGlzIGFuc3dlcmVkIGNvcnJlY3RseSBhbmQgeFsyXSBpcyBhIGJvb2xlYW4gdGhhdCB0ZWxscyB1cyBpZiB0aGVcblx0XHQvL3VzZXIgaGFzIHJlYWNoZWQgZWlnaHQgYW5zd2VycyBjb3JyZWN0IGluIGEgcm93XG5cdFx0ZnVuY3Rpb24gYmVzdEVpZ2h0KGFuc3dlcnMsIGQpXG5cdFx0e1xuXHRcdHZhciBncmFkZTtcblx0XHRpZihkKVx0XHQvL25vIGNhbGN1bGF0aW9ucyBuZWNjZXNhcnkgaWYgZFxuXHRcdHtcblx0XHRcdGdyYWRlWzBdID0gMTA7XG5cdFx0XHRncmFkZVsxXSA9IDEwO1xuXHRcdFx0Z3JhZGVbMl0gPSB0cnVlO1xuXHRcdFx0cmV0dXJuIGdyYWRlO1xuXHRcdH1cblx0XHR2YXIgbm9tYW5zID0gYW5zd2Vycy5zbGljZSgpO1xuXHRcdGlmKG5vbWFucy5sZW5ndGggPCA4KVx0Ly9pbmNyZWFzZSB0aGUgc2l6ZSBvZiB0aGUgYXJyYXkgaWYgbmVlZGVkXG5cdFx0e1xuXHRcdFx0d2hpbGUobm9tYW5zLmxlbmd0aCA8IDgpIFxuXHRcdFx0XHRub21hbnMucHVzaCgwKTsgXG5cdFx0fVxuXHRcdHZhciBjdXJyZW50ID0gMDtcdFx0Ly9jdXJyZW50IG51bWJlciBvZiBjb3JyZWN0IGFuc3dlcnNcblx0XHRmb3IoaSA9IDA7IGkgPCA4IDsgaSsrKVxuXHRcdFx0Y3VycmVudCArPSBub21hbnNbaV07XG5cdFx0dmFyIHJldHVybmVyID0gTWF0aC5yb3VuZCgoY3VycmVudC84KjEwKSo0KS80O1x0Ly9jb252ZXJ0IHRvIDAtMTAgZm9ybWF0XG5cdFx0dmFyIGdyYWRlID0gbmV3IEFycmF5KCk7XG5cdFx0Z3JhZGVbMF0gPSByZXR1cm5lcjtcblx0XHRpZihyZXR1cm5lciA9PSAxMClcblx0XHRcdGdyYWRlWzJdID0gdHJ1ZTtcblx0XHRlbHNlIGdyYWRlWzJdID0gZmFsc2U7XG5cdFx0aWYobm9tYW5zWzddID09PSAwKSAvLyBkZXRlcm1pbmVzIGlmIHRoZSBzY29yZSB3aWxsIGNoYW5nZVxuXHRcdHtcblx0XHRcdGN1cnJlbnQrKztcblx0XHRcdHJldHVybmVyID0gTWF0aC5yb3VuZCgoY3VycmVudC84KjEwKSo0KS80O1xuXHRcdH1cblx0XHRncmFkZVsxXSA9IHJldHVybmVyO1xuXHRcdHJldHVybiBncmFkZTtcblx0XHR9XHRcblxuXHRcdC8vVXNlOiB2YXIgdmVjdG9yID0gc2V2ZW5XaXRod2VpZ2h0cyhhbnN3ZXJzKTtcblx0XHQvL0JlZm9yZTogYW5zd2VycyBpcyBhbiBhcnJheSB3aXRoIHZhbHVlcyBlaXRoZXIgMSBvciAwIGRlcGVuZGluZyBvciByaWdodCBvciB3cm9uZyBhbnN3ZXJzIGluIHRoZSBwYXN0XG5cdFx0Ly9BZnRlcjogdmVjdG9yIGlzIGEgMiBpdGVtIGFycmF5IGdpdmluZyBjdXJyZW50IGdyYWRlIGFuZCBuZXh0IGdyYWRlIGlmIHlvdSBhbnN3ZXIgY29ycmVjdGx5XG5cdFx0Ly90aGUgZmlyc3Qgc2V2ZW4obGFzdCBzZXZlbiBhbnN3ZXJzKSBhcmUgZ2l2ZW4gYSBzdHJhaWdodCAwLjEgd2VpZ2h0LCB1cCB0byA3LCB3aGlsZSB0aGUgcmVzdCBpcyBnaXZlbiBhIHdlaWdodCBcblx0XHQvL2Jhc2VkIG9uIGhvdyBtYW55IHF1ZXN0aW9ucyB0b3RhbCBoYXZlIGJlZW4gYW5zd2VyZWQgKHVwIHRvIDIzKSB3aXRoIHRoZSBsYXRlc3QgaGF2aW5nIG1vcmUgd2VpZ2h0XHRcblx0XHRmdW5jdGlvbiBzZXZlbldpdGh3ZWlnaHRzKGFuc3dlcnMpIC8vVG9EbyAtIGFsbCBwcmludCBjb21tZW50cyB0dXJuIHRvIGNvbnNvbGUubG9nIGNvbW1hbmRzIGZvciBkZWJ1Z2dpbmcsIGFuZCBzZWUgaWYgeW91IGNhbiBtYWtlICsxIG1vcmUgc21vb3RoXG5cdFx0e1xuXHRcdHZhciBub21hbnMgPSBhbnN3ZXJzLnNsaWNlKCk7IC8vY29weSBhcnJheSBub3QgdXNlIHRoZSBvcmlnaW5hbFxuXHRcdHZhciBncmFkZSA9IG5ldyBBcnJheSgpO1xuXHRcdHZhciByZXR1cm5lciA9IDA7XHQvL2ludGVybWVkaWFyeSB0byBiZSBjb3BpZWQgdG8gZ3JhZGVbXVxuXHRcdHZhciBzdW0gPSAwO1x0Ly90b3RhbCBzdW0gdG8gYmUgdGFsbGllZFxuXHRcdHZhciBkZWJ1ZyA9IDA7XG5cdFx0dmFyIGN1bXN1bSAgPSAwO1x0Ly9zdW0gb2YgYWxsIHdlaWdodGVkIGFuc3dlcnNcblx0XHRpZihub21hbnMubGVuZ3RoIDwgNylcblx0XHR7XG5cdFx0XHR3aGlsZShub21hbnMubGVuZ3RoIDwgNylcblx0XHRcdFx0bm9tYW5zLnB1c2goMCk7XG5cdFx0fSAgICAgICAgXG5cdFx0Zm9yKGk9MDsgaTw3OyBpKyspe1xuXHRcdFx0bm9tYW5zW2ldID0gbm9tYW5zW2ldLzEwO1xuXHRcdFx0c3VtICs9IG5vbWFuc1tpXTt9XHQvL3dvcmtzIGxpa2UgdGhlIG90aGVyIGZ1bmN0aW9uc1xuXHRcdHZhciB3ZWlnaHQgPSA3O1xuXHRcdHdoaWxlICh3ZWlnaHQgPCAyMyAmJiB3ZWlnaHQgPCBub21hbnMubGVuZ3RoKVx0Ly9kZXRlcm1pbmUgaG93IG1hbnkgYW5zd2VycyBhZnRlciB0aGUgc2V2ZW50aFxuXHRcdFx0d2VpZ2h0ICsrOyAgICBcblx0XHRpPTc7XG5cdFx0d2hpbGUoaTx3ZWlnaHQgJiYgaTwgbm9tYW5zLmxlbmd0aCl7XG5cdFx0XHRub21hbnNbaV0gPSBub21hbnNbaV0qKCgyMy1pKS8oMjMtNykpOyAvL1RvRG8gZmluZCBvdXQgd2h5IHRoaXMgd29ya3Ncblx0XHRcdGlmIChub21hbnNbaV0gPT09IDApXG5cdFx0XHRcdGN1bXN1bSArPSAxLzI7XG5cdFx0XHRlbHNlICAgIFxuXHRcdFx0XHRjdW1zdW0gKz0gbm9tYW5zW2ldO1xuXHRcdFx0aSsrO1xuXHRcdH1cblx0XHRpPTc7XG5cdFx0d2hpbGUoaTx3ZWlnaHQgJiYgaTwgbm9tYW5zLmxlbmd0aCl7XG5cdFx0ICAgbm9tYW5zW2ldID0gbm9tYW5zW2ldLyhjdW1zdW0pKjAuMztcblx0XHQgICBzdW0gKz0gbm9tYW5zW2ldO1xuXHRcdCAgIGRlYnVnICs9IG5vbWFuc1tpXTtcblx0XHQgICBpKys7fVxuXHRcdHJldHVybmVyID0gKE1hdGgucm91bmQoKHN1bSoxMCkqNCkvNCkudG9GaXhlZCgyKTtcblx0XHRncmFkZVswXSA9IHBhcnNlRmxvYXQocmV0dXJuZXIpO1xuXHRcdG5vbWFucyA9IGFuc3dlcnMuc2xpY2UoKTtcblx0XHRub21hbnMuc3BsaWNlKDAsMCwxKTsgLy8gTmV4dCBhbnN3ZXI6IFRvRG8gY2FuIHRoaXMgYmUgb3B0aW1pemVkP1xuXHRcdGlmKG5vbWFucy5sZW5ndGggPCA3KVxuXHRcdHtcblx0XHRcdHdoaWxlKG5vbWFucy5sZW5ndGggPCA3KVxuXHRcdFx0XHRub21hbnMucHVzaCgwKTtcblx0XHR9ICAgICBcblx0XHRyZXR1cm5lciA9IDA7XG5cdFx0c3VtID0gMDtcdC8vdG90YWwgc3VtIHRvIGJlIHRhbGxpZWRcblx0XHRkZWJ1ZyA9IDA7XG5cdFx0Y3Vtc3VtICA9IDA7XHQvL3N1bSBvZiBhbGwgd2VpZ2h0ZWQgYW5zd2Vyc1xuXHRcdGZvcihpPTA7IGk8NzsgaSsrKXtcblx0XHRcdG5vbWFuc1tpXSA9IG5vbWFuc1tpXS8xMDtcblx0XHRcdHN1bSArPSBub21hbnNbaV07fVx0Ly93b3JrcyBsaWtlIHRoZSBvdGhlciBmdW5jdGlvbnNcblx0XHR3ZWlnaHQgPSA3O1xuXHRcdHdoaWxlICh3ZWlnaHQgPCAyMyAmJiB3ZWlnaHQgPCBub21hbnMubGVuZ3RoKVx0Ly9kZXRlcm1pbmUgaG93IG1hbnkgYW5zd2VycyBhZnRlciB0aGUgc2V2ZW50aFxuXHRcdFx0d2VpZ2h0ICsrOyAgICBcblx0XHRpPTc7XG5cdFx0d2hpbGUoaTx3ZWlnaHQgJiYgaTwgbm9tYW5zLmxlbmd0aCl7XG5cdFx0XHRub21hbnNbaV0gPSBub21hbnNbaV0qKCgyMy1pKS8oMjMtNykpOyAvL1RvRG8gZmluZCBvdXQgd2h5IHRoaXMgd29ya3Ncblx0XHRcdGlmIChub21hbnNbaV0gPT09IDApXG5cdFx0XHRcdGN1bXN1bSArPSAxLzI7XG5cdFx0XHRlbHNlICAgIFxuXHRcdFx0XHRjdW1zdW0gKz0gbm9tYW5zW2ldO1xuXHRcdFx0aSsrO1xuXHRcdH1cblx0XHRpPTc7XG5cdFx0d2hpbGUoaTx3ZWlnaHQgJiYgaTwgbm9tYW5zLmxlbmd0aCl7XG5cdFx0ICAgbm9tYW5zW2ldID0gbm9tYW5zW2ldLyhjdW1zdW0pKjAuMztcblx0XHQgICBzdW0gKz0gbm9tYW5zW2ldO1xuXHRcdCAgIGkrKzt9XG5cdFx0cmV0dXJuZXIgPSAoTWF0aC5yb3VuZCgoc3VtKjEwKSo0KS80KS50b0ZpeGVkKDIpO1xuXHRcdGdyYWRlWzFdID0gcGFyc2VGbG9hdChyZXR1cm5lcik7XG5cdFx0cmV0dXJuIGdyYWRlOyAgXG5cdFx0fVxuXG5cdFx0Ly9Vc2U6IHZhciB2ZWN0b3IgPSBhdmVyYWdlV2VpZ2h0cyhhbnN3ZXJzKTtcblx0XHQvL0JlZm9yZTogYW5zd2VycyBpcyBhbiBhcnJheSB3aXRoIGl0ZW1zIGNvbnNpc3Rpbmcgb2YgMSdzIG9mIDAnc1xuXHRcdC8vQWZ0ZXI6IHZldG9yIGlzIGEgMiBpdGVtIGFycmF5IGdpdmluZyBhIGdyYWRlIGZyb20gMS0xMCBieSB1c2luZyB0aGUgZm9ybXVsYTpcblx0XHQvLyAoc3VtIG9mIG4gZmlyc3QgaXRlbXMpIC8gbiAqIDEwLCB3aGVyZSBuID0gdG90YWwgbnVtYmVyIG9mIGl0ZW1zIC8gMi5cblx0XHRmdW5jdGlvbiBhdmVyYWdlV2VpZ2h0cyhhbnN3ZXJzKVxuXHRcdHtcblx0XHRcdHZhciBpO1xuXHRcdFx0dmFyIG5vbWFucyA9IGFuc3dlcnMuc2xpY2UoKTtcdC8vbWFrZSBhIGNvcHkgc28gYXMgdG8gbm90IGNoYW5nZSB0aGUgb3JpZ2luYWxcblx0XHRcdHZhciB0ID0gbm9tYW5zLmxlbmd0aDtcdFx0Ly9saWtlbHkgcmVkdW5kYW50XG5cdFx0XHR2YXIgc3VtID0gMDtcdFx0XG5cdFx0XHR2YXIgbiA9IE1hdGgucm91bmQobm9tYW5zLmxlbmd0aC8yKTsgLy9kaXZpZGVyIGZvciBhdmVyYWdlXG5cdFx0XHR2YXIgZ3JhZGUgPSBuZXcgQXJyYXkoKTtcblx0XHRcdGlmKG5vbWFucy5sZW5ndGggPCA4KXtcdFx0Ly9wdXNoIDAgdW50aWwgOFxuXHRcdFx0XHR3aGlsZShub21hbnMubGVuZ3RoIDwgOCl7XG5cdFx0XHRcdFx0bm9tYW5zLnB1c2goMCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gICAgICAgICBcblx0XHRcdGlmKG5vbWFucy5sZW5ndGggPD0gMTYpe1x0Ly8gd29ya3MganVzdCBsaWtlIGxhc3RFaWdodCgpO1xuXHRcdFx0XHRmb3IoaSA9IDA7IGk8ODsgaSsrKVxuXHRcdFx0XHRcdHN1bSArPSBub21hbnNbaV07ICAgIFxuXHRcdFx0XHRzdW0gPSAoTWF0aC5yb3VuZCgoc3VtLzgqMTApKjQpLzQpLnRvRml4ZWQoMik7XG5cdFx0XHRcdGdyYWRlWzBdID0gcGFyc2VGbG9hdChzdW0pO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZihub21hbnMubGVuZ3RoIDw9IDYwKXtcdC8vIHRha2VzIG1vcmUgYW5zd2VycyBpbnRvIHlvdXIgZ3JhZGUgdGhlIG1vcmUgeW91IHRyeVxuXHRcdFx0XHRmb3IgKGk9MDsgaTxuOyBpKyspXG5cdFx0XHRcdFx0c3VtICs9IG5vbWFuc1tpXTtcblx0XHRcdFx0c3VtID0gKE1hdGgucm91bmQoKHN1bS9uKjEwKSo0KS80KS50b0ZpeGVkKDIpOyAgXG5cdFx0XHRcdGdyYWRlWzBdID0gcGFyc2VGbG9hdChzdW0pO1xuXHRcdFx0fSBcblx0XHRcdGVsc2V7XG5cdFx0XHRcdGZvcihpPTA7IGk8MzA7IGkrKylcdFx0Ly8gcGVha3MgYXQgNjArIGFuc3dlcnMgdGFraW5nIHRoZSBmaXJzdCAzMCBhbnN3ZXJzIGludG8gdGhlIGdyYWRlXG5cdFx0XHRcdFx0c3VtICs9IG5vbWFuc1tpXTtcblx0XHRcdFx0c3VtID0gKE1hdGgucm91bmQoKHN1bS8zMCoxMCkqNCkvNCkudG9GaXhlZCgyKTtcblx0XHRcdFx0Z3JhZGVbMF0gPSBwYXJzZUZsb2F0KHN1bSk7XG5cdFx0XHR9XG5cdFx0XHRub21hbnMuc3BsaWNlKDAsMCwxKTtcdFx0Ly9Ub0RvOiBqdXN0IGxpa2UgdGhlIG90aGVycywgdGhpcyBtaWdodCBiZSBiZXR0ZXIsIGhvd2V2ZXIgbm90IGluIGl0cyBjdXJyZW50IHN0YXRlXG5cdFx0XHRzdW0gPSAwO1xuXHRcdFx0bj0gTWF0aC5yb3VuZChub21hbnMubGVuZ3RoIC8yKTtcblx0XHRcdGlmKG5vbWFucy5sZW5ndGggPCA4KXtcblx0XHRcdFx0d2hpbGUobm9tYW5zLmxlbmd0aCA8IDgpe1xuXHRcdFx0XHRcdG5vbWFucy5wdXNoKDApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICAgICAgICAgXG5cdFx0XHRpZihub21hbnMubGVuZ3RoIDw9IDE2KXtcblx0XHRcdFx0Zm9yKGkgPSAwOyBpPDg7IGkrKylcblx0XHRcdFx0XHRzdW0gKz0gbm9tYW5zW2ldOyAgICBcblx0XHRcdFx0c3VtID0gKE1hdGgucm91bmQoKHN1bS84KjEwKSo0KS80KS50b0ZpeGVkKDIpO1xuXHRcdFx0XHRncmFkZVsxXSA9IHBhcnNlRmxvYXQoc3VtKTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYobm9tYW5zLmxlbmd0aCA8PSA2MCl7XG5cdFx0XHRcdGZvciAoaT0wOyBpPG47IGkrKylcblx0XHRcdFx0XHRzdW0gKz0gbm9tYW5zW2ldO1xuXHRcdFx0XHRzdW0gPSAoTWF0aC5yb3VuZCgoc3VtL24qMTApKjQpLzQpLnRvRml4ZWQoMik7ICBcblx0XHRcdFx0Z3JhZGVbMV0gPSBwYXJzZUZsb2F0KHN1bSk7XG5cdFx0XHR9IFxuXHRcdFx0ZWxzZXtcblx0XHRcdFx0Zm9yKGk9MDsgaTwzMDsgaSsrKVxuXHRcdFx0XHRcdHN1bSArPSBub21hbnNbaV07XG5cdFx0XHRcdHN1bSA9IChNYXRoLnJvdW5kKChzdW0vMzAqMTApKjQpLzQpLnRvRml4ZWQoMik7XG5cdFx0XHRcdGdyYWRlWzFdID0gcGFyc2VGbG9hdChzdW0pO1xuXHRcdFx0fVxuXHRcdFx0bm9tYW5zLnNoaWZ0KCk7XG5cdFx0XHRub21hbnMuc3BsaWNlKDAsMCwtMC41KTtcdFx0Ly9Ub0RvOiBqdXN0IGxpa2UgdGhlIG90aGVycywgdGhpcyBtaWdodCBiZSBiZXR0ZXIsIGhvd2V2ZXIgbm90IGluIGl0cyBjdXJyZW50IHN0YXRlXG5cdFx0XHRzdW0gPSAwO1xuXHRcdFx0bj0gTWF0aC5yb3VuZChub21hbnMubGVuZ3RoIC8yKTtcblx0XHRcdGlmKG5vbWFucy5sZW5ndGggPCA4KXtcblx0XHRcdFx0d2hpbGUobm9tYW5zLmxlbmd0aCA8IDgpe1xuXHRcdFx0XHRcdG5vbWFucy5wdXNoKDApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICAgICAgICAgXG5cdFx0XHRpZihub21hbnMubGVuZ3RoIDw9IDE2KXtcblx0XHRcdFx0Zm9yKGkgPSAwOyBpPDg7IGkrKylcblx0XHRcdFx0XHRzdW0gKz0gbm9tYW5zW2ldOyAgICBcblx0XHRcdFx0c3VtID0gKE1hdGgucm91bmQoKHN1bS84KjEwKSo0KS80KS50b0ZpeGVkKDIpO1xuXHRcdFx0XHRncmFkZVsyXSA9IHBhcnNlRmxvYXQoc3VtKTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYobm9tYW5zLmxlbmd0aCA8PSA2MCl7XG5cdFx0XHRcdGZvciAoaT0wOyBpPG47IGkrKylcblx0XHRcdFx0XHRzdW0gKz0gbm9tYW5zW2ldO1xuXHRcdFx0XHRzdW0gPSAoTWF0aC5yb3VuZCgoc3VtL24qMTApKjQpLzQpLnRvRml4ZWQoMik7ICBcblx0XHRcdFx0Z3JhZGVbMl0gPSBwYXJzZUZsb2F0KHN1bSk7XG5cdFx0XHR9IFxuXHRcdFx0ZWxzZXtcblx0XHRcdFx0Zm9yKGk9MDsgaTwzMDsgaSsrKVxuXHRcdFx0XHRcdHN1bSArPSBub21hbnNbaV07XG5cdFx0XHRcdHN1bSA9IChNYXRoLnJvdW5kKChzdW0vMzAqMTApKjQpLzQpLnRvRml4ZWQoMik7XG5cdFx0XHRcdGdyYWRlWzJdID0gcGFyc2VGbG9hdChzdW0pO1xuXHRcdFx0fVxuXHRcdHJldHVybiBncmFkZTtcblx0XHR9XG5cdH1cbn07XG4iLCIvKmpzbGludCBub21lbjogdHJ1ZSwgcGx1c3BsdXM6IHRydWUsIGJyb3dzZXI6dHJ1ZSovXG4vKmdsb2JhbCBqUXVlcnkqL1xudmFyIFF1aXogPSByZXF1aXJlKCcuL3F1aXpsaWIuanMnKTtcblxuKGZ1bmN0aW9uICh3aW5kb3csICQpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICB2YXIgcXVpeiwgcXMsIGhhbmRsZUVycm9yLCB1cGRhdGVTdGF0ZSxcbiAgICAgICAganFRdWl6ID0gJCgnI3R3LXF1aXonKSxcbiAgICAgICAganFCYXIgPSAkKCcjbG9hZC1iYXInKTtcbiAgICAvLyBEbyBub3RoaW5nIGlmIG5vdCBvbiB0aGUgcmlnaHQgcGFnZVxuICAgIGlmICgkKCdib2R5LnF1aXotbG9hZCcpLmxlbmd0aCA9PSAwKSB7IHJldHVybjsgfVxuXG4gICAgLyoqIENhbGwgYW4gYXJyYXkgb2YgQWpheCBjYWxscywgc3BsaWNpbmcgaW4gZXh0cmEgb3B0aW9ucywgb25Qcm9ncmVzcyBjYWxsZWQgb24gZWFjaCBzdWNjZXNzLCBvbkRvbmUgYXQgZW5kICovXG4gICAgZnVuY3Rpb24gY2FsbEFqYXgoY2FsbHMsIGV4dHJhLCBvblByb2dyZXNzLCBvbkRvbmUpIHtcbiAgICAgICAgdmFyIGRmZHMgPSBjYWxscy5tYXAoZnVuY3Rpb24gKGEpIHtcbiAgICAgICAgICAgIHJldHVybiAkLmFqYXgoJC5leHRlbmQoe30sIGEsIGV4dHJhKSk7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoZGZkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIG9uRG9uZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGZkcy5tYXAoZnVuY3Rpb24gKGQpIHsgZC5kb25lKG9uUHJvZ3Jlc3MpOyB9KTtcbiAgICAgICAgICAgICQud2hlbi5hcHBseShudWxsLCBkZmRzKS5kb25lKG9uRG9uZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVTdGF0ZSA9IGZ1bmN0aW9uIChjdXJTdGF0ZSwgbWVzc2FnZSwgZW5jb2RpbmcpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLCBqcUFsZXJ0O1xuICAgICAgICAvLyBBZGQgbWVzc2FnZSB0byBwYWdlIGlmIHdlIG5lZWQgdG9cbiAgICAgICAgaWYgKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgIGpxQWxlcnQgPSAkKCc8ZGl2IGNsYXNzPVwiYWxlcnRcIj4nKS5hZGRDbGFzcyhjdXJTdGF0ZSA9PT0gJ2Vycm9yJyA/ICcgYWxlcnQtZXJyb3InIDogJ2FsZXJ0LWluZm8nKTtcbiAgICAgICAgICAgIGlmIChlbmNvZGluZyA9PT0gJ2h0bWwnKSB7XG4gICAgICAgICAgICAgICAganFBbGVydC5odG1sKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBqcUFsZXJ0LnRleHQobWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBqcVF1aXouY2hpbGRyZW4oJ2Rpdi5hbGVydCcpLnJlbW92ZSgpO1xuICAgICAgICAgICAganFRdWl6LnByZXBlbmQoanFBbGVydCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY3VyU3RhdGUgPT09ICdyZWFkeScpIHtcbiAgICAgICAgICAgICQoJyN0dy1wcm9jZWVkJykuYWRkQ2xhc3MoXCJyZWFkeVwiKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVQcm9ncmVzcyhjdXIsIG1heCkge1xuICAgICAgICBpZiAobWF4ID09PSAwKSB7XG4gICAgICAgICAgICBqcUJhci5jc3Moe1wid2lkdGhcIjogJzAlJ30pO1xuICAgICAgICB9IGVsc2UgaWYgKGN1ciA8IG1heCkge1xuICAgICAgICAgICAganFCYXIuY3NzKHtcIndpZHRoXCI6IChjdXIgLyBtYXgpICogMTAwICsgJyUnfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBqcUJhci5jc3Moe1wid2lkdGhcIjogJzEwMCUnfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBoYW5kbGVFcnJvciA9IGZ1bmN0aW9uIChtZXNzYWdlLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93bikge1xuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMykge1xuICAgICAgICAgICAgLy8gdmFyIGpxWEhSID0gbWVzc2FnZVxuICAgICAgICAgICAgdXBkYXRlU3RhdGUoJ2Vycm9yJywgZXJyb3JUaHJvd24gKyBcIiAod2hpbHN0IHJlcXVlc3RpbmcgXCIgKyB0aGlzLnVybCArIFwiKVwiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEp1c3QgYSBzdHJpbmdcbiAgICAgICAgICAgIHVwZGF0ZVN0YXRlKCdlcnJvcicsIG1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIENhdGNoIGFueSB1bmNhdWdodCBleGNlcHRpb25zXG4gICAgd2luZG93Lm9uZXJyb3IgPSBmdW5jdGlvbiAobWVzc2FnZSwgdXJsLCBsaW5lbnVtYmVyKSB7XG4gICAgICAgIHVwZGF0ZVN0YXRlKFwiZXJyb3JcIiwgXCJJbnRlcm5hbCBlcnJvcjogXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICsgbWVzc2FnZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgKyBcIiAoXCIgKyB1cmwgKyBcIjpcIiArIGxpbmVudW1iZXIgKyBcIilcIik7XG4gICAgfTtcblxuICAgIC8vIFdpcmUgdXAgcXVpeiBvYmplY3RcbiAgICBxdWl6ID0gbmV3IFF1aXoobG9jYWxTdG9yYWdlLCBmdW5jdGlvbiAobWVzc2FnZSwgZW5jb2RpbmcpIHtcbiAgICAgICAgdXBkYXRlU3RhdGUoJ2Vycm9yJywgbWVzc2FnZSwgZW5jb2RpbmcpO1xuICAgIH0pO1xuXG4gICAgLyoqIERvd25sb2FkIGEgdHV0b3JpYWwgZ2l2ZW4gYnkgVVJMICovXG4gICAgZnVuY3Rpb24gZG93bmxvYWRUdXRvcmlhbCh1cmwpIHtcbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgICAgICBjYWNoZTogZmFsc2UsXG4gICAgICAgICAgICB1cmw6IHVybCxcbiAgICAgICAgICAgIGVycm9yOiBoYW5kbGVFcnJvcixcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgdmFyIGksIGFqYXhDYWxscywgY291bnQgPSAwO1xuICAgICAgICAgICAgICAgIGlmICghcXVpei5pbnNlcnRUdXRvcmlhbChkYXRhLnVyaSwgZGF0YS50aXRsZSwgZGF0YS5sZWN0dXJlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gV3JpdGUgZmFpbGVkLCBnaXZlIHVwXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBIb3VzZWtlZXAsIHJlbW92ZSBhbGwgdXNlbGVzcyBxdWVzdGlvbnNcbiAgICAgICAgICAgICAgICB1cGRhdGVTdGF0ZShcImFjdGl2ZVwiLCBcIlJlbW92aW5nIG9sZCBxdWVzdGlvbnMuLi5cIik7XG4gICAgICAgICAgICAgICAgcXVpei5yZW1vdmVVbnVzZWRPYmplY3RzKCk7XG5cbiAgICAgICAgICAgICAgICAvLyBHZXQgYWxsIHRoZSBjYWxscyByZXF1aXJlZCB0byBoYXZlIGEgZnVsbCBzZXQgb2YgcXVlc3Rpb25zXG4gICAgICAgICAgICAgICAgdXBkYXRlU3RhdGUoXCJhY3RpdmVcIiwgXCJEb3dubG9hZGluZyBxdWVzdGlvbnMuLi5cIik7XG4gICAgICAgICAgICAgICAgYWpheENhbGxzID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGRhdGEubGVjdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgcXVpei5zZXRDdXJyZW50TGVjdHVyZSh7IFwidHV0VXJpXCI6IHVybCwgXCJsZWNVcmlcIjogZGF0YS5sZWN0dXJlc1tpXS51cmkgfSwgZnVuY3Rpb24gKCkge30pOyAgLy9UT0RPOiBFcmdcbiAgICAgICAgICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkoYWpheENhbGxzLCBxdWl6LnN5bmNRdWVzdGlvbnMoKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gRG8gdGhlIGNhbGxzLCB1cGRhdGluZyBvdXIgcHJvZ3Jlc3MgYmFyXG4gICAgICAgICAgICAgICAgY2FsbEFqYXgoYWpheENhbGxzLCB7ZXJyb3I6IGhhbmRsZUVycm9yfSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAvL1RPRE86IEFyZSB3ZSBnZW51aW5lbHkgY2FwdHVyaW5nIGZ1bGwgbG9jYWxTdG9yYWdlP1xuICAgICAgICAgICAgICAgICAgICBjb3VudCArPSAxO1xuICAgICAgICAgICAgICAgICAgICB1cGRhdGVQcm9ncmVzcyhjb3VudCwgYWpheENhbGxzLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY291bnQgPCBhamF4Q2FsbHMubGVuZ3RoKSB7IHJldHVybjsgfVxuICAgICAgICAgICAgICAgICAgICB1cGRhdGVQcm9ncmVzcygxLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlU3RhdGUoXCJyZWFkeVwiLCBcIlByZXNzIHRoZSBidXR0b24gdG8gc3RhcnQgeW91ciBxdWl6XCIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIHVwZGF0ZVN0YXRlKFwiYWN0aXZlXCIsIFwiRG93bmxvYWRpbmcgbGVjdHVyZXMuLi5cIik7XG4gICAgfVxuXG4gICAgcXMgPSBxdWl6LnBhcnNlUVMod2luZG93LmxvY2F0aW9uKTtcbiAgICBpZiAoIXFzLnR1dFVyaSB8fCAhcXMubGVjVXJpKSB7XG4gICAgICAgIGhhbmRsZUVycm9yKFwiTWlzc2luZyB0dXRvcmlhbCBvciBsZWN0dXJlIFVSSSFcIik7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHFzLmNsZWFyKSB7XG4gICAgICAgIC8vIEVtcHR5IGxvY2FsU3RvcmFnZSBmaXJzdFxuICAgICAgICB3aW5kb3cubG9jYWxTdG9yYWdlLmNsZWFyKCk7XG4gICAgfVxuICAgICQoJyN0dy1wcm9jZWVkJykuYXR0cignaHJlZicsIHF1aXoucXVpelVybChxcy50dXRVcmksIHFzLmxlY1VyaSkpO1xuICAgIGRvd25sb2FkVHV0b3JpYWwocXMudHV0VXJpKTtcbn0od2luZG93LCBqUXVlcnkpKTtcbiIsIi8qanNsaW50IG5vbWVuOiB0cnVlLCBwbHVzcGx1czogdHJ1ZSwgYnJvd3Nlcjp0cnVlKi9cbi8qZ2xvYmFsIGpRdWVyeSwgTWF0aEpheCovXG52YXIgUXVpeiA9IHJlcXVpcmUoJy4vcXVpemxpYi5qcycpO1xuXG4vKipcbiAgKiBWaWV3IGNsYXNzIHRvIHRyYW5zbGF0ZSBkYXRhIGludG8gRE9NIHN0cnVjdHVyZXNcbiAgKiAgICAkOiBqUXVlcnlcbiAgKiAgICBqcVF1aXo6IGpRdWVyeS13cmFwcGVkIDxmb3JtIGlkPVwidHctcXVpelwiPlxuICAqICAgIGpxUHJvY2VlZDogalF1ZXJ5IHdyYXBwZWQgcHJvY2VlZCBidXR0b25cbiAgKi9cbmZ1bmN0aW9uIFF1aXpWaWV3KCQsIGpxUXVpeiwganFUaW1lciwganFQcm9jZWVkLCBqcUZpbmlzaCwganFEZWJ1Z01lc3NhZ2UpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICB0aGlzLmpxUXVpeiA9IGpxUXVpejtcbiAgICB0aGlzLmpxVGltZXIgPSBqcVRpbWVyO1xuICAgIHRoaXMuanFQcm9jZWVkID0ganFQcm9jZWVkO1xuICAgIHRoaXMuanFGaW5pc2ggPSBqcUZpbmlzaDtcbiAgICB0aGlzLmpxRGVidWdNZXNzYWdlID0ganFEZWJ1Z01lc3NhZ2U7XG4gICAgdGhpcy5qcUdyYWRlID0gJCgnI3R3LWdyYWRlJyk7XG4gICAgdGhpcy5qcVByYWN0aWNlID0gJCgnI3R3LXByYWN0aWNlJyk7XG4gICAgdGhpcy50aW1lclRpbWUgPSBudWxsO1xuXG4gICAgLyoqIFN0YXJ0IHRoZSB0aW1lciBjb3VudGluZyBkb3duIGZyb20gc3RhcnRUaW1lIHNlY29uZHMgKi9cbiAgICB0aGlzLnRpbWVyU3RhcnQgPSBmdW5jdGlvbiAoc3RhcnRUaW1lKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgZnVuY3Rpb24gZm9ybWF0VGltZSh0KSB7XG4gICAgICAgICAgICB2YXIgb3V0ID0gXCJcIjtcbiAgICAgICAgICAgIGZ1bmN0aW9uIHBsdXJhbChpLCBiYXNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGkgKyBcIiBcIiArIGJhc2UgKyAoaSAhPT0gMSA/ICdzJyA6ICcnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHQgPiA2MCkge1xuICAgICAgICAgICAgICAgIG91dCA9IHBsdXJhbChNYXRoLmZsb29yKHQgLyA2MCksICdtaW4nKSArICcgJztcbiAgICAgICAgICAgICAgICB0ID0gdCAlIDYwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgb3V0ICs9IHBsdXJhbCh0LCAnc2VjJyk7XG4gICAgICAgICAgICByZXR1cm4gb3V0O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN0YXJ0VGltZSkge1xuICAgICAgICAgICAgc2VsZi50aW1lclRpbWUgPSBzdGFydFRpbWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy50aW1lclRpbWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAvLyBTb21ldGhpbmcgY2FsbGVkIHRpbWVyU3RvcCwgc28gc3RvcC5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZWxmLnRpbWVyVGltZSA9IHNlbGYudGltZXJUaW1lIC0gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzZWxmLnRpbWVyVGltZSA+IDApIHtcbiAgICAgICAgICAgIHNlbGYuanFUaW1lci50ZXh0KGZvcm1hdFRpbWUoc2VsZi50aW1lclRpbWUpKTtcbiAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHNlbGYudGltZXJTdGFydC5iaW5kKHNlbGYpLCAxMDAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFdhc24ndCBhc2tlZCB0byBzdG9wLCBzbyBpdCdzIGEgZ2VudWluZSB0aW1lb3V0XG4gICAgICAgICAgICBzZWxmLmpxVGltZXIudGV4dChcIk91dCBvZiB0aW1lXCIpO1xuICAgICAgICAgICAgc2VsZi5qcVByb2NlZWQudHJpZ2dlcignY2xpY2snLCAndGltZW91dCcpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKiBTdG9wIHRoZSB0aW1lciBhdCBpdCdzIGN1cnJlbnQgdmFsdWUgKi9cbiAgICB0aGlzLnRpbWVyU3RvcCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBzZWxmLnRpbWVyVGltZSA9IG51bGw7XG4gICAgfTtcblxuICAgIC8qKiBVcGRhdGUgdGhlIGRlYnVnIG1lc3NhZ2Ugd2l0aCBjdXJyZW50IFVSSSBhbmQgYW4gZXh0cmEgc3RyaW5nICovXG4gICAgdGhpcy51cGRhdGVEZWJ1Z01lc3NhZ2UgPSBmdW5jdGlvbiAobGVjVXJpLCBxbikge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIGlmIChsZWNVcmkpIHsgc2VsZi5qcURlYnVnTWVzc2FnZVswXS5sZWNVcmkgPSBsZWNVcmk7IH1cbiAgICAgICAgc2VsZi5qcURlYnVnTWVzc2FnZS50ZXh0KHNlbGYuanFEZWJ1Z01lc3NhZ2VbMF0ubGVjVXJpICsgXCJcXG5cIiArIHFuKTtcbiAgICB9O1xuXG4gICAgLyoqIFN3aXRjaCBxdWl6IHN0YXRlLCBvcHRpb25hbGx5IHNob3dpbmcgbWVzc2FnZSAqL1xuICAgIHRoaXMudXBkYXRlU3RhdGUgPSBmdW5jdGlvbiAoY3VyU3RhdGUsIG1lc3NhZ2UsIGVuY29kaW5nKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcywganFBbGVydDtcblxuICAgICAgICAvLyBBZGQgbWVzc2FnZSB0byBwYWdlIGlmIHdlIG5lZWQgdG9cbiAgICAgICAgaWYgKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgIGpxQWxlcnQgPSAkKCc8ZGl2IGNsYXNzPVwiYWxlcnRcIj4nKS5hZGRDbGFzcyhjdXJTdGF0ZSA9PT0gJ2Vycm9yJyA/ICcgYWxlcnQtZXJyb3InIDogJ2FsZXJ0LWluZm8nKTtcbiAgICAgICAgICAgIGlmIChlbmNvZGluZyA9PT0gJ2h0bWwnKSB7XG4gICAgICAgICAgICAgICAganFBbGVydC5odG1sKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBqcUFsZXJ0LnRleHQobWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBqcVF1aXouY2hpbGRyZW4oJ2Rpdi5hbGVydCcpLnJlbW92ZSgpO1xuICAgICAgICAgICAganFRdWl6LnByZXBlbmQoanFBbGVydCk7XG4gICAgICAgIH1cblxuICAgICAgICAkKGRvY3VtZW50KS5kYXRhKCd0dy1zdGF0ZScsIGN1clN0YXRlKTtcblxuICAgICAgICAvLyBTZXQgYnV0dG9uIHRvIG1hdGNoIHN0YXRlXG4gICAgICAgIHNlbGYuanFQcm9jZWVkLnJlbW92ZUF0dHIoXCJkaXNhYmxlZFwiKTtcbiAgICAgICAgc2VsZi5qcVByYWN0aWNlLnJlbW92ZUF0dHIoXCJkaXNhYmxlZFwiKTtcbiAgICAgICAgc2VsZi5qcUZpbmlzaC5yZW1vdmVBdHRyKFwiZGlzYWJsZWRcIik7XG4gICAgICAgIGlmIChjdXJTdGF0ZSA9PT0gJ25leHRxbicpIHtcbiAgICAgICAgICAgIHNlbGYuanFQcm9jZWVkLmh0bWwoXCJOZXcgcXVlc3Rpb24gPj4+XCIpO1xuICAgICAgICB9IGVsc2UgaWYgKGN1clN0YXRlID09PSAnaW50ZXJyb2dhdGUnKSB7XG4gICAgICAgICAgICBzZWxmLmpxUHJvY2VlZC5odG1sKFwiU3VibWl0IGFuc3dlciA+Pj5cIik7XG4gICAgICAgICAgICBzZWxmLmpxUHJhY3RpY2UuYXR0cihcImRpc2FibGVkXCIsIHRydWUpO1xuICAgICAgICAgICAgc2VsZi5qcUZpbmlzaC5hdHRyKFwiZGlzYWJsZWRcIiwgdHJ1ZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoY3VyU3RhdGUgPT09ICdwcm9jZXNzaW5nJykge1xuICAgICAgICAgICAgc2VsZi5qcVByb2NlZWQuYXR0cihcImRpc2FibGVkXCIsIHRydWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VsZi5qcVByb2NlZWQuaHRtbChcIlJlc3RhcnQgcXVpeiA+Pj5cIik7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqIFVwZGF0ZSBzeW5jIGJ1dHRvbiwgY3VyU3RhdGUgb25lIG9mICdwcm9jZXNzaW5nJywgJ29ubGluZScsICdvZmZsaW5lJywgJ3VuYXV0aCcsICcnICovXG4gICAgdGhpcy5zeW5jU3RhdGUgPSBmdW5jdGlvbiAoY3VyU3RhdGUpIHtcbiAgICAgICAgdmFyIGpxU3luYyA9ICQoJyN0dy1zeW5jJyk7XG5cbiAgICAgICAgaWYgKCFjdXJTdGF0ZSkge1xuICAgICAgICAgICAgLy8gV2FudCB0byBrbm93IHdoYXQgdGhlIHN0YXRlIGlzXG4gICAgICAgICAgICByZXR1cm4ganFTeW5jWzBdLmNsYXNzTmFtZSA9PT0gJ2J0biBhY3RpdmUnID8gJ3Byb2Nlc3NpbmcnXG4gICAgICAgICAgICAgICAgICAgIDoganFTeW5jWzBdLmNsYXNzTmFtZSA9PT0gJ2J0biBidG4tZGFuZ2VyIGJ0bi11bmF1dGgnID8gJ3VuYXV0aCdcbiAgICAgICAgICAgICAgICAgICAgOiBqcVN5bmNbMF0uY2xhc3NOYW1lID09PSAnYnRuIGJ0bi1zdWNjZXNzJyA/ICdvbmxpbmUnXG4gICAgICAgICAgICAgICAgICAgICAgICAgOiAndW5rbm93bic7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXR0aW5nIHRoZSBzdGF0ZVxuICAgICAgICBpZiAoY3VyU3RhdGUgPT09ICdwcm9jZXNzaW5nJykge1xuICAgICAgICAgICAganFTeW5jWzBdLmNsYXNzTmFtZSA9ICdidG4gYWN0aXZlJztcbiAgICAgICAgICAgIGpxU3luYy50ZXh0KFwiU3luY2luZy4uLlwiKTtcbiAgICAgICAgfSBlbHNlIGlmIChjdXJTdGF0ZSA9PT0gJ29ubGluZScpIHtcbiAgICAgICAgICAgIGpxU3luY1swXS5jbGFzc05hbWUgPSAnYnRuIGJ0bi1zdWNjZXNzJztcbiAgICAgICAgICAgIGpxU3luYy50ZXh0KFwiU2NvcmVzIHNhdmVkLlwiKTtcbiAgICAgICAgfSBlbHNlIGlmIChjdXJTdGF0ZSA9PT0gJ29mZmxpbmUnKSB7XG4gICAgICAgICAgICBqcVN5bmNbMF0uY2xhc3NOYW1lID0gJ2J0biBidG4taW5mbyc7XG4gICAgICAgICAgICBqcVN5bmMudGV4dChcIkN1cnJlbnRseSBvZmZsaW5lLiBTeW5jIG9uY2Ugb25saW5lXCIpO1xuICAgICAgICB9IGVsc2UgaWYgKGN1clN0YXRlID09PSAndW5hdXRoJykge1xuICAgICAgICAgICAganFTeW5jWzBdLmNsYXNzTmFtZSA9ICdidG4gYnRuLWRhbmdlciBidG4tdW5hdXRoJztcbiAgICAgICAgICAgIGpxU3luYy50ZXh0KFwiQ2xpY2sgaGVyZSB0byBsb2dpbiwgc28geW91ciBzY29yZXMgY2FuIGJlIHNhdmVkXCIpO1xuICAgICAgICB9IGVsc2UgaWYgKGN1clN0YXRlID09PSAnZXJyb3InKSB7XG4gICAgICAgICAgICBqcVN5bmNbMF0uY2xhc3NOYW1lID0gJ2J0biBidG4tZGFuZ2VyJztcbiAgICAgICAgICAgIGpxU3luYy50ZXh0KFwiU3luY2luZyBmYWlsZWQhXCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAganFTeW5jWzBdLmNsYXNzTmFtZSA9ICdidG4nO1xuICAgICAgICAgICAganFTeW5jLnRleHQoXCJTeW5jIGFuc3dlcnNcIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGN1clN0YXRlO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlck1hdGggPSBmdW5jdGlvbiAob25TdWNjZXNzKSB7XG4gICAgICAgIHZhciBqcVF1aXogPSB0aGlzLmpxUXVpejtcbiAgICAgICAganFRdWl6LmFkZENsYXNzKFwibWF0aGpheC1idXN5XCIpO1xuICAgICAgICBNYXRoSmF4Lkh1Yi5RdWV1ZShbXCJUeXBlc2V0XCIsIE1hdGhKYXguSHViLCB0aGlzLmpxUXVpelswXV0pO1xuICAgICAgICBNYXRoSmF4Lkh1Yi5RdWV1ZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBqcVF1aXoucmVtb3ZlQ2xhc3MoXCJtYXRoamF4LWJ1c3lcIik7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAob25TdWNjZXNzKSB7XG4gICAgICAgICAgICBNYXRoSmF4Lkh1Yi5RdWV1ZShvblN1Y2Nlc3MpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKiBSZW5kZXIgbmV4dCBxdWVzdGlvbiAqL1xuICAgIHRoaXMucmVuZGVyTmV3UXVlc3Rpb24gPSBmdW5jdGlvbiAocW4sIGEpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLCBpLCBodG1sID0gJyc7XG4gICAgICAgIHNlbGYudXBkYXRlRGVidWdNZXNzYWdlKG51bGwsIGEudXJpLnJlcGxhY2UoLy4qXFwvLywgJycpKTtcbiAgICAgICAgLy9UT0RPOiBEbyBzb21lIHByb3BlciBET00gbWFuaXBsdWF0aW9uP1xuICAgICAgICBpZiAocW4udGV4dCkgeyBodG1sICs9ICc8cD4nICsgcW4udGV4dCArICc8L3A+JzsgfVxuICAgICAgICBodG1sICs9ICc8b2wgdHlwZT1cImFcIj4nO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYS5vcmRlcmluZy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaHRtbCArPSAnPGxpIGlkPVwiYW5zd2VyXycgKyBpICsgJ1wiPic7XG4gICAgICAgICAgICBodG1sICs9ICc8bGFiZWwgY2xhc3M9XCJyYWRpb1wiPic7XG4gICAgICAgICAgICBodG1sICs9ICc8aW5wdXQgdHlwZT1cInJhZGlvXCIgbmFtZT1cImFuc3dlclwiIHZhbHVlPVwiJyArIGkgKyAnXCIvPic7XG4gICAgICAgICAgICBodG1sICs9IHFuLmNob2ljZXNbYS5vcmRlcmluZ1tpXV07XG4gICAgICAgICAgICBodG1sICs9ICc8L2xhYmVsPjwvbGk+JztcbiAgICAgICAgfVxuICAgICAgICBodG1sICs9ICc8L29sPic7XG4gICAgICAgIHNlbGYuanFRdWl6Lmh0bWwoaHRtbCk7XG4gICAgICAgIHNlbGYuanFHcmFkZS50ZXh0KFwiQW5zd2VyZWQgXCIgKyBhLmxlY19hbnN3ZXJlZCArIFwiIHF1ZXN0aW9ucywgXCIgKyBhLmxlY19jb3JyZWN0ICsgXCIgY29ycmVjdGx5LlwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgKyBcIlxcbllvdXIgZ3JhZGU6IFwiICsgYS5ncmFkZV9iZWZvcmVcbiAgICAgICAgICAgICAgICAgICAgICAgICArIFwiXFxuWW91ciBncmFkZSBpZiB5b3UgZ2V0IHRoZSBuZXh0IHF1ZXN0aW9uIHJpZ2h0OlwiICsgYS5ncmFkZV9hZnRlcl9yaWdodCk7XG4gICAgICAgIHNlbGYucmVuZGVyTWF0aChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoYS5hbGxvdHRlZF90aW1lICYmIGEucXVpel90aW1lKSB7XG4gICAgICAgICAgICAgICAgLy8gQWxyZWFkeSBzdGFydGVkLCBkb2NrIHNlY29uZHMgc2luY2Ugc3RhcnRlZFxuICAgICAgICAgICAgICAgIHNlbGYudGltZXJTdGFydChhLmFsbG90dGVkX3RpbWUgLSAoTWF0aC5yb3VuZCgobmV3IERhdGUoKSkuZ2V0VGltZSgpIC8gMTAwMCkgLSBhLnF1aXpfdGltZSkpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhLmFsbG90dGVkX3RpbWUpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnRpbWVyU3RhcnQoYS5hbGxvdHRlZF90aW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qKiBBbm5vdGF0ZSB3aXRoIGNvcnJlY3QgLyBpbmNvcnJlY3Qgc2VsZWN0aW9ucyAqL1xuICAgIHRoaXMucmVuZGVyQW5zd2VyID0gZnVuY3Rpb24gKGEsIGFuc3dlckRhdGEsIGdyYWRlU3RyaW5nLCBsYXN0RWlnaHQpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLCBpO1xuICAgICAgICBzZWxmLmpxUXVpei5maW5kKCdpbnB1dCcpLmF0dHIoJ2Rpc2FibGVkJywgJ2Rpc2FibGVkJyk7XG4gICAgICAgIHNlbGYuanFRdWl6LmZpbmQoJyNhbnN3ZXJfJyArIGEuc2VsZWN0ZWRfYW5zd2VyKS5hZGRDbGFzcygnc2VsZWN0ZWQnKTtcbiAgICAgICAgLy8gTWFyayBhbGwgYW5zd2VycyBhcyBjb3JyZWN0IC8gaW5jb3JyZWN0XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBhLm9yZGVyaW5nX2NvcnJlY3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHNlbGYuanFRdWl6LmZpbmQoJyNhbnN3ZXJfJyArIGkpLmFkZENsYXNzKGEub3JkZXJpbmdfY29ycmVjdFtpXSA/ICdjb3JyZWN0JyA6ICdpbmNvcnJlY3QnKTtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLmpxUXVpei5yZW1vdmVDbGFzcygnY29ycmVjdCcpO1xuICAgICAgICBzZWxmLmpxUXVpei5yZW1vdmVDbGFzcygnaW5jb3JyZWN0Jyk7XG4gICAgICAgIHNlbGYuanFRdWl6LmFkZENsYXNzKGEuY29ycmVjdCA/ICdjb3JyZWN0JyA6ICdpbmNvcnJlY3QnKTtcbiAgICAgICAgaWYgKGFuc3dlckRhdGEuZXhwbGFuYXRpb24pIHtcbiAgICAgICAgICAgIHNlbGYuanFRdWl6LmFwcGVuZCgkKCc8ZGl2IGNsYXNzPVwiYWxlcnQgZXhwbGFuYXRpb25cIj4nICsgYW5zd2VyRGF0YS5leHBsYW5hdGlvbiArICc8L2Rpdj4nKSk7XG4gICAgICAgICAgICBzZWxmLnJlbmRlck1hdGgoKTtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLmpxR3JhZGUudGV4dChncmFkZVN0cmluZyk7XG4gICAgICAgIHRoaXMucmVuZGVyUHJldkFuc3dlcnMobGFzdEVpZ2h0KTtcbiAgICB9O1xuXG4gICAgLyoqIFJlbmRlciBwcmV2aW91cyBhbnN3ZXJzIGluIGEgbGlzdCBiZWxvdyAqL1xuICAgIHRoaXMucmVuZGVyUHJldkFuc3dlcnMgPSBmdW5jdGlvbiAobGFzdEVpZ2h0KSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgICAgIGpxTGlzdCA9ICQoXCIjdHctcHJldmlvdXMtYW5zd2Vyc1wiKS5maW5kKCdvbCcpO1xuICAgICAgICBqcUxpc3QuZW1wdHkoKTtcbiAgICAgICAganFMaXN0LmFwcGVuZChsYXN0RWlnaHQubWFwKGZ1bmN0aW9uIChhKSB7XG4gICAgICAgICAgICB2YXIgdCA9IG5ldyBEYXRlKDApO1xuICAgICAgICAgICAgdC5zZXRVVENTZWNvbmRzKGEuYW5zd2VyX3RpbWUpO1xuXG4gICAgICAgICAgICByZXR1cm4gJCgnPGxpLz4nKVxuICAgICAgICAgICAgICAgIC5hZGRDbGFzcyhhLmNvcnJlY3QgPyAnY29ycmVjdCcgOiAnaW5jb3JyZWN0JylcbiAgICAgICAgICAgICAgICAuYXR0cigndGl0bGUnLFxuICAgICAgICAgICAgICAgICAgICAgKGEuc2VsZWN0ZWRfYW5zd2VyID8gJ1lvdSBjaG9zZSAnICsgU3RyaW5nLmZyb21DaGFyQ29kZSg5NyArIGEuc2VsZWN0ZWRfYW5zd2VyKSArICdcXG4nIDogJycpXG4gICAgICAgICAgICAgICAgICAgICArICdBbnN3ZXJlZCAnICsgdC50b0xvY2FsZURhdGVTdHJpbmcoKSArICcgJyArIHQudG9Mb2NhbGVUaW1lU3RyaW5nKCkpXG4gICAgICAgICAgICAgICAgLmFwcGVuZCgkKCc8c3Bhbi8+JykudGV4dChhLmNvcnJlY3QgPyBcIuKclFwiIDogJ+KclycpKTtcbiAgICAgICAgfSkpO1xuICAgIH07XG5cbiAgICB0aGlzLnJlbmRlclN0YXJ0ID0gZnVuY3Rpb24gKHR1dFVyaSwgdHV0VGl0bGUsIGxlY1VyaSwgbGVjVGl0bGUsIGdyYWRlU3RyaW5nLCBsYXN0RWlnaHQpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAkKFwiI3R3LXRpdGxlXCIpLnRleHQodHV0VGl0bGUgKyBcIiAtIFwiICsgbGVjVGl0bGUpO1xuICAgICAgICBzZWxmLmpxUXVpei5odG1sKCQoXCI8cD5DbGljayAnTmV3IHF1ZXN0aW9uJyB0byBzdGFydCB5b3VyIHF1aXo8L3A+XCIpKTtcbiAgICAgICAgc2VsZi5qcUdyYWRlLnRleHQoZ3JhZGVTdHJpbmcpO1xuICAgICAgICB0aGlzLnJlbmRlclByZXZBbnN3ZXJzKGxhc3RFaWdodCk7XG4gICAgfTtcbn1cblxuKGZ1bmN0aW9uICh3aW5kb3csICQsIHVuZGVmaW5lZCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIHZhciBxdWl6LCBxdWl6VmlldztcbiAgICAvLyBEbyBub3RoaW5nIGlmIG5vdCBvbiB0aGUgcmlnaHQgcGFnZVxuICAgIGlmICgkKCdib2R5LnF1aXotcXVpeicpLmxlbmd0aCA9PT0gMCkgeyByZXR1cm47IH1cblxuICAgIC8qKiBDYWxsIGFuIGFycmF5IG9mIEFqYXggY2FsbHMsIHNwbGljaW5nIGluIGV4dHJhIG9wdGlvbnMsIG9uUHJvZ3Jlc3MgY2FsbGVkIG9uIGVhY2ggc3VjY2Vzcywgb25Eb25lIGF0IGVuZCAqL1xuICAgIGZ1bmN0aW9uIGNhbGxBamF4KGNhbGxzLCBleHRyYSwgb25Qcm9ncmVzcywgb25Eb25lKSB7XG4gICAgICAgIHZhciBkZmRzID0gY2FsbHMubWFwKGZ1bmN0aW9uIChhKSB7XG4gICAgICAgICAgICByZXR1cm4gJC5hamF4KCQuZXh0ZW5kKHt9LCBhLCBleHRyYSkpO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGRmZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBvbkRvbmUoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRmZHMubWFwKGZ1bmN0aW9uIChkKSB7IGQuZG9uZShvblByb2dyZXNzKTsgfSk7XG4gICAgICAgICAgICAkLndoZW4uYXBwbHkobnVsbCwgZGZkcykuZG9uZShvbkRvbmUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ2F0Y2ggYW55IHVuY2F1Z2h0IGV4Y2VwdGlvbnNcbiAgICB3aW5kb3cub25lcnJvciA9IGZ1bmN0aW9uIChtZXNzYWdlLCB1cmwsIGxpbmVudW1iZXIpIHtcbiAgICAgICAgcXVpelZpZXcudXBkYXRlU3RhdGUoXCJlcnJvclwiLCBcIkludGVybmFsIGVycm9yOiBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKyBtZXNzYWdlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICArIFwiIChcIiArIHVybCArIFwiOlwiICsgbGluZW51bWJlciArIFwiKVwiKTtcbiAgICB9O1xuXG4gICAgLy8gV2lyZSB1cCBxdWl6IG9iamVjdFxuICAgIHF1aXpWaWV3ID0gbmV3IFF1aXpWaWV3KCQsICQoJyN0dy1xdWl6JyksICQoJyN0dy10aW1lcicpLCAkKCcjdHctcHJvY2VlZCcpLCAkKCcjdHctZmluaXNoJyksICQoJyN0dy1kZWJ1Z21lc3NhZ2UnKSk7XG4gICAgcXVpeiA9IG5ldyBRdWl6KGxvY2FsU3RvcmFnZSwgZnVuY3Rpb24gKG1lc3NhZ2UsIGVuY29kaW5nKSB7XG4gICAgICAgIHF1aXpWaWV3LnVwZGF0ZVN0YXRlKFwiZXJyb3JcIiwgbWVzc2FnZSwgZW5jb2RpbmcpO1xuICAgIH0pO1xuXG4gICAgLy8gQ29tcGxhaW4gaWYgdGhlcmUncyBubyBsb2NhbHN0b3JhZ2VcbiAgICBpZiAoIXdpbmRvdy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgcXVpelZpZXcudXBkYXRlU3RhdGUoXCJlcnJvclwiLCBcIlNvcnJ5LCB3ZSBkbyBub3Qgc3VwcG9ydCB5b3VyIGJyb3dzZXJcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAod2luZG93LmFwcGxpY2F0aW9uQ2FjaGUpIHtcbiAgICAgICAgLy8gVHJpZ2dlciByZWxvYWQgaWYgbmVlZGVkXG4gICAgICAgIHdpbmRvdy5hcHBsaWNhdGlvbkNhY2hlLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZXJlYWR5JywgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIGlmICh3aW5kb3cuYXBwbGljYXRpb25DYWNoZS5zdGF0dXMgIT09IHdpbmRvdy5hcHBsaWNhdGlvbkNhY2hlLlVQREFURVJFQURZKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcXVpelZpZXcudXBkYXRlU3RhdGUoXCJyZWxvYWRcIiwgJ0EgbmV3IHZlcnNpb24gaXMgYXZhaWFibGUsIGNsaWNrIFwiUmVzdGFydCBxdWl6XCInKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gSGl0dGluZyB0aGUgYnV0dG9uIG1vdmVzIG9uIHRvIHRoZSBuZXh0IHN0YXRlIGluIHRoZSBzdGF0ZSBtYWNoaW5lXG4gICAgJCgnI3R3LXByb2NlZWQnKS5iaW5kKCdjbGljaycsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBxdWl6Vmlldy50aW1lclN0b3AoKTtcbiAgICAgICAgaWYgKCQodGhpcykuaGFzQ2xhc3MoXCJkaXNhYmxlZFwiKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHN3aXRjaCAoJChkb2N1bWVudCkuZGF0YSgndHctc3RhdGUnKSkge1xuICAgICAgICBjYXNlICdwcm9jZXNzaW5nJzpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgIGNhc2UgJ3JlbG9hZCc6XG4gICAgICAgICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKGZhbHNlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICduZXh0cW4nOlxuICAgICAgICAgICAgLy8gVXNlciByZWFkeSBmb3IgbmV4dCBxdWVzdGlvblxuICAgICAgICAgICAgcXVpelZpZXcudXBkYXRlU3RhdGUoXCJwcm9jZXNzaW5nXCIpO1xuICAgICAgICAgICAgcXVpei5nZXROZXdRdWVzdGlvbigkKCcjdHctcHJhY3RpY2UnKS5oYXNDbGFzcyhcImFjdGl2ZVwiKSwgZnVuY3Rpb24gKHFuLCBvcmRlcmluZykge1xuICAgICAgICAgICAgICAgIHF1aXpWaWV3LnJlbmRlck5ld1F1ZXN0aW9uKHFuLCBvcmRlcmluZyk7XG4gICAgICAgICAgICAgICAgcXVpelZpZXcudXBkYXRlU3RhdGUoJ2ludGVycm9nYXRlJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdpbnRlcnJvZ2F0ZSc6XG4gICAgICAgICAgICAvLyBEaXNhYmxlIGFsbCBjb250cm9scyBhbmQgbWFyayBhbnN3ZXJcbiAgICAgICAgICAgIHF1aXpWaWV3LnVwZGF0ZVN0YXRlKFwicHJvY2Vzc2luZ1wiKTtcbiAgICAgICAgICAgIHF1aXouc2V0UXVlc3Rpb25BbnN3ZXIocGFyc2VJbnQoJCgnaW5wdXQ6cmFkaW9bbmFtZT1hbnN3ZXJdOmNoZWNrZWQnKS52YWwoKSwgMTApLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcXVpelZpZXcucmVuZGVyQW5zd2VyLmFwcGx5KHF1aXpWaWV3LCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIHF1aXpWaWV3LnVwZGF0ZVN0YXRlKCduZXh0cW4nKTtcbiAgICAgICAgICAgICAgICAvL1RPRE86IEVnaCwgbXVzdCBiZSBhIGNsZWFuZXIgd2F5XG4gICAgICAgICAgICAgICAgcXVpelZpZXcuc3luY1N0YXRlKCdkZWZhdWx0Jyk7XG4gICAgICAgICAgICAgICAgJCgnI3R3LXN5bmMnKS50cmlnZ2VyKCdjbGljaycsICdub2ZvcmNlJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgcXVpelZpZXcudXBkYXRlU3RhdGUoJ2Vycm9yJywgXCJFcnJvcjogUXVpeiBpbiB1bmtvd24gc3RhdGVcIik7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgICQoJyN0dy1wcmFjdGljZScpLmJpbmQoJ2NsaWNrJywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcywganFUaGlzID0gJCh0aGlzKTtcbiAgICAgICAgaWYgKGpxVGhpcy5hdHRyKFwiZGlzYWJsZWRcIikpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoanFUaGlzLmhhc0NsYXNzKFwiYWN0aXZlXCIpKSB7XG4gICAgICAgICAgICBqcVRoaXMucmVtb3ZlQ2xhc3MoXCJhY3RpdmVcIik7XG4gICAgICAgICAgICAkKCdkaXYuc3RhdHVzJykucmVtb3ZlQ2xhc3MoXCJwcmFjdGljZVwiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGpxVGhpcy5hZGRDbGFzcyhcImFjdGl2ZVwiKTtcbiAgICAgICAgICAgICQoJ2Rpdi5zdGF0dXMnKS5hZGRDbGFzcyhcInByYWN0aWNlXCIpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAkKCcjdHctZmluaXNoJykuYmluZCgnY2xpY2snLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgaWYgKCQodGhpcykuYXR0cihcImRpc2FibGVkXCIpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgICQoJyN0dy1zeW5jJykuYmluZCgnY2xpY2snLCBmdW5jdGlvbiAoZXZlbnQsIG5vRm9yY2UpIHtcbiAgICAgICAgdmFyIHN5bmNDYWxsO1xuXG4gICAgICAgIGZ1bmN0aW9uIG9uRXJyb3IoanFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duKSB7XG4gICAgICAgICAgICBpZiAoanFYSFIuc3RhdHVzID09PSA0MDEgfHwganFYSFIuc3RhdHVzID09PSA0MDMpIHtcbiAgICAgICAgICAgICAgICBxdWl6Vmlldy5zeW5jU3RhdGUoJ3VuYXV0aCcpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBxdWl6Vmlldy5zeW5jU3RhdGUoJ2Vycm9yJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocXVpelZpZXcuc3luY1N0YXRlKCkgPT09ICdwcm9jZXNzaW5nJykge1xuICAgICAgICAgICAgLy8gRG9uJ3Qgd2FudCB0byByZXBlYXRlZGx5IHN5bmNcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAocXVpelZpZXcuc3luY1N0YXRlKCkgPT09ICd1bmF1dGgnKSB7XG4gICAgICAgICAgICB3aW5kb3cub3BlbihxdWl6LnBvcnRhbFJvb3RVcmwoZG9jdW1lbnQubG9jYXRpb24pXG4gICAgICAgICAgICAgICAgICAgICAgICsgJy9sb2dpbj9jYW1lX2Zyb209J1xuICAgICAgICAgICAgICAgICAgICAgICArIGVuY29kZVVSSUNvbXBvbmVudChkb2N1bWVudC5sb2NhdGlvbi5wYXRobmFtZS5yZXBsYWNlKC9cXC9cXHcrXFwuaHRtbCQvLCAnL2Nsb3NlLmh0bWwnKSksXG4gICAgICAgICAgICAgICAgICAgICAgIFwibG9naW53aW5kb3dcIik7XG4gICAgICAgICAgICBxdWl6Vmlldy5zeW5jU3RhdGUoJ2RlZmF1bHQnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBxdWl6Vmlldy5zeW5jU3RhdGUoJ3Byb2Nlc3NpbmcnKTtcbiAgICAgICAgaWYgKCF3aW5kb3cubmF2aWdhdG9yLm9uTGluZSkge1xuICAgICAgICAgICAgcXVpelZpZXcuc3luY1N0YXRlKCdvZmZsaW5lJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGZXRjaCBBSkFYIGNhbGxcbiAgICAgICAgc3luY0NhbGwgPSBxdWl6LnN5bmNMZWN0dXJlKCFub0ZvcmNlKTtcbiAgICAgICAgaWYgKHN5bmNDYWxsID09PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBTeW5jIHNheXMgdGhlcmUncyBub3RoaW5nIHRvIGRvXG4gICAgICAgICAgICBxdWl6Vmlldy5zeW5jU3RhdGUoJ2RlZmF1bHQnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN5bmMgY3VycmVudCBsZWN0dXJlIGFuZCBpdCdzIHF1ZXN0aW9uc1xuICAgICAgICBjYWxsQWpheChbc3luY0NhbGxdLCB7ZXJyb3I6IG9uRXJyb3J9LCBudWxsLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjYWxsQWpheChxdWl6LnN5bmNRdWVzdGlvbnMoKSwge2Vycm9yOiBvbkVycm9yfSwgbnVsbCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHF1aXpWaWV3LnN5bmNTdGF0ZSgnb25saW5lJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gICAgcXVpelZpZXcuc3luY1N0YXRlKCdkZWZhdWx0Jyk7XG5cbiAgICAvLyBMb2FkIHRoZSBsZWN0dXJlIHJlZmVyZW5jZWQgaW4gVVJMLCBpZiBzdWNjZXNzZnVsIGhpdCB0aGUgYnV0dG9uIHRvIGdldCBmaXJzdCBxdWVzdGlvbi5cbiAgICBxdWl6LnNldEN1cnJlbnRMZWN0dXJlKHF1aXoucGFyc2VRUyh3aW5kb3cubG9jYXRpb24pLCBmdW5jdGlvbiAodHV0VXJpLCB0dXRUaXRsZSwgbGVjVXJpLCBsZWNUaXRsZSwgZ3JhZGUsIGxhc3RFaWdodCkge1xuICAgICAgICBxdWl6Vmlldy51cGRhdGVEZWJ1Z01lc3NhZ2UobGVjVXJpLCAnJyk7XG4gICAgICAgIHF1aXpWaWV3LnJlbmRlclN0YXJ0LmFwcGx5KHF1aXpWaWV3LCBhcmd1bWVudHMpO1xuICAgICAgICBxdWl6Vmlldy51cGRhdGVTdGF0ZShcIm5leHRxblwiKTtcbiAgICB9KTtcblxufSh3aW5kb3csIGpRdWVyeSkpO1xuIiwiLypqc2xpbnQgbm9tZW46IHRydWUsIHBsdXNwbHVzOiB0cnVlLCBicm93c2VyOnRydWUqL1xudmFyIGlhYWxpYiA9IG5ldyAocmVxdWlyZSgnLi9pYWEuanMnKSkoKTtcblxuLyoqXG4gICogTWFpbiBxdWl6IG9iamVjdFxuICAqICByYXdMb2NhbFN0b3JhZ2U6IEJyb3dzZXIgbG9jYWwgc3RvcmFnZSBvYmplY3RcbiAgKiAgaGFuZGxlRXJyb3I6IEZ1bmN0aW9uIHRoYXQgZGlzcGxheXMgZXJyb3IgbWVzc2FnZSB0byB1c2VyXG4gICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIFF1aXoocmF3TG9jYWxTdG9yYWdlLCBoYW5kbGVFcnJvcikge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIHRoaXMuaGFuZGxlRXJyb3IgPSBoYW5kbGVFcnJvcjtcbiAgICB0aGlzLnR1dG9yaWFsVXJpID0gbnVsbDtcbiAgICB0aGlzLmN1clR1dG9yaWFsID0gbnVsbDtcbiAgICB0aGlzLmxlY0luZGV4ID0gbnVsbDtcblxuICAgIC8vIFdyYXBwZXIgdG8gbGV0IGxvY2Fsc3RvcmFnZSB0YWtlIEpTT05cbiAgICBmdW5jdGlvbiBKU09OTG9jYWxTdG9yYWdlKGJhY2tpbmcsIG9uUXVvdGFFeGNlZWRlZCkge1xuICAgICAgICB0aGlzLmJhY2tpbmcgPSBiYWNraW5nO1xuXG4gICAgICAgIHRoaXMucmVtb3ZlSXRlbSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBiYWNraW5nLnJlbW92ZUl0ZW0oa2V5KTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmdldEl0ZW0gPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBiYWNraW5nLmdldEl0ZW0oa2V5KTtcbiAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKHZhbHVlKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLnNldEl0ZW0gPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBiYWNraW5nLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeSh2YWx1ZSkpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGlmIChlLm5hbWUudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdxdW90YScpID4gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgb25RdW90YUV4Y2VlZGVkKGtleSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmxpc3RJdGVtcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBpLCBvdXQgPSBbXTtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBiYWNraW5nLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgb3V0LnB1c2goYmFja2luZy5rZXkoaSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG91dDtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgdGhpcy5scyA9IG5ldyBKU09OTG9jYWxTdG9yYWdlKHJhd0xvY2FsU3RvcmFnZSwgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICBoYW5kbGVFcnJvcignTm8gbW9yZSBsb2NhbCBzdG9yYWdlIGF2YWlsYWJsZS4gUGxlYXNlIDxhIGhyZWY9XCJzdGFydC5odG1sXCI+cmV0dXJuIHRvIHRoZSBtZW51PC9hPiBhbmQgZGVsZXRlIHNvbWUgdHV0b3JpYWxzIHlvdSBhcmUgbm8gbG9uZ2VyIHVzaW5nLicsICdodG1sJyk7XG4gICAgfSk7XG5cbiAgICAvKiogUmVtb3ZlIHR1dG9yaWFsIGZyb20gbG9jYWxTdG9yYWdlLCBpbmNsdWRpbmcgYWxsIGxlY3R1cmVzLCByZXR1cm4gdHJ1ZSBpZmYgc3VjY2Vzc2Z1bCAqL1xuICAgIHRoaXMucmVtb3ZlVHV0b3JpYWwgPSBmdW5jdGlvbiAodHV0VXJpKSB7XG4gICAgICAgIHZhciBpLCBqLCBsZWN0dXJlcywgcXVlc3Rpb25zLCB0d0luZGV4LCBzZWxmID0gdGhpcztcblxuICAgICAgICAvLyBSZW1vdmUgcXVlc3Rpb24gb2JqZWN0cyBhc3NvY2lhdGVkIHdpdGggdGhpcyB0dXRvcmlhbFxuICAgICAgICBsZWN0dXJlcyA9IHNlbGYubHMuZ2V0SXRlbSh0dXRVcmkpLmxlY3R1cmVzO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVjdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHF1ZXN0aW9ucyA9IGxlY3R1cmVzW2ldLnF1ZXN0aW9ucztcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBsZWN0dXJlc1tpXS5xdWVzdGlvbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxzLnJlbW92ZUl0ZW0obGVjdHVyZXNbaV0ucXVlc3Rpb25zW2pdLnVyaSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZW1vdmUgdHV0b3JpYWwsIGFuZCByZWZlcmVuY2UgaW4gaW5kZXhcbiAgICAgICAgdGhpcy5scy5yZW1vdmVJdGVtKHR1dFVyaSk7XG4gICAgICAgIHR3SW5kZXggPSBzZWxmLmxzLmdldEl0ZW0oJ19pbmRleCcpO1xuICAgICAgICBpZiAoIXR3SW5kZXgpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgICAgIGRlbGV0ZSB0d0luZGV4W3R1dFVyaV07XG4gICAgICAgIHJldHVybiAhIShzZWxmLmxzLnNldEl0ZW0oJ19pbmRleCcsIHR3SW5kZXgpKTtcbiAgICB9O1xuXG4gICAgLyoqIEluc2VydCBxdWVzdGlvbnMgaW50byBsb2NhbFN0b3JhZ2UgKi9cbiAgICB0aGlzLmluc2VydFF1ZXN0aW9ucyA9IGZ1bmN0aW9uIChxbnMsIG9uU3VjY2Vzcykge1xuICAgICAgICB2YXIgaSwgcW5VcmlzID0gT2JqZWN0LmtleXMocW5zKTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHFuVXJpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmxzLnNldEl0ZW0ocW5VcmlzW2ldLCBxbnNbcW5VcmlzW2ldXSkpIHsgcmV0dXJuOyB9XG4gICAgICAgIH1cbiAgICAgICAgb25TdWNjZXNzKCk7XG4gICAgfTtcblxuICAgIC8qKiBSZXR1cm4gZGVlcCBhcnJheSBvZiBsZWN0dXJlcyBhbmQgdGhlaXIgVVJJcyAqL1xuICAgIHRoaXMuZ2V0QXZhaWxhYmxlTGVjdHVyZXMgPSBmdW5jdGlvbiAob25TdWNjZXNzKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcywgaywgdCxcbiAgICAgICAgICAgIHR1dG9yaWFscyA9IFtdLFxuICAgICAgICAgICAgdHdJbmRleCA9IHNlbGYubHMuZ2V0SXRlbSgnX2luZGV4Jyk7XG5cbiAgICAgICAgZnVuY3Rpb24gbGVjVG9PYmplY3QobCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBcInVyaVwiOiBzZWxmLnF1aXpVcmwoaywgbC51cmkpLFxuICAgICAgICAgICAgICAgIFwidGl0bGVcIjogbC50aXRsZSxcbiAgICAgICAgICAgICAgICBcImdyYWRlXCI6IHNlbGYuZ3JhZGVTdHJpbmcoQXJyYXkubGFzdChsLmFuc3dlclF1ZXVlKSlcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChrIGluIHR3SW5kZXgpIHtcbiAgICAgICAgICAgIGlmICh0d0luZGV4Lmhhc093blByb3BlcnR5KGspKSB7XG4gICAgICAgICAgICAgICAgdCA9IHNlbGYubHMuZ2V0SXRlbShrKTtcbiAgICAgICAgICAgICAgICB0dXRvcmlhbHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIFwidXJpXCI6IGssXG4gICAgICAgICAgICAgICAgICAgIFwidGl0bGVcIjogdC50aXRsZSxcbiAgICAgICAgICAgICAgICAgICAgXCJsZWN0dXJlc1wiOiB0LmxlY3R1cmVzLm1hcChsZWNUb09iamVjdCksXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy9UT0RPOiBTb3J0IHR1dG9yaWFscz9cbiAgICAgICAgb25TdWNjZXNzKHR1dG9yaWFscyk7XG4gICAgfTtcblxuICAgIC8qKiBTZXQgdGhlIGN1cnJlbnQgdHV0b3JpYWwvbGVjdHVyZSAqL1xuICAgIHRoaXMuc2V0Q3VycmVudExlY3R1cmUgPSBmdW5jdGlvbiAocGFyYW1zLCBvblN1Y2Nlc3MpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLCBpLCBsZWN0dXJlO1xuICAgICAgICBpZiAoIShwYXJhbXMudHV0VXJpICYmIHBhcmFtcy5sZWNVcmkpKSB7XG4gICAgICAgICAgICBzZWxmLmhhbmRsZUVycm9yKFwiTWlzc2luZyBsZWN0dXJlIHBhcmFtZXRlcnM6IHR1dFVyaSwgcGFyYW1zLmxlY1VyaVwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpbmQgdHV0b3JpYWxcbiAgICAgICAgc2VsZi5jdXJUdXRvcmlhbCA9IHNlbGYubHMuZ2V0SXRlbShwYXJhbXMudHV0VXJpKTtcbiAgICAgICAgaWYgKCFzZWxmLmN1clR1dG9yaWFsKSB7XG4gICAgICAgICAgICBzZWxmLmhhbmRsZUVycm9yKFwiVW5rbm93biB0dXRvcmlhbDogXCIgKyBwYXJhbXMudHV0VXJpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLnR1dG9yaWFsVXJpID0gcGFyYW1zLnR1dFVyaTtcblxuICAgICAgICAvLyBGaW5kIGxlY3R1cmUgd2l0aGluIHR1dG9yaWFsXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBzZWxmLmN1clR1dG9yaWFsLmxlY3R1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsZWN0dXJlID0gc2VsZi5jdXJUdXRvcmlhbC5sZWN0dXJlc1tpXTtcbiAgICAgICAgICAgIGlmIChsZWN0dXJlLnVyaSA9PT0gcGFyYW1zLmxlY1VyaSkge1xuICAgICAgICAgICAgICAgIHNlbGYubGVjSW5kZXggPSBpO1xuICAgICAgICAgICAgICAgIHJldHVybiBvblN1Y2Nlc3MoXG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy50dXRVcmksXG4gICAgICAgICAgICAgICAgICAgIHNlbGYuY3VyVHV0b3JpYWwudGl0bGUsXG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy5sZWNVcmksXG4gICAgICAgICAgICAgICAgICAgIGxlY3R1cmUudGl0bGUsXG4gICAgICAgICAgICAgICAgICAgIHNlbGYuZ3JhZGVTdHJpbmcoQXJyYXkubGFzdChsZWN0dXJlLmFuc3dlclF1ZXVlKSksXG4gICAgICAgICAgICAgICAgICAgIHNlbGYubGFzdEVpZ2h0KClcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHNlbGYuaGFuZGxlRXJyb3IoXCJMZWN0dXJlIFwiICsgcGFyYW1zLmxlY1VyaSArIFwibm90IHBhcnQgb2YgY3VycmVudCB0dXRvcmlhbFwiKTtcbiAgICB9O1xuXG4gICAgLyoqIFJldHVybiB0aGUgY3VycmVudCBsZWN0dXJlICovXG4gICAgdGhpcy5nZXRDdXJyZW50TGVjdHVyZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAoc2VsZi5sZWNJbmRleCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgXCJObyBsZWN0dXJlIHNlbGVjdGVkXCI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNlbGYuY3VyVHV0b3JpYWwubGVjdHVyZXNbc2VsZi5sZWNJbmRleF07XG4gICAgfTtcblxuICAgIC8qKiBSZXR1cm4gdGhlIGFuc3dlciBxdWV1ZSBmb3IgdGhlIGN1cnJlbnQgbGVjdHVyZSAqL1xuICAgIHRoaXMuY3VyQW5zd2VyUXVldWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcywgY3VyTGVjdHVyZSA9IHNlbGYuZ2V0Q3VycmVudExlY3R1cmUoKTtcbiAgICAgICAgaWYgKCFjdXJMZWN0dXJlLmFuc3dlclF1ZXVlKSB7XG4gICAgICAgICAgICBjdXJMZWN0dXJlLmFuc3dlclF1ZXVlID0gW107XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGN1ckxlY3R1cmUuYW5zd2VyUXVldWU7XG4gICAgfTtcblxuICAgIC8qKiBSZXR1cm4gbGFzdCBlaWdodCBub24tcHJhY3RpY2UgcXVlc3Rpb25zIGluIHJldmVyc2Ugb3JkZXIgKi9cbiAgICB0aGlzLmxhc3RFaWdodCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLCBpLCBhLFxuICAgICAgICAgICAgYW5zd2VyUXVldWUgPSBzZWxmLmN1ckFuc3dlclF1ZXVlKCksXG4gICAgICAgICAgICBvdXQgPSBbXTtcblxuICAgICAgICBmb3IgKGkgPSBhbnN3ZXJRdWV1ZS5sZW5ndGg7IGkgPiAwOyBpLS0pIHtcbiAgICAgICAgICAgIGEgPSBhbnN3ZXJRdWV1ZVtpIC0gMV07XG4gICAgICAgICAgICBpZiAoYS5hbnN3ZXJfdGltZSAmJiAhYS5wcmFjdGljZSkge1xuICAgICAgICAgICAgICAgIG91dC5wdXNoKGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG91dC5sZW5ndGggPj0gOCkgeyByZXR1cm4gb3V0OyB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dDtcbiAgICB9O1xuXG4gICAgLyoqIENob29zZSBhIG5ldyBxdWVzdGlvbiBmcm9tIHRoZSBjdXJyZW50IHR1dG9yaWFsL2xlY3R1cmUgKi9cbiAgICB0aGlzLmdldE5ld1F1ZXN0aW9uID0gZnVuY3Rpb24gKHByYWN0aWNlTW9kZSwgb25TdWNjZXNzKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcywgYSwgYW5zd2VyUXVldWUgPSBzZWxmLmN1ckFuc3dlclF1ZXVlKCk7XG5cbiAgICAgICAgaWYgKGFuc3dlclF1ZXVlLmxlbmd0aCA9PT0gMCB8fCBBcnJheS5sYXN0KGFuc3dlclF1ZXVlKS5hbnN3ZXJfdGltZSkge1xuICAgICAgICAgICAgLy8gQXNzaWduIG5ldyBxdWVzdGlvbiBpZiBsYXN0IGhhcyBiZWVuIGFuc3dlcmVkXG4gICAgICAgICAgICBhID0gaWFhbGliLm5ld0FsbG9jYXRpb24oc2VsZi5jdXJUdXRvcmlhbCwgc2VsZi5sZWNJbmRleCwgYW5zd2VyUXVldWUsIHByYWN0aWNlTW9kZSk7XG4gICAgICAgICAgICBpZiAoIWEpIHtcbiAgICAgICAgICAgICAgICBzZWxmLmhhbmRsZUVycm9yKFwiTGVjdHVyZSBoYXMgbm8gcXVlc3Rpb25zIVwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhbnN3ZXJRdWV1ZS5wdXNoKGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gR2V0IHF1ZXN0aW9uIGRhdGEgdG8gZ28gd2l0aCBsYXN0IHF1ZXN0aW9uIG9uIHF1ZXVlXG4gICAgICAgICAgICBhID0gQXJyYXkubGFzdChhbnN3ZXJRdWV1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBzZWxmLmdldFF1ZXN0aW9uRGF0YShhLnVyaSwgZnVuY3Rpb24gKHFuKSB7XG4gICAgICAgICAgICAvLyBHZW5lcmF0ZSBvcmRlcmluZywgZmllbGQgdmFsdWUgLT4gaW50ZXJuYWwgdmFsdWVcbiAgICAgICAgICAgIGEub3JkZXJpbmcgPSBhLm9yZGVyaW5nIHx8IEFycmF5LnNodWZmbGUocW4uc2h1ZmZsZSB8fCBbXSk7XG4gICAgICAgICAgICB3aGlsZSAoYS5vcmRlcmluZy5sZW5ndGggPCBxbi5jaG9pY2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIC8vIFBhZCBvdXQgb3JkZXJpbmcgd2l0aCBtaXNzaW5nIGl0ZW1zIG9uIGVuZFxuICAgICAgICAgICAgICAgIC8vTkI6IEFzc3VtaW5nIHRoYXQgeW91IGNhbid0IGhhdmUgZml4ZWQgaXRlbXMgYW55d2hlcmUgZWxzZSBmb3Igbm93LlxuICAgICAgICAgICAgICAgIGEub3JkZXJpbmcucHVzaChhLm9yZGVyaW5nLmxlbmd0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhLnF1aXpfdGltZSA9IGEucXVpel90aW1lIHx8IE1hdGgucm91bmQoKG5ldyBEYXRlKCkpLmdldFRpbWUoKSAvIDEwMDApO1xuICAgICAgICAgICAgYS5zeW5jZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmIChzZWxmLmxzLnNldEl0ZW0oc2VsZi50dXRvcmlhbFVyaSwgc2VsZi5jdXJUdXRvcmlhbCkpIHsgb25TdWNjZXNzKHFuLCBhKTsgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqIFJldHVybiB0aGUgZnVsbCBkYXRhIGZvciBhIHF1ZXN0aW9uICovXG4gICAgdGhpcy5nZXRRdWVzdGlvbkRhdGEgPSBmdW5jdGlvbiAodXJpLCBvblN1Y2Nlc3MpIHtcbiAgICAgICAgdmFyIHFuLCBzZWxmID0gdGhpcztcbiAgICAgICAgcW4gPSBzZWxmLmxzLmdldEl0ZW0odXJpKTtcbiAgICAgICAgaWYgKCFxbikge1xuICAgICAgICAgICAgc2VsZi5oYW5kbGVFcnJvcihcIkNhbm5vdCBmaW5kIHF1ZXN0aW9uIFwiICsgdXJpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9uU3VjY2Vzcyhxbik7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqIFVzZXIgaGFzIHNlbGVjdGVkIGFuIGFuc3dlciAqL1xuICAgIHRoaXMuc2V0UXVlc3Rpb25BbnN3ZXIgPSBmdW5jdGlvbiAoc2VsZWN0ZWRBbnN3ZXIsIG9uU3VjY2Vzcykge1xuICAgICAgICAvLyBGZXRjaCBxdWVzdGlvbiBvZmYgYW5zd2VyIHF1ZXVlLCBhZGQgYW5zd2VyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcywgYW5zd2VyRGF0YSwgYSA9IEFycmF5Lmxhc3Qoc2VsZi5jdXJBbnN3ZXJRdWV1ZSgpKTtcbiAgICAgICAgYS5hbnN3ZXJfdGltZSA9IE1hdGgucm91bmQoKG5ldyBEYXRlKCkpLmdldFRpbWUoKSAvIDEwMDApO1xuICAgICAgICBhLnNlbGVjdGVkX2Fuc3dlciA9IHNlbGVjdGVkQW5zd2VyO1xuICAgICAgICBhLnN0dWRlbnRfYW5zd2VyID0gYS5vcmRlcmluZ1tzZWxlY3RlZEFuc3dlcl07XG4gICAgICAgIGEuc3luY2VkID0gZmFsc2U7XG5cbiAgICAgICAgLy8gTWFyayB0aGVpciB3b3JrXG4gICAgICAgIHNlbGYuZ2V0UXVlc3Rpb25EYXRhKGEudXJpLCBmdW5jdGlvbiAocW4pIHtcbiAgICAgICAgICAgIHZhciBpLCBhbnN3ZXJEYXRhID0gdHlwZW9mIHFuLmFuc3dlciA9PT0gJ3N0cmluZycgPyBKU09OLnBhcnNlKHdpbmRvdy5hdG9iKHFuLmFuc3dlcikpIDogcW4uYW5zd2VyO1xuICAgICAgICAgICAgLy8gR2VuZXJhdGUgYXJyYXkgc2hvd2luZyB3aGljaCBhbnN3ZXJzIHdlcmUgY29ycmVjdFxuICAgICAgICAgICAgYS5vcmRlcmluZ19jb3JyZWN0ID0gYS5vcmRlcmluZy5tYXAoZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYW5zd2VyRGF0YS5jb3JyZWN0LmluZGV4T2YodikgPiAtMTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy8gU3R1ZGVudCBjb3JyZWN0IGlmZiB0aGVpciBhbnN3ZXIgaXMgaW4gbGlzdFxuICAgICAgICAgICAgYS5jb3JyZWN0ID0gYW5zd2VyRGF0YS5jb3JyZWN0LmluZGV4T2YoYS5zdHVkZW50X2Fuc3dlcikgPiAtMTtcbiAgICAgICAgICAgIC8vIFNldCBhcHByb3ByaWF0ZSBncmFkZVxuICAgICAgICAgICAgYS5ncmFkZV9hZnRlciA9IGEuY29ycmVjdCA/IGEuZ3JhZGVfYWZ0ZXJfcmlnaHQgOiBhLmdyYWRlX2FmdGVyX3dyb25nO1xuICAgICAgICAgICAgYS5sZWNfYW5zd2VyZWQgPSAoYS5sZWNfYW5zd2VyZWQgfHwgMCkgKyAxO1xuICAgICAgICAgICAgYS5sZWNfY29ycmVjdCA9IChhLmxlY19jb3JyZWN0IHx8IDApICsgKGEuY29ycmVjdCA/IDEgOiAwKTtcblxuICAgICAgICAgICAgaWYgKHNlbGYubHMuc2V0SXRlbShzZWxmLnR1dG9yaWFsVXJpLCBzZWxmLmN1clR1dG9yaWFsKSkge1xuICAgICAgICAgICAgICAgIG9uU3VjY2VzcyhhLCBhbnN3ZXJEYXRhLCBzZWxmLmdyYWRlU3RyaW5nKGEpLCBzZWxmLmxhc3RFaWdodCgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qKiBHbyB0aHJvdWdoIGFsbCB0dXRvcmlhbHMvbGVjdHVyZXMsIHJlbW92ZSBhbnkgbGVjdHVyZXMgdGhhdCBkb24ndCBoYXZlIGFuIG93bmVyICovXG4gICAgdGhpcy5yZW1vdmVVbnVzZWRPYmplY3RzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsIGksIHQsIHEsIGssIHR1dG9yaWFsLCBsZWN0dXJlcyxcbiAgICAgICAgICAgIGxzQ29udGVudCA9IHt9LFxuICAgICAgICAgICAgcmVtb3ZlZEl0ZW1zID0gW10sXG4gICAgICAgICAgICBsc0xpc3QgPSBzZWxmLmxzLmxpc3RJdGVtcygpLFxuICAgICAgICAgICAgdHdJbmRleCA9IHNlbGYubHMuZ2V0SXRlbSgnX2luZGV4Jyk7XG5cbiAgICAgICAgLy8gRm9ybSBvYmplY3Qgb2YgZXZlcnl0aGluZyBpbiBsb2NhbFN0b3JhZ2VcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGxzTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbHNDb250ZW50W2xzTGlzdFtpXV0gPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTWFyayBldmVyeXRoaW5nIHdlIGZpbmQgYSByZWZlcmVuY2UgdG8gd2l0aCAxXG4gICAgICAgIGxzQ29udGVudC5faW5kZXggPSAxO1xuICAgICAgICBmb3IgKHQgaW4gdHdJbmRleCkge1xuICAgICAgICAgICAgaWYgKHR3SW5kZXguaGFzT3duUHJvcGVydHkodCkpIHtcbiAgICAgICAgICAgICAgICB0dXRvcmlhbCA9IHNlbGYubHMuZ2V0SXRlbSh0KTtcbiAgICAgICAgICAgICAgICBpZiAoIXR1dG9yaWFsKSB7IGNvbnRpbnVlOyB9XG4gICAgICAgICAgICAgICAgbHNDb250ZW50W3RdID0gMTtcbiAgICAgICAgICAgICAgICBsZWN0dXJlcyA9IHR1dG9yaWFsLmxlY3R1cmVzO1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZWN0dXJlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHEgaW4gbGVjdHVyZXNbaV0ucXVlc3Rpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGVjdHVyZXNbaV0ucXVlc3Rpb25zLmhhc093blByb3BlcnR5KHEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbHNDb250ZW50W2xlY3R1cmVzW2ldLnF1ZXN0aW9uc1txXS51cmldID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIGFueXRoaW5nIGRpZG4ndCBnZXQgYSByZWZlcmVuY2UsIHJlbW92ZSBpdFxuICAgICAgICBmb3IgKGsgaW4gbHNDb250ZW50KSB7XG4gICAgICAgICAgICBpZiAobHNDb250ZW50Lmhhc093blByb3BlcnR5KGspICYmIGxzQ29udGVudFtrXSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJlbW92ZWRJdGVtcy5wdXNoKGspO1xuICAgICAgICAgICAgICAgIHNlbGYubHMucmVtb3ZlSXRlbShrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVtb3ZlZEl0ZW1zO1xuICAgIH07XG5cbiAgICAvKiogSW5zZXJ0IHR1dG9yaWFsIGludG8gbG9jYWxTdG9yYWdlICovXG4gICAgdGhpcy5pbnNlcnRUdXRvcmlhbCA9IGZ1bmN0aW9uICh0dXRVcmksIHR1dFRpdGxlLCBsZWN0dXJlcykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsIGksIHR3SW5kZXgsXG4gICAgICAgICAgICBvbGRMZWN0dXJlcyA9IHt9O1xuICAgICAgICBzZWxmLmN1clR1dG9yaWFsID0gc2VsZi5scy5nZXRJdGVtKHR1dFVyaSk7XG4gICAgICAgIHNlbGYudHV0b3JpYWxVcmkgPSB0dXRVcmk7XG5cbiAgICAgICAgaWYgKHNlbGYubHMuZ2V0SXRlbSh0dXRVcmkpKSB7XG4gICAgICAgICAgICAvLyBTb3J0IG9sZCBsZWN0dXJlcyBpbnRvIGEgZGljdCBieSBVUklcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBzZWxmLmN1clR1dG9yaWFsLmxlY3R1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgb2xkTGVjdHVyZXNbc2VsZi5jdXJUdXRvcmlhbC5sZWN0dXJlc1tpXS51cmldID0gc2VsZi5jdXJUdXRvcmlhbC5sZWN0dXJlc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFR1dG9yaWFsIGFscmVhZHkgZXhpc3RzLCB1cGRhdGUgZWFjaCBsZWN0dXJlXG4gICAgICAgICAgICBzZWxmLmN1clR1dG9yaWFsLnRpdGxlID0gdHV0VGl0bGU7XG4gICAgICAgICAgICBzZWxmLmN1clR1dG9yaWFsLmxlY3R1cmVzID0gW107XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVjdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAob2xkTGVjdHVyZXNbbGVjdHVyZXNbaV0udXJpXSkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmN1clR1dG9yaWFsLmxlY3R1cmVzLnB1c2gob2xkTGVjdHVyZXNbbGVjdHVyZXNbaV0udXJpXSk7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYubGVjSW5kZXggPSBpO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnVwZGF0ZUxlY3R1cmUobGVjdHVyZXNbaV0sIDApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuY3VyVHV0b3JpYWwubGVjdHVyZXMucHVzaChsZWN0dXJlc1tpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gQWRkIHdob2xlIHR1dG9yaWFsIHRvIGxvY2FsU3RvcmFnZVxuICAgICAgICAgICAgc2VsZi5jdXJUdXRvcmlhbCA9IHsgXCJ0aXRsZVwiOiB0dXRUaXRsZSwgXCJsZWN0dXJlc1wiOiBsZWN0dXJlcyB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICghc2VsZi5scy5zZXRJdGVtKHNlbGYudHV0b3JpYWxVcmksIHNlbGYuY3VyVHV0b3JpYWwpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgaW5kZXggd2l0aCBsaW5rIHRvIGRvY3VtZW50XG4gICAgICAgIHR3SW5kZXggPSBzZWxmLmxzLmdldEl0ZW0oJ19pbmRleCcpIHx8IHt9O1xuICAgICAgICB0d0luZGV4W3R1dFVyaV0gPSAxO1xuICAgICAgICByZXR1cm4gISEoc2VsZi5scy5zZXRJdGVtKCdfaW5kZXgnLCB0d0luZGV4KSk7XG4gICAgfTtcblxuICAgIC8qKiBNZWxkIG5ldyBsZWN0dXJlIHRvZ2V0aGVyIHdpdGggY3VycmVudCAqL1xuICAgIHRoaXMudXBkYXRlTGVjdHVyZSA9IGZ1bmN0aW9uIChuZXdMZWN0dXJlLCBzeW5jaW5nTGVuZ3RoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgICAgIGN1ckxlY3R1cmUgPSBzZWxmLmdldEN1cnJlbnRMZWN0dXJlKCk7XG5cbiAgICAgICAgLy8gRW5zdXJlIGFueSBjb3VudHMgaW4gYW5zd2VyUXVldWUgYXJlIGNvbnNpc3RlbnRcbiAgICAgICAgZnVuY3Rpb24gdXBkYXRlQ291bnRzKGV4dHJhLCBwcmV2KSB7XG4gICAgICAgICAgICB2YXIgaSwgbGVjQW5zd2VyZWQgPSAwLCBsZWNDb3JyZWN0ID0gMDtcbiAgICAgICAgICAgIGlmIChleHRyYS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXh0cmE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZWNBbnN3ZXJlZCA9IHByZXYgPyBwcmV2LmxlY19hbnN3ZXJlZCA6IDA7XG4gICAgICAgICAgICBsZWNDb3JyZWN0ID0gcHJldiA/IHByZXYubGVjX2NvcnJlY3QgOiAwO1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGV4dHJhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbGVjQW5zd2VyZWQgKz0gZXh0cmFbaV0uYW5zd2VyX3RpbWUgPyAxIDogMDtcbiAgICAgICAgICAgICAgICBsZWNDb3JyZWN0ICs9IGV4dHJhW2ldLmNvcnJlY3QgPyAxIDogMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIEFycmF5Lmxhc3QoZXh0cmEpLmxlY19hbnN3ZXJlZCA9IGxlY0Fuc3dlcmVkO1xuICAgICAgICAgICAgQXJyYXkubGFzdChleHRyYSkubGVjX2NvcnJlY3QgPSBsZWNDb3JyZWN0O1xuICAgICAgICAgICAgcmV0dXJuIGV4dHJhO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTWVsZCBhbnN3ZXJRdWV1ZSBmcm9tIHNlcnZlciB3aXRoIGFueSBuZXcgaXRlbXMuXG4gICAgICAgIGN1ckxlY3R1cmUuYW5zd2VyUXVldWUgPSBuZXdMZWN0dXJlLmFuc3dlclF1ZXVlLmNvbmNhdChcbiAgICAgICAgICAgIHVwZGF0ZUNvdW50cyhjdXJMZWN0dXJlLmFuc3dlclF1ZXVlLnNsaWNlKHN5bmNpbmdMZW5ndGgpLCBBcnJheS5sYXN0KG5ld0xlY3R1cmUuYW5zd2VyUXVldWUpKVxuICAgICAgICApO1xuXG4gICAgICAgIC8vIFVwZGF0ZSBsb2NhbCBjb3B5IG9mIGxlY3R1cmVcbiAgICAgICAgY3VyTGVjdHVyZS5zZXR0aW5ncyA9IG5ld0xlY3R1cmUuc2V0dGluZ3M7XG4gICAgICAgIGN1ckxlY3R1cmUucXVlc3Rpb25zID0gbmV3TGVjdHVyZS5xdWVzdGlvbnM7XG4gICAgICAgIGN1ckxlY3R1cmUucmVtb3ZlZF9xdWVzdGlvbnMgPSBuZXdMZWN0dXJlLnJlbW92ZWRfcXVlc3Rpb25zO1xuICAgICAgICByZXR1cm4gc2VsZi5scy5zZXRJdGVtKHNlbGYudHV0b3JpYWxVcmksIHNlbGYuY3VyVHV0b3JpYWwpO1xuICAgIH07XG5cbiAgICAvKiogR2VuZXJhdGUgQUpBWCBjYWxsIHRoYXQgd2lsbCBzeW5jIHRoZSBjdXJyZW50IGxlY3R1cmUgKi9cbiAgICB0aGlzLnN5bmNMZWN0dXJlID0gZnVuY3Rpb24gKGZvcmNlKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcywgc3luY2luZ0xlbmd0aCwgY3VyTGVjdHVyZSA9IHNlbGYuZ2V0Q3VycmVudExlY3R1cmUoKTtcbiAgICAgICAgLy8gUmV0dXJuIHRydWUgaWZmIGV2ZXJ5IGFuc3dlclF1ZXVlIGl0ZW0gaGFzIGJlZW4gc3luY2VkXG4gICAgICAgIGZ1bmN0aW9uIGlzU3luY2VkKGxlY3R1cmUpIHtcbiAgICAgICAgICAgIHZhciBpO1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGxlY3R1cmUuYW5zd2VyUXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIWxlY3R1cmUuYW5zd2VyUXVldWVbaV0uc3luY2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWZvcmNlICYmIGlzU3luY2VkKGN1ckxlY3R1cmUpKSB7XG4gICAgICAgICAgICAvLyBOb3RoaW5nIHRvIGRvLCBzdG9wLlxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBOb3RlIGhvdyBsb25nIHF1ZXVlIGlzIG5vdywgc28gd2UgZG9uJ3QgbG9vc2UgcXVlc3Rpb25zIGluIHByb2dyZXNzXG4gICAgICAgIHN5bmNpbmdMZW5ndGggPSBjdXJMZWN0dXJlLmFuc3dlclF1ZXVlLmxlbmd0aDtcbiAgICAgICAgd2hpbGUgKHN5bmNpbmdMZW5ndGggPiAwICYmICFjdXJMZWN0dXJlLmFuc3dlclF1ZXVlW3N5bmNpbmdMZW5ndGggLSAxXS5hbnN3ZXJfdGltZSkge1xuICAgICAgICAgICAgLy8gTGFzdCBpdGVtIGhhc24ndCBiZWVuIGFuc3dlcmVkIHlldCwgbGVhdmUgaXQgYWxvbmVcbiAgICAgICAgICAgIHN5bmNpbmdMZW5ndGggPSBzeW5jaW5nTGVuZ3RoIC0gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdlbmVyYXRlIEFKQVggY2FsbFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KGN1ckxlY3R1cmUpLFxuICAgICAgICAgICAgdXJsOiBjdXJMZWN0dXJlLnVyaSxcbiAgICAgICAgICAgIHR5cGU6ICdQT1NUJyxcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgc2VsZi51cGRhdGVMZWN0dXJlKGRhdGEsIHN5bmNpbmdMZW5ndGgpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgLyoqIEdlbmVyYXRlIGFycmF5IG9mIEFKQVggY2FsbHMsIGNhbGwgdGhlbSB0byBoYXZlIGEgY29tcGxldGUgc2V0IG9mIHF1ZXN0aW9ucyAqL1xuICAgIHRoaXMuc3luY1F1ZXN0aW9ucyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLCBpLCBxdWVzdGlvbkRmZHMsXG4gICAgICAgICAgICBtaXNzaW5nUW5zID0gW10sXG4gICAgICAgICAgICBjdXJMZWN0dXJlID0gc2VsZi5nZXRDdXJyZW50TGVjdHVyZSgpO1xuXG4gICAgICAgIC8vIFJlbW92ZSBsb2NhbCBjb3B5IG9mIGRlYWQgcXVlc3Rpb25zXG4gICAgICAgIGlmIChjdXJMZWN0dXJlLnJlbW92ZWRfcXVlc3Rpb25zKSB7XG4gICAgICAgICAgICBjdXJMZWN0dXJlLnJlbW92ZWRfcXVlc3Rpb25zLm1hcChmdW5jdGlvbiAocW4pIHtcbiAgICAgICAgICAgICAgICBzZWxmLmxzLnJlbW92ZUl0ZW0ocW4pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBXaGljaCBxdWVzdGlvbnMgYXJlIHN0YWxlP1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY3VyTGVjdHVyZS5xdWVzdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChzZWxmLmxzLmdldEl0ZW0oY3VyTGVjdHVyZS5xdWVzdGlvbnNbaV0udXJpKSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIC8vVE9ETzogU2hvdWxkIGJlIGNoZWNraW5nIHF1ZXN0aW9uIGFnZSB0b29cbiAgICAgICAgICAgICAgICBtaXNzaW5nUW5zLnB1c2goaSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWlzc2luZ1Fucy5sZW5ndGggPj0gTWF0aC5taW4oMTAsIGN1ckxlY3R1cmUucXVlc3Rpb25zLmxlbmd0aCkpIHtcbiAgICAgICAgICAgIC8vIE1vc3QgcXVlc3Rpb25zIGFyZSBtaXNzaW5nLCBzbyBqdXN0IGZldGNoIGV2ZXJ5dGhpbmdcbiAgICAgICAgICAgIHJldHVybiBbe1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgICAgICAgICAgY2FjaGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHVybDogY3VyTGVjdHVyZS5xdWVzdGlvbl91cmksXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5pbnNlcnRRdWVzdGlvbnMoZGF0YSwgZnVuY3Rpb24gKCkge30pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1dO1xuICAgICAgICB9XG4gICAgICAgIC8vIE90aGVyd2lzZSwgZmV0Y2ggbmV3IHF1ZXN0aW9uc1xuICAgICAgICByZXR1cm4gbWlzc2luZ1Fucy5tYXAoZnVuY3Rpb24gKGkpIHtcbiAgICAgICAgICAgIHZhciBxblVyaSA9IGN1ckxlY3R1cmUucXVlc3Rpb25zW2ldLnVyaTtcbiAgICAgICAgICAgIC8vIE5ldyBxdWVzdGlvbiB3ZSBkb24ndCBoYXZlIHlldFxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcIkdFVFwiLFxuICAgICAgICAgICAgICAgIGNhY2hlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB1cmw6IHFuVXJpLFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBxbnMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgcW5zW3FuVXJpXSA9IGRhdGE7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuaW5zZXJ0UXVlc3Rpb25zKHFucywgZnVuY3Rpb24gKCkge30pO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqIEhlbHBlciB0byB0dXJuIHRoZSBsYXN0IGl0ZW0gaW4gYW4gYW5zd2VyUXVldWUgaW50byBhIGdyYWRlIHN0cmluZyAqL1xuICAgIHRoaXMuZ3JhZGVTdHJpbmcgPSBmdW5jdGlvbiAobGFzdCkge1xuICAgICAgICBpZiAoIWxhc3QpIHsgcmV0dXJuOyB9XG4gICAgICAgIHJldHVybiBcIkdyYWRlOiBcIiArIChsYXN0LmdyYWRlX2FmdGVyIHx8IGxhc3QuZ3JhZGVfYmVmb3JlIHx8IDApXG4gICAgICAgICAgICAgKyBcIiwgXCIgKyBsYXN0LmxlY19hbnN3ZXJlZCArIFwiIGFuc3dlcmVkXCJcbiAgICAgICAgICAgICArIFwiLCBcIiArIGxhc3QubGVjX2NvcnJlY3QgKyBcIiBjb3JyZWN0XCI7XG4gICAgfTtcblxuICAgIC8qKiBIZWxwZXIgdG8gZm9ybSBhIFVSTCB0byBhIHNlbGVjdGVkIHF1aXogKi9cbiAgICB0aGlzLnF1aXpVcmwgPSBmdW5jdGlvbiAodHV0VXJpLCBsZWNVcmkpIHtcbiAgICAgICAgcmV0dXJuICdxdWl6Lmh0bWw/dHV0VXJpPScgKyBlbmNvZGVVUklDb21wb25lbnQodHV0VXJpKSArICc7bGVjVXJpPScgKyBlbmNvZGVVUklDb21wb25lbnQobGVjVXJpKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICAqIEdpdmVuIFVSTCBvYmplY3QsIGNob3AgcXVlcnlzdHJpbmcgdXAgaW50byBhIGtleS92YWx1ZSBvYmplY3RcbiAgICAgICogZS5nLiBxdWl6LnBhcnNlUVMod2luZG93LmxvY2F0aW9uKVxuICAgICAgKi9cbiAgICB0aGlzLnBhcnNlUVMgPSBmdW5jdGlvbiAodXJsKSB7XG4gICAgICAgIHZhciBpLCBwYXJ0LFxuICAgICAgICAgICAgb3V0ID0ge30sXG4gICAgICAgICAgICBxcyA9IHVybC5zZWFyY2gucmVwbGFjZSgvXlxcPy8sICcnKS5zcGxpdCgvO3wmLyk7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBxcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgcGFydCA9IHFzW2ldLnNwbGl0KCc9Jyk7XG4gICAgICAgICAgICBvdXRbcGFydFswXV0gPSBkZWNvZGVVUklDb21wb25lbnQocGFydFsxXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICAqIEJhc2VkIG9uIGxvY2F0aW9uIChlLmcuIGRvY3VtZW50LmxvY2F0aW9uKSBSZXR1cm4gd2hhdCBpcyBwcm9iYWJseSB0aGVcbiAgICAgICogUGxvbmUgcm9vdFxuICAgICAgKi9cbiAgICB0aGlzLnBvcnRhbFJvb3RVcmwgPSBmdW5jdGlvbiAobG9jYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIGxvY2F0aW9uLnByb3RvY29sICsgJy8vJ1xuICAgICAgICAgICAgICsgbG9jYXRpb24uaG9zdCArICcvJztcbiAgICB9O1xufTtcbiIsIi8qanNsaW50IG5vbWVuOiB0cnVlLCBwbHVzcGx1czogdHJ1ZSwgYnJvd3Nlcjp0cnVlKi9cbi8qZ2xvYmFsIGpRdWVyeSovXG52YXIgUXVpeiA9IHJlcXVpcmUoJy4vcXVpemxpYi5qcycpO1xuXG5mdW5jdGlvbiBTdGFydFZpZXcoJCwganFRdWl6LCBqcVNlbGVjdCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIHRoaXMuanFRdWl6ID0ganFRdWl6O1xuICAgIHRoaXMuanFTZWxlY3QgPSBqcVNlbGVjdDtcblxuICAgIC8qKiBQdXQgYW4gYWxlcnQgZGl2IGF0IHRoZSB0b3Agb2YgdGhlIHBhZ2UgKi9cbiAgICB0aGlzLnJlbmRlckFsZXJ0ID0gZnVuY3Rpb24gKHR5cGUsIG1lc3NhZ2UpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBzZWxmLmpxUXVpei5jaGlsZHJlbignZGl2LmFsZXJ0JykucmVtb3ZlKCk7XG4gICAgICAgIHNlbGYuanFRdWl6LnByZXBlbmQoJCgnPGRpdiBjbGFzcz1cImFsZXJ0XCI+JylcbiAgICAgICAgICAgIC5hZGRDbGFzcyhcImFsZXJ0LVwiICsgdHlwZSlcbiAgICAgICAgICAgIC50ZXh0KG1lc3NhZ2UpKTtcbiAgICB9O1xuXG4gICAgLyoqIEdlbmVyYXRlIGV4cGFuZGluZyBsaXN0IGZvciB0dXRvcmlhbHMgLyBsZWN0dXJlcyAqL1xuICAgIHRoaXMucmVuZGVyQ2hvb3NlTGVjdHVyZSA9IGZ1bmN0aW9uIChxdWl6LCBpdGVtcykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHNlbGYuanFTZWxlY3QuZW1wdHkoKTtcblxuICAgICAgICAvLyBFcnJvciBtZXNzYWdlIGlmIHRoZXJlJ3Mgbm8gaXRlbXNcbiAgICAgICAgaWYgKCFpdGVtcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHNlbGYucmVuZGVyQWxlcnQoXCJpbmZvXCIsICdZb3UgaGF2ZSBubyB0dXRvcmlhbHMgbG9hZGVkIHlldC4gUGxlYXNlIHZpc2l0IHR1dG9yd2ViIGJ5IGNsaWNraW5nIFwiR2V0IG1vcmUgdHV0b3JpYWxzXCIsIGFuZCBjaG9vc2UgYSBkZXBhcnRtZW50IGFuZCB0dXRvcmlhbCcpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gW1tocmVmLCB0aXRsZSwgaXRlbXNdLCBbaHJlZiwgdGl0bGUsIGl0ZW1zXSwgLi4uXSA9PiBtYXJrdXBcbiAgICAgICAgLy8gaXRlbXMgY2FuIGFsc28gYmUge3VyaTogJycsIHRpdGxlOiAnJ31cbiAgICAgICAgZnVuY3Rpb24gbGlzdFRvTWFya3VwKGl0ZW1zKSB7XG4gICAgICAgICAgICB2YXIgaSwganFBLCBpdGVtLCBqcVVsID0gJCgnPHVsLz4nKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgaXRlbXMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpdGVtID0gaXRlbXNbaV07XG4gICAgICAgICAgICAgICAganFBID0gJCgnPGEvPicpLmF0dHIoJ2hyZWYnLCBpdGVtLnVyaSkudGV4dChpdGVtLnRpdGxlKTtcbiAgICAgICAgICAgICAgICBpZiAoaXRlbS5ncmFkZSkge1xuICAgICAgICAgICAgICAgICAgICBqcUEuYXBwZW5kKCQoJzxzcGFuIGNsYXNzPVwiZ3JhZGVcIi8+JykudGV4dChpdGVtLmdyYWRlKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGpxVWwuYXBwZW5kKCQoJzxsaS8+JylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hcHBlbmQoanFBKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZChsaXN0VG9NYXJrdXAoaXRlbS5sZWN0dXJlcykpXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGpxVWw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWN1cnNpdmVseSB0dXJuIHR1dG9yaWFscywgbGVjdHVyZXMgaW50byBhIHVsLCBwb3B1bGF0ZSBleGlzdGluZyB1bC5cbiAgICAgICAgc2VsZi5qcVNlbGVjdC5hcHBlbmQobGlzdFRvTWFya3VwKGl0ZW1zKS5jaGlsZHJlbigpKTtcbiAgICB9O1xufVxuXG4oZnVuY3Rpb24gKHdpbmRvdywgJCwgdW5kZWZpbmVkKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgdmFyIHF1aXosIHZpZXcsXG4gICAgICAgIGpxUXVpeiA9ICQoJyN0dy1xdWl6JyksXG4gICAgICAgIGpxU2VsZWN0ID0gJCgnI3R3LXNlbGVjdCcpLFxuICAgICAgICBqcVByb2NlZWQgPSAkKCcjdHctcHJvY2VlZCcpLFxuICAgICAgICBqcVN5bmMgPSAkKCcjdHctc3luYycpLFxuICAgICAgICBqcURlbGV0ZSA9ICQoJyN0dy1kZWxldGUnKTtcblxuICAgIC8vIERvIG5vdGhpbmcgaWYgbm90IG9uIHRoZSByaWdodCBwYWdlXG4gICAgaWYgKCQoJ2JvZHkucXVpei1zdGFydCcpLmxlbmd0aCA9PSAwKSB7IHJldHVybjsgfVxuXG4gICAgLy8gQ2F0Y2ggYW55IHVuY2F1Z2h0IGV4Y2VwdGlvbnNcbiAgICB3aW5kb3cub25lcnJvciA9IGZ1bmN0aW9uIChtZXNzYWdlLCB1cmwsIGxpbmVudW1iZXIpIHtcbiAgICAgICAgdmlldy5yZW5kZXJBbGVydChcImVycm9yXCIsIFwiSW50ZXJuYWwgZXJyb3I6IFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICsgbWVzc2FnZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICArIFwiIChcIiArIHVybCArIFwiOlwiICsgbGluZW51bWJlciArIFwiKVwiKTtcbiAgICB9O1xuXG4gICAgLy8gV2lyZSB1cCBxdWl6IG9iamVjdFxuICAgIHZpZXcgPSBuZXcgU3RhcnRWaWV3KCQsIGpxUXVpeiwganFTZWxlY3QpO1xuICAgIHF1aXogPSBuZXcgUXVpeihsb2NhbFN0b3JhZ2UsIGZ1bmN0aW9uIChtZXNzYWdlKSB7XG4gICAgICAgIHZpZXcucmVuZGVyQWxlcnQoXCJlcnJvclwiLCBtZXNzYWdlKTtcbiAgICB9KTtcblxuICAgIC8vIFJlZnJlc2ggbWVudSwgYm90aCBvbiBzdGFydHVwIGFuZCBhZnRlciBtdW5naW5nIHF1aXp6ZXNcbiAgICBmdW5jdGlvbiByZWZyZXNoTWVudSgpIHtcbiAgICAgICAgcXVpei5nZXRBdmFpbGFibGVMZWN0dXJlcyhmdW5jdGlvbiAobGVjdHVyZXMpIHtcbiAgICAgICAgICAgIHZpZXcucmVuZGVyQ2hvb3NlTGVjdHVyZShxdWl6LCBsZWN0dXJlcyk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZWZyZXNoTWVudSgpO1xuXG4gICAgLy8gUG9pbnQgdG8gcm9vdCBvZiBjdXJyZW50IHNpdGVcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndHctaG9tZScpLmhyZWYgPSBxdWl6LnBvcnRhbFJvb3RVcmwoZG9jdW1lbnQubG9jYXRpb24pO1xuXG4gICAgLy8gSWYgYnV0dG9uIGlzIGRpc2FibGVkLCBkbyBub3RoaW5nXG4gICAganFQcm9jZWVkLmNsaWNrKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGlmICgkKHRoaXMpLmhhc0NsYXNzKFwiZGlzYWJsZWRcIikpIHtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gU3luYyBhbGwgdHV0b3JpYWxzXG4gICAganFTeW5jLmNsaWNrKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIC8vVE9ETzogU3luYyB0dXRvcmlhbHMgaW4gdHVyblxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9KTtcblxuICAgIC8vIFJlbW92ZSBzZWxlY3RlZCB0dXRvcmlhbFxuICAgIGpxRGVsZXRlLmNsaWNrKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgaWYgKCQodGhpcykuaGFzQ2xhc3MoXCJkaXNhYmxlZFwiKSkge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIC8vVE9ETzogU3luYyBmaXJzdFxuICAgICAgICBxdWl6LnJlbW92ZVR1dG9yaWFsKCQoc2VsZikuZGF0YSgndHV0VXJpJykpO1xuICAgICAgICByZWZyZXNoTWVudSgpO1xuICAgICAgICBqcVByb2NlZWQuYWRkQ2xhc3MoXCJkaXNhYmxlZFwiKTtcbiAgICAgICAganFEZWxldGUuYWRkQ2xhc3MoXCJkaXNhYmxlZFwiKTtcbiAgICB9KTtcblxuICAgIC8vIENsaWNrIG9uIHRoZSBzZWxlY3QgYm94IG9wZW5zIC8gY2xvc2VzIGl0ZW1zXG4gICAganFTZWxlY3QuY2xpY2soZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgdmFyIGpxVGFyZ2V0ID0gJChlLnRhcmdldCk7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAganFTZWxlY3QuZmluZChcIi5zZWxlY3RlZFwiKS5yZW1vdmVDbGFzcyhcInNlbGVjdGVkXCIpO1xuICAgICAgICBqcVByb2NlZWQuYWRkQ2xhc3MoXCJkaXNhYmxlZFwiKTtcbiAgICAgICAganFEZWxldGUuYWRkQ2xhc3MoXCJkaXNhYmxlZFwiKTtcbiAgICAgICAgaWYgKGpxVGFyZ2V0LnBhcmVudCgpLnBhcmVudCgpWzBdID09PSB0aGlzKSB7XG4gICAgICAgICAgICAvLyBBIDFzdCBsZXZlbCB0dXRvcmlhbCwgSnVzdCBvcGVuL2Nsb3NlIGl0ZW1cbiAgICAgICAgICAgIGpxVGFyZ2V0LnBhcmVudCgpLnRvZ2dsZUNsYXNzKFwiZXhwYW5kZWRcIik7XG4gICAgICAgICAgICBpZiAoanFUYXJnZXQucGFyZW50KCkuaGFzQ2xhc3MoXCJleHBhbmRlZFwiKSkge1xuICAgICAgICAgICAgICAgIGpxRGVsZXRlLmRhdGEoJ3R1dFVyaScsIGUudGFyZ2V0LmhyZWYpO1xuICAgICAgICAgICAgICAgIGpxRGVsZXRlLnJlbW92ZUNsYXNzKFwiZGlzYWJsZWRcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZS50YXJnZXQudGFnTmFtZSA9PT0gJ0EnIHx8IGUudGFyZ2V0LnRhZ05hbWUgPT09ICdTUEFOJykge1xuICAgICAgICAgICAgaWYgKGUudGFyZ2V0LnRhZ05hbWUgPT09ICdTUEFOJykge1xuICAgICAgICAgICAgICAgIGpxVGFyZ2V0ID0ganFUYXJnZXQucGFyZW50KCdhJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBBIHF1aXogbGluaywgc2VsZWN0IGl0XG4gICAgICAgICAgICBqcVRhcmdldC5hZGRDbGFzcyhcInNlbGVjdGVkXCIpO1xuICAgICAgICAgICAganFQcm9jZWVkLnJlbW92ZUNsYXNzKFwiZGlzYWJsZWRcIik7XG4gICAgICAgICAgICBqcURlbGV0ZS5yZW1vdmVDbGFzcyhcImRpc2FibGVkXCIpO1xuICAgICAgICAgICAganFQcm9jZWVkLmF0dHIoJ2hyZWYnLCBqcVRhcmdldC5hdHRyKCdocmVmJykpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbn0od2luZG93LCBqUXVlcnkpKTtcbiJdfQ==
