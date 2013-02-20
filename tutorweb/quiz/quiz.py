from zope.app.component.hooks import getSite

from Products.TutorWeb.interfaces import IQuestionLocator


class Quiz(object):
    """
    Object that encapsulates a quiz a student is taking
    """
    def __init__(self, username, lecture):
        self.username = username
        self.lecture = lecture

    def getAllocation(self, count):
        """
        Allocate (count) question, return some URIs
        """
        pass

    def getQuestionObject(self, uid):
        """
        Return question object associated with UID
        """
        questlocator = getUtility(IQuestionLocator)
        questioninfo = questlocator.question_by_uid(uid)
        if questioninfo is None:
            raise NotFound(self, uid, self.request)

        #TODO: This isn't what we want, should be
        # * fetching via. quiz_id
        # * WHERE answer_time IS NULL
        # * joining with student_information.student_username.
        # So student can only get question that 
        qn = getSite().__parent__.unrestrictedTraverse(
            str(questioninfo.question_location))
        return qn
