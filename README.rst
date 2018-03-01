Tutorweb (client-side component)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

A Plone site to aid in teaching.

This repository contains the client-side drill component, for more information
on tutorweb in general, go to: https://github.com/tutor-web/tutorweb.buildout

Using the quiz on it's own
--------------------------

The quiz component of Tutor-Web can work on it's own without the content
management system, which is useful for development and a few more toys that you
don't get from the main interface.

First you have to download the sources using git::

    git clone https://github.com/tutor-web/tutorweb.quiz.git

The debug page
--------------

There is a hidden special page, ``debug.html`` that allows you to:

* See what is in localStorage, and remove it
* Take a dump of localStorage for offline analysis
* Play with the grading algorithm.

Local development
-----------------

Firstly you need to ensure you have npm and nodejs installed, e.g::

    apt-get install nodejs npm

If you haven't already, download these sources with::

    git clone https://github.com/tutor-web/tutorweb.quiz.git

Then you can run ``make``, which will fetch all modules needed, run the tests,
and if everything worked build the compiled version in
``www/tw.js``. If you want to just run tests, you can do
``make test``.

Running in a browser
--------------------

To run locally, do:

* ``git submodule update --init`` to fetch MathJax
* ``make webserver`` to start a webserver.
* Go to ``http://localhost:8000/quiz/start.html`` in your browser

Since this quiz is at a different URL, you don't get any of the lectures from
mobile.tutor-web.net. There is a mock-tutorial page that will generate the data
structures that you would ordinarily get from Plone.

* Go to ``http://localhost:8000/quiz/mock-tutorial.html``
* Press "Generate mock lecture", then "Return to menu"
* Start your mock quiz as you would ordinarily.

Note any time that you request ``/quiz/tw.js`` it will be rebuilt first, so you
don't need to do this yourself.

Committing
----------

Before you can commit anything, several steps will happen:

* JSHint will be run over the code, and complain if it finds anything it
  doesn't like (you can run this yourself with ``make lint``)
* The compiled version will be rebuilt. You should make sure that the compiled
  version is in sync with your changes

Misc. tips
----------

It can be useful in tests to fill localStorage, here's a quick snippet::

    i = i || 0 ; while (true) { localStorage['filler' + i++] = new Array( 100 ).join(i); }

Acknowledgements
----------------

This project uses the infamous `Silk iconset <http://www.famfamfam.com/lab/icons/silk/>`_.
