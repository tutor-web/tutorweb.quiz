from email.utils import formatdate
import time

from zope.globalrequest import getRequest


def setCacheControl(response, secs=86400):
    def expireTime(mins):
        return formatdate(time.time() + (60 * mins))

    url = getRequest().getURL()
    if 'tw.appcache' in url:
        # Always check appcache
        response.setHeader('Cache-Control', 'no-cache')
        response.setHeader('Expires', expireTime(0.5))
    elif '++resource++tutorweb.quiz' in url and 'mathjax/' not in url:
        # Don't cache javascript for very long, assume appcache will take this load
        response.setHeader('Cache-Control', 'private')
        response.setHeader('Expires', expireTime(1))
    else:
        # Fall back to original handler
        from zope.browserresource.file import _old_setCacheControl
        _old_setCacheControl(response, secs)
