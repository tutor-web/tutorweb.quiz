# -*- coding: utf-8 -*-
"""JWT bearer-token auth for the Cordova app, which runs cross-domain from
this Plone site and can't rely on the __ac session cookie.
"""
import json
import os
import time
import uuid

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
# Keep well below TOKEN_TTL: it's what bounds how long a leaked key stays
# live before login traffic itself rotates it out.
ROTATION_INTERVAL = 60 * 60 * 24 * 7  # 7 days


class JWTAuthPlugin(BasePlugin):
    """Extracts/authenticates an `Authorization: Bearer <token>` header.

    self._secrets contains a set {secret, created} pairs keyed by a UUID ID,
    an active secret for new signings and older secrets for previously signed
    but still active tokens.

    Old entries are removed as their created timestamp becomes older than TOKEN_TTL.
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
        # secret_id -> {'secret': bytes, 'created': timestamp}. An OOBTree (rather
        # than a plain dict) avoids the whole mapping conflicting in the
        # ZODB if two rotations somehow raced.
        self._secrets = OOBTree()
        self._current_secret_id = None
        self.rotate_secret()
        # login -> timestamp of their last credentials change. A token
        # issued before its login's entry here is treated as revoked.
        # An OOBTree (rather than a plain dict) avoids the whole mapping
        # conflicting in the ZODB every time two users change passwords
        # concurrently.
        self._revoked_after = OOBTree()
        # jti -> that token's own exp, for revoking one specific token
        # (logout) without invalidating a login's other outstanding
        # tokens/devices the way _revoked_after does. Keyed by the token's
        # own expiry rather than revocation time, so pruning (below) can
        # just drop anything that would've expired on its own by now.
        self._revoked_jti = OOBTree()

    security.declarePrivate('rotate_secret')
    def rotate_secret(self):
        """Start signing with a brand-new secret, keeping old ones around
        just long enough for tokens they signed to still pass their own
        `exp` check - once a key is older than TOKEN_TTL, nothing it could
        have signed is still valid, so it's safe to drop.
        """
        now = time.time()
        secret_id = uuid.uuid4().hex
        self._secrets[secret_id] = {'secret': os.urandom(32), 'created': now}
        self._current_secret_id = secret_id

        stale = [k for k, v in self._secrets.items() if v['created'] < now - TOKEN_TTL]
        for k in stale:
            del self._secrets[k]

    security.declarePrivate('_rotate_if_stale')
    def _rotate_if_stale(self):
        """Called from mint_token so key hygiene rides along with ordinary
        login traffic instead of needing a separate scheduled task."""
        # NB: self._current_secret_id might not be set yet,
        current = self._secrets.get(self._current_secret_id)
        if current is None or current['created'] < time.time() - ROTATION_INTERVAL:
            self.rotate_secret()

    security.declarePrivate('decode_token')
    def decode_token(self, token):
        """Verify and decode a bearer token against whichever of our keys
        signed it, identified by the token's own `secret_id` header. Raises
        jwt.InvalidTokenError (as jwt.decode itself does) if the token is
        malformed/expired, or if its secret_id names a key we've since pruned.
        """
        secret_id = jwt.get_unverified_header(token).get('secret_id')
        key = self._secrets.get(secret_id)
        if key is None:
            raise jwt.InvalidTokenError('Unknown or retired secret id: %r' % (secret_id,))
        return jwt.decode(token, key['secret'], algorithms=[ALGORITHM])

    security.declarePrivate('extractCredentials')
    def extractCredentials(self, request):
        # NB: ZPublisher.HTTPRequest pulls HTTP_AUTHORIZATION out of request and into request._auth
        auth = request._auth or ''
        if not auth.startswith('Bearer '):
            return {}
        token = auth[len('Bearer '):].strip()
        try:
            claims = self.decode_token(token)
        except jwt.InvalidTokenError:
            return {}

        revoked_after = self._revoked_after.get(claims.get('login'))
        if revoked_after and claims.get('iat', 0) < revoked_after:
            return {}

        if claims.get('jti') in self._revoked_jti:
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
        self._rotate_if_stale()

        # Sub-second precision matters here: a login immediately followed
        # (or preceded) by a revocation must not tie at whole-second
        # resolution, or one of the two loses the race.
        now = time.time()
        payload = {
            'sub': user_id,
            'login': login,
            'iat': now,
            'exp': now + TOKEN_TTL,
            # Unique per token (not per login), so a single device can be
            # logged out - see revoke_token - without touching the login's
            # other outstanding tokens.
            'jti': uuid.uuid4().hex,
        }
        token = jwt.encode(
            payload,
            self._secrets[self._current_secret_id]['secret'],
            algorithm=ALGORITHM,
            headers={'secret_id': self._current_secret_id},
        )
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

    security.declarePrivate('revoke_token')
    def revoke_token(self, jti, exp):
        """Invalidate a single outstanding token (logout) by its jti,
        without affecting the same login's other tokens/devices."""
        self._revoked_jti[jti] = exp

        # Prune entries whose token would have expired on its own by now -
        # they can't authenticate either way, so there's no need to keep
        # blacklisting them.
        now = time.time()
        stale = [k for k, v in self._revoked_jti.items() if v < now]
        for k in stale:
            del self._revoked_jti[k]


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


class JWTLogoutView(BrowserView):
    """POST with `Authorization: Bearer <token>` -> revoke that one token.

    Unlike a password change (which invalidates every outstanding token for
    the login, all devices included), this only logs out whichever token
    was presented, leaving the same login's other devices/sessions alone.
    Decoding the token ourselves (rather than relying on it having already
    been authenticated via PAS) is what gets us the jti/exp to revoke - PAS
    only hands the view an authenticated user, not the token's own claims.
    """

    def __call__(self):
        request = self.request
        response = request.response
        response.setHeader('Content-Type', 'application/json')

        if request.method != 'POST':
            response.setStatus(405)
            return json.dumps({'error': 'POST required'})

        auth = request._auth or ''
        if not auth.startswith('Bearer '):
            response.setStatus(400)
            return json.dumps({'error': 'No bearer token supplied'})
        token = auth[len('Bearer '):].strip()

        plugin = self.context.acl_users._getOb('jwt_auth')
        try:
            claims = plugin.decode_token(token)
        except jwt.InvalidTokenError:
            # Already unusable (expired/malformed/wrong secret) either way -
            # the caller's goal, that this token no longer works, already
            # holds, so there's nothing to do.
            return json.dumps({'ok': True})

        if claims.get('jti'):
            plugin.revoke_token(claims['jti'], claims['exp'])
        return json.dumps({'ok': True})
