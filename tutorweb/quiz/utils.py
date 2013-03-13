from zope.component import getUtility

from collective.lead.interfaces import IDatabase

def getDatabase():
    """
    Fetch database from the registry. Ideally this should be in a 
    tutorweb.storage
    """
    return getUtility(IDatabase, name='tutorweb.quizquestioninformation')
