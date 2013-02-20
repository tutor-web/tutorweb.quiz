from AccessControl import getSecurityManager

from zope.component import getUtility
from zope.interface import implements
from zope.publisher.interfaces import IPublishTraverse, NotFound

from Products.Five import BrowserView

from tutorweb.quiz.quiz import Quiz


class DoQuizView(BrowserView):
    def __call__(self):
        return "TODO"


class GetAllocationView(BrowserView):
    def __call__(self):
        """
        Ensure user has at least n items allocated to them, say what they are.
        """
        count = self.request.get("count", 1);
        if count > 40:
            return ValueError("Cannot fetch more than 40");
        quiz = Quiz(
            '/'.join(self.context.getPhysicalPath()),
            getSecurityManager().getUser().getUserName(),
        )

        self.request.response.setHeader("Content-type", "application/json")
        return json.dumps(dict(
            questions=quiz.getAllocation(count),
        ))


class GetQuestionView(BrowserView):
    implements(IPublishTraverse)
    
    def __init__(self, context, request):
        super(BrowserView, self).__init__(context, request)
        self.path_info = []

    def publishTraverse(self, request, e):
        """
        Traverse through /quiz-get-question/(uid)
        """
        self.path_info.append(e)
        return self

    def __call__(self):
        """
        Get a question, turn it into JSON.
        """
        if len(self.path_info) < 1:
            raise NotFound(self, "No UID", request)
        uid = self.path_info[0]

        quiz = Quiz(
            '/'.join(self.context.getPhysicalPath()),
            getSecurityManager().getUser().getUserName(),
        )
        qn = quiz.getQuestionObject(uid)
        if qn is None:
            raise NotFound(self, uid, self.request)

        self.request.response.setHeader("Content-type", "application/json")
        return json.dumps(dict(
            questiondata=qn.getQuestionData(),
        ), sort_keys=True, indent=4) #TODO: Probably don't want this in real life


class UpdateScoresView(BrowserView):
    def __call__(self):
        return "TODO"
