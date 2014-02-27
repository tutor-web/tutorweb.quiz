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
            oldGrade = 0
        } else {
            oldGrade = answerQueue[answerQueue.length - 1].grade_after || 0;
        }

        return {
            "uri": questions[this.item_allocation(questions, oldGrade)].uri,
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
    this.gradeAllocation = function(settings, answerQueue) {
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
                if (!a || !a.hasOwnProperty('correct')) continue;

                total += weighting[i] * (a.correct ? 1 : -0.5);
            }

            // Return grade 0..10, rounded to 1dp.
            return Math.max(Math.round(total * 100) / 10, 0);
        }

        // Only grade if all questions have been answered
        if (answerQueue.length === 0) return;
        last = answerQueue[answerQueue.length - 1];

        // Filter unanswered / practice questions
        aq = answerQueue.filter(function (a) {
            return a
                && !a.practice
                && a.hasOwnProperty('correct');
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
      *     mmax=min(30, n)
      *     w(1)=alpha
      *     w(2:nmax)=(1-alpha)*(1-(t-1)/(nmax+1))^s/(sum((1-(t-1)/(nmax+1))^s))
      *       ... but if w(2)>alpha use:
      *     w(1:nmax) = (1-t/(nmax+1))^s/(sum((1-t/(nmax+1))^s))
      */
    this.gradeWeighting = function (n, alpha, s) {
        var i, t,
            weightings = [],
            total = 0,
            nmax = Math.min(30, n) + 1; //NB: One greater than formulae

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

	/** Choose a question from the array based on the current grade
	  * questions: An array of objects, containing:-
	  *     chosen: Number of times question has been answered
	  *     correct: Of those times, how many a student gave a correct answer
	  * grade: Student's current grade, as calculated by gradeAllocation()
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
		//finnur öfugt cdf (cumulative distribution function) miðað við
		//gefið pdf og eitthvað gefið u = F(x)
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
		//ranks er vigur með gildi frá 0-vector.length-1
		//og raðast upp eftir stærð á gildunum í vector
		//dæmi: vector[3, 5, 1, 2, 7] væri ranking[2, 3, 0, 1, 4]
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
		//Fyrir: index og grade eru heiltölur, index
		//er hversu margar spurningar eru í heildina fyrir þann glærupakka, q er
		//tölfræði stuðull
		//0<q<1 grade er einkun fyrir þann glærupakka
		//Eftir: pdf er fylki með þettleika dreifingar fyrir hverja spurningu
		function ia_pdf(index, grade, q)
		{
			grade = grade / 10;                //einkannir frá 0:1
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
			var sum = 0.0;                        //sum er summan úr öllum stökum í pdf
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
};
