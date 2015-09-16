from email.utils import formatdate
import time

from zope.globalrequest import getRequest


def setCacheControl(response, secs=86400):
    def expireTime(s):
        return formatdate(time.time() + s)

    url = getRequest().getURL()
    if '++resource++tutorweb.quiz' in url and 'tw.appcache' in url:
        # Always check appcache
        response.setHeader('Cache-Control', 'no-cache')
        response.setHeader('Expires', expireTime(10))
    elif '++resource++tutorweb.quiz' in url and 'mathjax/' not in url:
        # Don't cache javascript for very long, assume appcache will take this load
        response.setHeader('Cache-Control', 'no-cache')
        response.setHeader('Expires', expireTime(10))
    else:
        # Fall back to original handler
        from zope.browserresource.file import _old_setCacheControl
        _old_setCacheControl(response, secs)
