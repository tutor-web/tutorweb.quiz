# -*- coding: utf-8 -*-
"""JWT bearer-token auth for the Cordova app, which runs cross-domain from
this Plone site and can't rely on the __ac session cookie.
"""
import json
import os
import time

import jwt
from AccessControl import ClassSecurityInfo
from BTrees.OOBTree import OOBTree
from Products.Five.browser import BrowserView
from Products.PluggableAuthService.interfaces.plugins import IAuthenticationPlugin
from Products.PluggableAuthService.interfaces.plugins import ICredentialsUpdatePlugin
from Products.PluggableAuthService.interfaces.plugins import IExtractionPlugin
from Products.PluggableAuthService.plugins.BasePlugin import BasePlugin
from zope.interface import classImplements

ALGORITHM = 'HS256'
TOKEN_TTL = 60 * 60 * 24 * 14  # 14 days


class JWTAuthPlugin(BasePlugin):
    """Extracts/authenticates an `Authorization: Bearer <token>` header.

    The secret is generated once and persisted on this (ZODB-stored) plugin
    instance, so re-running the install step must never recreate it - doing
    so would invalidate every outstanding token.
    """

    security = ClassSecurityInfo()
    meta_type = 'JWT Auth Plugin'

    def __init__(self, id, title=None):
        BasePlugin.__init__(self, id, title)
        # BasePlugin.__init__ sets this via self._setId(id) too, but that
        # goes through OFS machinery that not every test double for
        # BasePlugin reproduces - set it directly so getId() is reliable
        # regardless of what BasePlugin actually does with it.
        self.id = id
        self._secret = os.urandom(32)
        # login -> timestamp of their last credentials change. A token
        # issued before its login's entry here is treated as revoked.
        # An OOBTree (rather than a plain dict) avoids the whole mapping
        # conflicting in the ZODB every time two users change passwords
        # concurrently.
        self._revoked_after = OOBTree()

    security.declarePrivate('extractCredentials')
    def extractCredentials(self, request):
        # NB: ZPublisher.HTTPRequest pulls HTTP_AUTHORIZATION out of request and into request._auth
        auth = request._auth or ''
        if not auth.startswith('Bearer '):
            return {}
        token = auth[len('Bearer '):].strip()
        try:
            claims = jwt.decode(token, self._secret, algorithms=[ALGORITHM])
        except jwt.InvalidTokenError:
            return {}

        revoked_after = self._revoked_after.get(claims.get('login'))
        if revoked_after and claims.get('iat', 0) < revoked_after:
            return {}

        return {'extractor': self.getId(), 'user_id': claims['sub']}

    security.declarePrivate('authenticateCredentials')
    def authenticateCredentials(self, credentials):
        # Only trust credentials our own extractCredentials produced - PAS
        # merges every active extractor's dict together, so an untagged
        # result here could be mistaken for a different plugin's.
        if credentials.get('extractor') != self.getId():
            return None
        user_id = credentials.get('user_id')
        if not user_id:
            return None
        return (user_id, user_id)

    security.declarePrivate('mint_token')
    def mint_token(self, user_id, login):
        # Sub-second precision matters here: a login immediately followed
        # (or preceded) by a revocation must not tie at whole-second
        # resolution, or one of the two loses the race.
        now = time.time()
        payload = {'sub': user_id, 'login': login, 'iat': now, 'exp': now + TOKEN_TTL}
        token = jwt.encode(payload, self._secret, algorithm=ALGORITHM)
        if isinstance(token, bytes):
            token = token.decode('ascii')
        return token

    security.declarePrivate('updateCredentials')
    def updateCredentials(self, request, response, login, new_password):
        # Called by PAS whenever a user's password changes - invalidate any
        # bearer tokens already issued for them.
        self.revoke(login)

    security.declarePrivate('revoke')
    def revoke(self, login):
        """Invalidate every token already issued for login, e.g. because
        their password changed or their account was disabled."""
        now = time.time()
        self._revoked_after[login] = now

        # Prune entries that can no longer affect a still-valid token -
        # anything they'd revoke has already expired via TOKEN_TTL anyway.
        stale = [k for k, v in self._revoked_after.items() if v < now - TOKEN_TTL]
        for k in stale:
            del self._revoked_after[k]


classImplements(JWTAuthPlugin, IExtractionPlugin, IAuthenticationPlugin, ICredentialsUpdatePlugin)


def _authenticate(acl_users, credentials):
    """Validate login/password directly against whatever IAuthenticationPlugins
    are active, without going through PAS's own request-based credential
    extraction (we already have login/password from the POST body, not a
    request to extract them from). PluggableAuthService itself has no public
    authenticateCredentials() of its own to delegate to - this mirrors what
    its private _extractUserIds does internally, calling each plugin's own
    authenticateCredentials(credentials) in turn.
    """
    # PAS stock plugins (especially password hashing) require str, not unicode objects
    # encode here, in a similar fashion to plone.restapi
    credentials = dict(
        (k, v.encode('utf8') if isinstance(v, unicode) else v)
        for k, v in credentials.items()
    )
    for _plugin_id, auth in acl_users.plugins.listPlugins(IAuthenticationPlugin):
        result = auth.authenticateCredentials(credentials)
        if result is not None and result[0] is not None:
            return result
    return None


class JWTLoginView(BrowserView):
    """POST {"login": ..., "password": ...} -> {"token": "..."}.

    Delegates the actual password check to whatever authentication plugins
    are already active (see _authenticate above) rather than duplicating
    that logic, and never sets a cookie.
    """

    def __call__(self):
        request = self.request
        response = request.response
        response.setHeader('Content-Type', 'application/json')

        if request.method != 'POST':
            response.setStatus(405)
            return json.dumps({'error': 'POST required'})

        try:
            body = json.loads(request.get('BODY', '') or '{}')
        except ValueError:
            response.setStatus(400)
            return json.dumps({'error': 'Invalid JSON body'})

        acl_users = self.context.acl_users
        result = _authenticate(acl_users, {
            'login': body.get('login'),
            'password': body.get('password'),
        })
        if result is None:
            response.setStatus(401)
            return json.dumps({'error': 'Invalid credentials'})

        user_id, login = result
        plugin = acl_users._getOb('jwt_auth')
        return json.dumps({'token': plugin.mint_token(user_id, login)})
