from tutorweb.quiz.tests import layer
from plone.app.testing import TEST_USER_NAME
from plone.app.testing import TEST_USER_PASSWORD
from plone.testing import z2
import unittest


class Browser(z2.Browser):
    def view(self):  # pragma: no cover
        """ Convenience function to open html in the default browser.
            Can be used while writing tests:
            browser.send() """
        import webbrowser
        import tempfile
        import time
        with tempfile.NamedTemporaryFile(suffix='.html') as f:
            f.write(self.contents)
            f.flush()
            webbrowser.open("file://%s" % f.name)
            # give the os a chance to open the file before it's removed
            time.sleep(1)


def get_browser(app, loggedIn=True):
    browser = Browser(app)
    if loggedIn:
        auth = 'Basic %s:%s' % (TEST_USER_NAME, TEST_USER_PASSWORD)
        browser.addHeader('Authorization', auth)
    return browser


class TWQuizTestCase(unittest.TestCase):

    layer = layer.TW_INTEGRATION


class TWQuizFunctionalTestCase(TWQuizTestCase):

    layer = layer.TW_FUNCTIONAL
