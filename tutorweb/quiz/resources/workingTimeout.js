//This is the lates working version of the timeout equation, currently it takes in the grade but that shouldnt be neccesary, just needed that to test.
//Use var x = callMs(grade) where x is a float representing minutes available for the current question
function callMs(grade)
{
    var a = 10; // max time
    var b = 2; //placeholder : b will be randomized (with 2 being the most common) and saved to My SQL
    var gradeaverage = 5; // g* : will likely be five but might change
    var d = 2*Math.sqrt(2); //will be 2s^2 where s = sqrt(2)
    var ms = a*(1-(1-(b / a))*Math.exp(-(Math.pow((grade-gradeaverage),2))/d));
    return ms;
}

//This is the function I wanted to test using a live server , If I did my homework this should clear all answers and call another question (so the answer will be wrong in any case)

function timeOut()//ToDo proper timeout function this should do the trick though
{
	for(i=0; i<qn.ordering.length ; i++)
		document.getElementById("answer_" + i ).checked = false,
	document.getElementById("tw-proceed").click();//need to be sure on right button, also looks like I need to select a wrong answer before proceeding
}



//below is a working version of a display of the timer. I know it wont be used like that but I'm putting it in here anyway just to show how I tested it.

var time = callMs(5)
var min = Math.floor(time);   // set the minutes
var sec = Math.floor((time - min)*60);   // set the seconds


function countDown() {
   sec--;
  if (sec == -01) {
   sec = 59;
   min = min - 1; }
  else {
   min = min; }

if (sec<=9) { sec = "0" + sec; }

  time = (min<=9 ? "0" + min : min) + " min and " + sec + " sec ";

 document.getElementById('tw-timer').innerText = time;

SD=window.setTimeout("countDown();", 1000);
if (min == '00' && sec == '00') { timeOut(); }
}
window.onload = countDown;

//this function simply replaces the text for the next button to tell me that I'm using the right button
/*function timeOut()
{
	document.getElementById("tw-proceed").innerText = "works";
}*/