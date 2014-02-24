More: https://github.com/tutorweb/tutorweb.quiz

Local development
-----------------

You can run the unit tests thus::

    make install_dependencies
    make test

If you want to modify the JS code, you will need to use browserify to compile
the source code into a module. You can do::

    make install_dependencies
    make

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
