# -*- coding: utf-8 -*-
"""Monkey-patches wired up via <monkey:patch> in configure.zcml."""
from Products.PluggableAuthService.plugins.ZODBUserManager import ZODBUserManager


def removeUser(self, user_id):
    # Revoke any outstanding JWT bearer tokens for this account before it's
    # deleted - otherwise they'd keep authenticating until they naturally
    # expire. There's no Plone/PAS event fired on user deletion to hook
    # into instead (PrincipalDeleted is defined in
    # Products.PluggableAuthService.events but never notify()'d by core
    # code), so patching the plugin that actually does the deleting is the
    # only reliable way to catch it.
    #
    # ZODBUserManager doesn't support login names that differ from the
    # user id, so user_id here is exactly the string JWTAuthPlugin.revoke()
    # expects.
    acl_users = self.aq_parent
    jwt_auth = acl_users._getOb('jwt_auth', None)
    if jwt_auth is not None:
        jwt_auth.revoke(user_id)

    return ZODBUserManager._old_removeUser(self, user_id)
