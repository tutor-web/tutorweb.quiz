# -*- coding: utf-8 -*-
"""Tests for the removeUser monkey-patch in ../patches.py - see auth.py's
own tests for the token-revocation logic this delegates to.
"""
import unittest

from .. import patches


class FakeJWTPlugin(object):
    def __init__(self):
        self.revoked = []

    def revoke(self, login):
        self.revoked.append(login)


class FakeAclUsers(object):
    def __init__(self, plugins_by_id):
        self._plugins_by_id = plugins_by_id

    def _getOb(self, id, default=None):
        return self._plugins_by_id.get(id, default)


class FakeZODBUserManager(object):
    """Stands in for the real ZODBUserManager class that gets patched -
    tests substitute this for patches.ZODBUserManager so they don't need
    the real Products.PluggableAuthService package installed just to
    exercise removeUser()'s own logic.
    """
    removed = []

    @classmethod
    def _old_removeUser(cls, self, user_id):
        cls.removed.append(user_id)


def fakeSelf(jwt_plugin=None):
    acl_users = FakeAclUsers({'jwt_auth': jwt_plugin} if jwt_plugin else {})
    self = type(str('FakeUserManagerInstance'), (object,), {})()
    self.aq_parent = acl_users
    return self


class RemoveUserPatchTest(unittest.TestCase):
    def setUp(self):
        FakeZODBUserManager.removed = []
        self._real_zodb_user_manager = patches.ZODBUserManager
        patches.ZODBUserManager = FakeZODBUserManager

    def tearDown(self):
        patches.ZODBUserManager = self._real_zodb_user_manager

    def test_revokesTokensThenCallsOriginal(self):
        jwt_plugin = FakeJWTPlugin()

        patches.removeUser(fakeSelf(jwt_plugin), 'alice')

        self.assertEqual(jwt_plugin.revoked, ['alice'])
        self.assertEqual(FakeZODBUserManager.removed, ['alice'])

    def test_missingJwtPlugin_stillCallsOriginal(self):
        # e.g. some other site reusing ZODBUserManager without jwt_auth
        # installed - deletion shouldn't break just because there's
        # nothing to revoke.
        patches.removeUser(fakeSelf(jwt_plugin=None), 'alice')

        self.assertEqual(FakeZODBUserManager.removed, ['alice'])
