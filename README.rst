More: https://github.com/tutorweb/tutorweb.quiz

Local development
-----------------

Firstly you need to ensure you have npm and nodejs installed, e.g::

    apt-get install nodejs npm

Then you can run the tests with::

    make test

Which should first install all the nodejs dependencies you need for them, then
run the tests.

The browser runs a "compiled" version of the code in
``tutorweb/quiz/resources/tw.js``. We use browserify to create this. If you
want to modify the code and run it in the browser, you will need to run
``make`` before the build. This will:

* Ensure browserify and other dependencies are installed
* Run tests
* Compile sources into ``tw.js`` and ``tw-debug.js``

Whilst committing, jshint should be run over the code and complain if it finds
anything it doesn't like. You can run this test separately with ``make lint``.

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
