More: https://github.com/tutorweb/tutorweb.quiz

Unit testing
------------

You will need nodeJS to run the tests, if you have it, run::

    nodejs run-tests.js

Local testing
-------------

There is a mock-tutorial page that will generate the data structures that you
would ordinarily get from Plone.

To use:

* Run ``git clone https://github.com/tutor-web/tutorweb.quiz.git`` to 
download 
* ``cd tutorweb.quiz ; git submodule update --init`` to fetch MathJax 
* Open the tutorweb.quiz/tutorweb/quiz/resources/mock-tutorial.html page
you just downloaded in your browser.
* Press "Generate mock lecture" and then "Return to menu"
* Note that since this is at a different URL, you won't get any of the
lectures from mobile.tutor-web.net
