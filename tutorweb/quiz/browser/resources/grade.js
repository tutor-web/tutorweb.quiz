
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
	var nomans = answers.slice(); //take copy to not mess with original array
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

//NB: þetta fall verður líklega ekki notað
function eightAndweights(answers) //ToDo - +1 answer i.e. grades[1] í else!!
{
    var nomans = answers;
    var grade = new Array();
    var returner = 0;
	if(nomans.length < 7)	//ToDo can this be recursive/call to last i.e. return lastEight(nomans);
	{
		while(nomans.length < 8) 
            nomans.push(0); 
		var current = 0;		//current number of correct answers
		for(i = 0; i < 8 ; i++)
		current += nomans[i];
		returner = Math.round((current/8*10)*4)/4;	//convert to 0-10 format
	
		grade[0] = returner;
		if(nomans[7] === 0) // determines if the score will change
		{
			current++;
			returner = Math.round((current/8*10)*4)/4;
		}
		grade[1] = returner;
		return grade;
	}
	else{	//using weights
	var sum = 0;	//total sum to be tallied
	var cumsum  = 0;	//sum of all weighted answers
	for(i=0; i<7; i++)
		sum += nomans[i];	//works like the other functions
	var weight = 8;
	while (weight < 23 && weight < nomans.length)	//determine how many answers after the seventh
		weight ++;
	i=7;
	while(i<23 && i< nomans.length){
		cumsum += nomans[i]*(((i - 7)/(weight-7))/(0.5*(weight-8))); //ToDo find out why this works
        i++;
	}
	sum += cumsum;
	returner = (Math.round((sum/8*10)*4)/4).toFixed(2);
	grade[0] = returner;
   nomans.splice(0,0,1); // ToDo can this be optimized?
    var sum = 0;
	var cumsum  = 0;
	var divider = 0;
	for(i=0; i<7; i++)
		sum += nomans[i];
	var weight = 8;
	while (weight < 23 && weight < nomans.length)
		weight ++;
	i=7;
	while(i<23 && i< nomans.length){
		cumsum += nomans[i]*(((i - 7)/(weight-7))/(0.5*(weight-8))); //ToDo find out why this works
        i++;
	}
	sum += cumsum;
	returner = (Math.round((sum/8*10)*4)/4).toFixed(2);
	grade[1] = returner;
	return grade;
	}
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
    var returner = 0;    //intermediary to be copied to grade[]
	var sum = 0;	//total sum to be tallied
    var debug = 0;
	var cumsum  = 0;	//sum of all weighted answers
    if(nomans.length < 7)
    {
        while(nomans.length < 7)
            nomans.push(0);
    }        
	for(i=0; i<7; i++){
		nomans[i] = nomans[i]/10;  //solid weight of 0.1 for first 7
        //print(nomans[i]);
        sum += nomans[i];}	//works like the other functions
	var weight = 7;
	while (weight < 23 && weight < nomans.length)	//determine how many answers after the seventh
		weight ++;
    //print(weight);    
	i=7;
	while(i<weight && i< nomans.length){
		nomans[i] = nomans[i]*((23-i)/(23-7)); //ToDo 
        //print(nomans[i]);
        if (nomans[i] === 0)
            cumsum += 1/2;
        else    
		    cumsum += nomans[i];
        i++;
	}
    i=7;
    while(i<weight && i< nomans.length){
       nomans[i] = nomans[i]/(cumsum)*0.3;
       //print(nomans[i]);
       sum += nomans[i];
       debug += nomans[i];
       i++;}
    //print(debug);   
    //print(cumsum); 
    //print(sum);
	returner = (Math.round((sum*10)*4)/4).toFixed(2);
	grade[0] = returner;
    //print(answers);
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
        //print(nomans[i]);
        sum += nomans[i];}	//works like the other functions
	weight = 7;
	while (weight < 23 && weight < nomans.length)	//determine how many answers after the seventh
		weight ++;
    //print(weight);    
	i=7;
	while(i<weight && i< nomans.length){
		nomans[i] = nomans[i]*((23-i)/(23-7)); //ToDo
        //print(nomans[i]);
        if (nomans[i] === 0)
            cumsum += 1/2;
        else    
		    cumsum += nomans[i];
        i++;
	}
    i=7;
    while(i<weight && i< nomans.length){
       nomans[i] = nomans[i]/(cumsum)*0.3;
      // print(nomans[i]);
       sum += nomans[i];
       //debug += nomans[i];
       i++;}
    //print(debug);   
    //print(cumsum); 
    //print(sum);
	returner = (Math.round((sum*10)*4)/4).toFixed(2);
	grade[1] = returner;
	return grade;  
}

//Use: var vector = averageWeights(answers);
//Before: answers is an array with items consisting of 1's of 0's
//After: vetor is a 2 item array giving a grade from 1-10 by using the formula:
// (sum of n first items) / n * 10, where n = total number of items / 2.
function averageWeights(answers)
{
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
            print(sum);    
            sum = (Math.round((sum/8*10)*4)/4).toFixed(2);
            grade[0] = sum;
        }
        else if(nomans.length <= 60){	// takes more answers into your grade the more you try
            for (i=0; i<n; i++)
                sum += nomans[i];
            sum = (Math.round((sum/n*10)*4)/4).toFixed(2);  
            grade[0] = sum;
        } 
        else{
            for(i=0; i<30; i++)		// peaks at 60+ answers taking the first 30 answers into the grade
                sum += nomans[i];
            sum = (Math.round((sum/30*10)*4)/4).toFixed(2);
            grade[0] = sum;
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
            grade[1] = sum;
        }
        else if(nomans.length <= 60){
            for (i=0; i<n; i++)
                sum += nomans[i];
            sum = (Math.round((sum/n*10)*4)/4).toFixed(2);  
            grade[1] = sum;
        } 
        else{
            for(i=0; i<30; i++)
                sum += nomans[i];
            sum = (Math.round((sum/30*10)*4)/4).toFixed(2);
            grade[1] = sum;
        }
    return grade;
}
