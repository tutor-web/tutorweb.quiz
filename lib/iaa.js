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
    this.gradeAllocation = function(answerQueue) {
        var last,
            gradenow;

        if (answerQueue.length === 0) return;
        last = answerQueue[answerQueue.length - 1];

        if (last.hasOwnProperty('correct')) {
            gradenow = this.callGrade(answerQueue);
            last.grade_after = gradenow[0];
            last.grade_next_right = gradenow[1];
            last.grade_next_wrong = gradenow[2];
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
