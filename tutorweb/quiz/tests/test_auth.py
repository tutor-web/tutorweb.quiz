import json
import time
import unittest

from ..auth import JWTAuthPlugin
from ..auth import JWTLoginView
from ..auth import _authenticate


class FakePluginRegistry(object):
    def __init__(self, plugins):
        self._plugins = plugins  # [(id, plugin), ...]

    def listPlugins(self, iface):
        return self._plugins


class FakeAclUsers(object):
    """Stands in for acl_users: a plugin registry plus by-id lookup."""

    def __init__(self, plugins_by_id):
        self._plugins_by_id = plugins_by_id
        self.plugins = FakePluginRegistry(list(plugins_by_id.items()))

    def _getOb(self, id):
        return self._plugins_by_id[id]


class FakeUserManager(object):
    """Stands in for a stock ZODBUserManager-style IAuthenticationPlugin."""

    def __init__(self, users):
        self._users = users  # {login: (user_id, password)}

    def authenticateCredentials(self, credentials):
        entry = self._users.get(credentials.get('login'))
        if entry and entry[1] == credentials.get('password'):
            return (entry[0], credentials.get('login'))
        return None


class FakeResponse(object):
    def __init__(self):
        self.status = None
        self.headers = {}

    def setStatus(self, code):
        self.status = code

    def setHeader(self, name, value):
        self.headers[name] = value


class FakeRequest(object):
    def __init__(self, method, body):
        self.method = method
        self._body = body
        self.response = FakeResponse()

    def get(self, key, default=None):
        if key == 'BODY':
            return self._body
        return default


class FakeContext(object):
    def __init__(self, acl_users):
        self.acl_users = acl_users


class FakeAuthRequest(object):
    """Stands in for the parts of ZPublisher.HTTPRequest extractCredentials
    relies on - _auth is where Zope puts the Authorization header, not
    request.get('HTTP_AUTHORIZATION'). None (Zope's own default) means no
    header was sent."""

    def __init__(self, auth=None):
        self._auth = auth


class JWTAuthPluginTest(unittest.TestCase):
    def setUp(self):
        self.plugin = JWTAuthPlugin('jwt_auth')

    def test_getId_returnsConstructorId(self):
        self.assertEqual(self.plugin.getId(), 'jwt_auth')

    def test_mintedTokenRoundTrips(self):
        token = self.plugin.mint_token('alice-id', 'alice')
        creds = self.plugin.extractCredentials(FakeAuthRequest('Bearer ' + token))
        self.assertEqual(creds, {'extractor': 'jwt_auth', 'user_id': 'alice-id'})

    def test_authenticateCredentials_acceptsOwnExtraction(self):
        creds = {'extractor': 'jwt_auth', 'user_id': 'alice-id'}
        self.assertEqual(self.plugin.authenticateCredentials(creds), ('alice-id', 'alice-id'))

    def test_authenticateCredentials_rejectsOtherPlugins(self):
        creds = {'extractor': 'some_other_plugin', 'user_id': 'alice-id'}
        self.assertIsNone(self.plugin.authenticateCredentials(creds))

    def test_extractCredentials_noHeader(self):
        self.assertEqual(self.plugin.extractCredentials(FakeAuthRequest()), {})

    def test_extractCredentials_malformedToken(self):
        creds = self.plugin.extractCredentials(FakeAuthRequest('Bearer not-a-token'))
        self.assertEqual(creds, {})

    def test_extractCredentials_expiredToken(self):
        # Mint directly with an already-past expiry, bypassing TOKEN_TTL
        import jwt
        token = jwt.encode(
            {'sub': 'alice-id', 'login': 'alice', 'iat': int(time.time()) - 2, 'exp': int(time.time()) - 1},
            self.plugin._secret,
            algorithm='HS256',
        )
        if isinstance(token, bytes):
            token = token.decode('ascii')
        creds = self.plugin.extractCredentials(FakeAuthRequest('Bearer ' + token))
        self.assertEqual(creds, {})

    def test_differentPluginInstances_dontShareSecret(self):
        other = JWTAuthPlugin('jwt_auth')
        token = self.plugin.mint_token('alice-id', 'alice')
        self.assertEqual(other.extractCredentials(FakeAuthRequest('Bearer ' + token)), {})

    def test_revoke_invalidatesExistingToken(self):
        token = self.plugin.mint_token('alice-id', 'alice')
        self.plugin.revoke('alice')
        self.assertEqual(self.plugin.extractCredentials(FakeAuthRequest('Bearer ' + token)), {})

    def test_revoke_doesNotAffectOtherUsers(self):
        token = self.plugin.mint_token('bob-id', 'bob')
        self.plugin.revoke('alice')
        creds = self.plugin.extractCredentials(FakeAuthRequest('Bearer ' + token))
        self.assertEqual(creds, {'extractor': 'jwt_auth', 'user_id': 'bob-id'})

    def test_revoke_thenFreshTokenStillValid(self):
        self.plugin.revoke('alice')
        token = self.plugin.mint_token('alice-id', 'alice')
        creds = self.plugin.extractCredentials(FakeAuthRequest('Bearer ' + token))
        self.assertEqual(creds, {'extractor': 'jwt_auth', 'user_id': 'alice-id'})

    def test_updateCredentials_invalidatesExistingToken(self):
        token = self.plugin.mint_token('alice-id', 'alice')
        self.plugin.updateCredentials(None, None, 'alice', 'new-password')
        self.assertEqual(self.plugin.extractCredentials(FakeAuthRequest('Bearer ' + token)), {})


