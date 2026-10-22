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
``tutorweb/quiz/resources/tw.js``. If you want to just run tests, you can do
``make test``.

Working against a local tutorweb-quizlib
----------------------------------------

The answer-chain encoding, the item allocation and the setting lookup live in
`tutorweb-quizlib <https://github.com/tutor-web/quizlib>`_, because the sync
backend has to agree with us about all three. ``npm`` fetches it from git, so
by default you are building against whatever is committed there, not against
your working copy of it.

To build against a checkout instead, register it once::

    (cd ../tutorweb-quizlib && npm link)

and then, in this repository, point at the registered copy::

    npm link tutorweb-quizlib

``node_modules/tutorweb-quizlib`` becomes a symlink, so edits to the checkout
are picked up with no reinstall - ``make test`` and ``make
tutorweb/quiz/resources/tw.js`` both see them immediately.

To go back to the committed version::

    npm ci

which rebuilds ``node_modules`` from the lockfile and drops the symlink. Use
that rather than ``npm unlink``: unlink is an alias for uninstall, and it
takes the dependency out of ``package.json`` as well as out of
``node_modules``.

Two things worth knowing:

* ``npm link`` writes to the global prefix, which on a system-wide nodejs
  install is root-owned. If it fails with ``EACCES``, point npm somewhere you
  own with ``npm config set prefix ~/.npm-global``.

Within this repository the library is imported by its real path::

    require('tutorweb-quizlib/src/answerchain.js')

rather than the shorter ``tutorweb-quizlib/answerchain`` the package also
offers. Browserify 15 predates the ``exports`` field and ignores it, so the
short form resolves under node but not in the bundle; everything here is
either bundled or shares a file with something that is.

Running in a browser
--------------------

To run locally, do:

* ``make webserver`` to start a webserver (this also fetches MathJax, if
  you don't have it yet)
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
