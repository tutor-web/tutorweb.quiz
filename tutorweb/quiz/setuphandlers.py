# -*- coding: utf-8 -*-
from Products.PluggableAuthService.interfaces.plugins import IAuthenticationPlugin
from Products.PluggableAuthService.interfaces.plugins import ICredentialsUpdatePlugin
from Products.PluggableAuthService.interfaces.plugins import IExtractionPlugin

from .auth import JWTAuthPlugin

PLUGIN_ID = 'jwt_auth'


def setupVarious(context):
    if context.readDataFile('tutorweb.quiz_various.txt') is None:
        return

    acl_users = context.getSite().acl_users
    if PLUGIN_ID in acl_users.objectIds():
        # Already installed - don't recreate it, that would regenerate the
        # secret and invalidate every outstanding token.
        return

    acl_users._setObject(PLUGIN_ID, JWTAuthPlugin(PLUGIN_ID, title='JWT bearer-token auth'))
    plugin = acl_users._getOb(PLUGIN_ID)
    acl_users.plugins.activatePlugin(IExtractionPlugin, plugin.getId())
    acl_users.plugins.activatePlugin(IAuthenticationPlugin, plugin.getId())
    # Lets us hear about password changes, so we can revoke outstanding tokens
    acl_users.plugins.activatePlugin(ICredentialsUpdatePlugin, plugin.getId())