class AuthenticateTest(unittest.TestCase):
    """_authenticate() replicates PAS's own plugin-iteration loop directly,
    since PluggableAuthService has no public authenticateCredentials() of
    its own to call - see auth.py's docstring for why."""

    def setUp(self):
        self.jwt_plugin = JWTAuthPlugin('jwt_auth')
        self.user_manager = FakeUserManager({'alice': ('alice-id', 'secret')})
        self.acl_users = FakeAclUsers({
            'jwt_auth': self.jwt_plugin,
            'source_users': self.user_manager,
        })

    def test_validLoginPassword_returnsUserIdAndLogin(self):
        result = _authenticate(self.acl_users, {'login': 'alice', 'password': 'secret'})
        self.assertEqual(result, ('alice-id', 'alice'))

    def test_wrongPassword_returnsNone(self):
        result = _authenticate(self.acl_users, {'login': 'alice', 'password': 'wrong'})
        self.assertIsNone(result)

    def test_unknownLogin_returnsNone(self):
        result = _authenticate(self.acl_users, {'login': 'nobody', 'password': 'secret'})
        self.assertIsNone(result)

    def test_ownJwtPlugin_neverMatchesPlainCredentials(self):
        # jwt_auth is itself an active IAuthenticationPlugin (it needs to be,
        # to authenticate bearer tokens) but must never accidentally
        # authenticate a plain login/password pair meant for another plugin.
        acl_users = FakeAclUsers({'jwt_auth': self.jwt_plugin})
        result = _authenticate(acl_users, {'login': 'alice', 'password': 'secret'})
        self.assertIsNone(result)

    def test_unicodeCredentials_passedToPluginsAsStr(self):
        # json.loads() always hands back unicode on Python 2, but PAS's
        # stock plugins (password hashing in particular) require str.
        received = {}

        class RecordingPlugin(object):
            def authenticateCredentials(self, credentials):
                received.update(credentials)
                return None

        acl_users = FakeAclUsers({'recorder': RecordingPlugin()})
        _authenticate(acl_users, {'login': u'alice', 'password': u'secret'})
        self.assertEqual(received, {'login': 'alice', 'password': 'secret'})
        self.assertIsInstance(received['login'], str)
        self.assertIsInstance(received['password'], str)


class JWTLoginViewTest(unittest.TestCase):
    def setUp(self):
        self.jwt_plugin = JWTAuthPlugin('jwt_auth')
        self.user_manager = FakeUserManager({'alice': ('alice-id', 'secret')})
        self.acl_users = FakeAclUsers({
            'jwt_auth': self.jwt_plugin,
            'source_users': self.user_manager,
        })

    def _call(self, method, body):
        request = FakeRequest(method, body)
        view = JWTLoginView(FakeContext(self.acl_users), request)
        return request.response, view()

    def test_validCredentials_returnsToken(self):
        response, result = self._call('POST', json.dumps({'login': 'alice', 'password': 'secret'}))
        self.assertIsNone(response.status)
        token = json.loads(result)['token']
        creds = self.jwt_plugin.extractCredentials(FakeAuthRequest('Bearer ' + token))
        self.assertEqual(creds, {'extractor': 'jwt_auth', 'user_id': 'alice-id'})

    def test_invalidCredentials_returns401(self):
        response, result = self._call('POST', json.dumps({'login': 'alice', 'password': 'wrong'}))
        self.assertEqual(response.status, 401)

    def test_nonPost_returns405(self):
        response, result = self._call('GET', '')
        self.assertEqual(response.status, 405)

    def test_malformedJson_returns400(self):
        response, result = self._call('POST', 'not json')
        self.assertEqual(response.status, 400)
