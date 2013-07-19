//returns a reverse cdf(cumulative distribution function) for 
//a given pdf and a given u = F(x)
//finnur öfugt cdf (cumulative distribution function) miðað við
//gefið pdf og eitthvað gefið u = F(x)
function ia_inverse_cdf(pdf, u)
{
    var i = 0;
    cumsum=pdf[0];
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
    for(a = 0; a<found.length; a++)
        found[a] = false;
    for(i = 0; i<vector.length; i++){
        var min = 10000;
        var index = 0;
        for(j = 0; j<vector.length; j++)
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

//multiplies two vectors together (element wise)
//margfaldar tvo vigra saman (element wise)
Array.prototype.multiply = function(x)
{
    array = this;
    for(i=0; i<array.length; i++)
            array[i] = array[i]* x[i];
    return array;
}

//puts all the items of an array to a given power
//tekur fylki og setur það í veldi
Array.prototype.power = function(power)
{
    array = this;
    for(i=0; i<array.length; i++)
        array[i] = Math.pow(array[i], power);
}

//divides all the items of an array with a scalar
//Tekur fylki og deilir með heiltölu (scalar)
Array.prototype.divideScalar= function(scalar)
{
    array = this;
    for(i = 0; i< array.length; i++)
        array[i] = array[i]/scalar;
    return array;
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
    for(h = 0; h< index; h++)
        x[h] = (h+1)/(index+1.0);
    var alpha = q*grade;
    var beta = q - alpha;
    var y = new Array();
    for(i=0; i<x.length;i++)
        y[i]=1-x[i];
    x.power(alpha);                        //pdf=(x^alpha)*(1-x)^beta
    y.power(beta);
    var pdf = x.multiply(y);
    var sum = 0.0;                        //sum er summan úr öllum stökum í pdf
    for(j=0; j<x.length; j++)
        sum += pdf[j];
    pdf.divideScalar(sum);
    return pdf;
}

//Use: var i = item_allocation(numansvec, corransvec, grade)
//Before: numansvec and corransvec are arrays witht the total number of times
//certain question is answered and the number of times it is answered correctly 
//respectively. grade is the current grade, currently on a scale from -0.5 - 1
//After: i is an integer representing the index of the next question to be answered
function item_allocation(numansvec, corransvec, grade)
{
    var debug = false;  //ToDo make this work
        var dparam = numansvec.length / 10.0;
        var numquestions = numansvec.length;
        var difficulty = new Array();
        difficulty.length = numquestions;
        for(qindex = 0; qindex < numansvec.length; qindex++)
        {
                if(numansvec[qindex] > 5)        
					difficulty[qindex] = 1.0- (corransvec[qindex]/numansvec[qindex]);
                else if(grade < 0)
					difficulty[qindex]=(((numansvec[qindex]-corransvec[qindex])/2.0) + Math.random())/100.0;
                else
                       difficulty[qindex] = 1.0 -(((numansvec[qindex]-corransvec[qindex])/2.0) + Math.random())/100.0;
        }
        var ranks = ranking(difficulty);
        var pdf = ia_pdf(numquestions, grade, dparam);
        var probvec = new Array();
        probvec.length = numquestions;
        for(i = 0; i<numquestions; i++)
        {
                for(j = 0; j<numquestions; j++)
                {
                        if(ranks[j] == i)
                        {
                                probvec[j] = pdf[i];
                        }
                }
        }
        utmp = Math.random();
        selectedindex=ia_inverse_cdf(probvec, utmp);
   /* if(debug)
    { //þessi kóði á hugsanlega að vera debug kóðinn fyrir fallið en er að lenda í __exposed props__ veseni
        console.log("###################");
		console.log("output from item_allocation");
		console.log("selected index: " , selectedindex );
		console.log("grade is:", grade );
		console.log("utmp: ", utmp );
		var counter = 0;
		console.log("index numrequested numcorrect ");
		for i in numansvev
		{
			console.log(counter, i, corransvec[counter] );
			counter += 1;
		}
		console.log("End output");
    }*/
        return(selectedindex);
}
