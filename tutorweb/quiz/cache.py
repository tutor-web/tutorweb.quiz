from email.utils import formatdate
import time

from zope.globalrequest import getRequest


def setCacheControl(response, secs=86400):
    url = getRequest().getURL()
    if '++resource++tutorweb.quiz' in url and 'mathjax/' not in url:
        # appcache-related stuff shouldn't be assumed to be up-to-date
        response.setHeader('Cache-Control', 'no-cache')
        t = time.time() + (60 * 10)
        response.setHeader('Expires', formatdate(t, usegmt=True))
    else:
        # Fall back to original handler
        from zope.browserresource.file import _old_setCacheControl
        _old_setCacheControl(response, secs)
