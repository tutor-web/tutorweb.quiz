from StringIO import StringIO
from lxml import etree
import json

from AccessControl import getSecurityManager

from zope.app.component.hooks import getSite
from zope.component import getUtility
from zope.interface import implements
from zope.publisher.interfaces import IPublishTraverse, NotFound

from Products.Five import BrowserView

from plone.subrequest import subrequest

from tutorweb.quiz.quiz import Quiz


class GetAllocationView(BrowserView):
    def __call__(self):
        """
        Ensure user has at least n items allocated to them, say what they are.
        """
        out = {}
        quiz = Quiz(
            '/'.join(self.context.getPhysicalPath()),
            getSecurityManager().getUser().getUserName(),
        )

        # Write-back answers if there's anythong to write back
        answers = json.loads(self.request.get("answers", "[]"))
        out['answers_stored'] = quiz.storeAnswers(answers)

        # Fetch questions
        count = int(self.request.get("count", 1));
        if count > 40:
            return ValueError("Cannot fetch more than 40");
        out['questions'] = quiz.getAllocation(count)

        self.request.response.setHeader("Content-type", "application/json")
        return json.dumps(out)


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
        qnLocation = quiz.getQuestionLocation(uid)
        if qnLocation is None:
            raise NotFound(self, uid, self.request)

        #TODO: Is this wise?
        out = self._questionDict(getSite().__parent__.unrestrictedTraverse(qnLocation), uid)
        self.request.response.setHeader("Content-type", "application/json")
        return json.dumps(out)

    @staticmethod
    def _questionDict(qn, uid):
        """
        Render question as a dict.
        """
        def _inlineImages(qn, xmlString):
            parser = etree.HTMLParser()
            xml = etree.parse(StringIO("<div>" + xmlString + "</div>"), parser)
            for n in xml.xpath('//img'):
                imgData = None
                if n.get('src').startswith('/'):
                    imgData = subrequest(n.get('src')).getBody()
                else:
                    import urllib2
                    response = urllib2.urlopen(n.get('src'))
                    imgData = response.read()
                if imgData:
                    n.set('src',"data:image/png;base64," + imgData.encode("base64").replace("\n", ""))
            return etree.tostring(xml.xpath('/html/body')[0])

        #TODO: Shift this to a question view (so multiple question types can implement)
        #TODO: Obsfucate answer
        #TODO: Download any requested images, inline 'em
        # Answers: See InvisibleQuestion.makeNewTest()
        # grid = qn.getWrappedField('AnswerList')
        # rowrandom = [a['answerid'] for a in grid.search(self, randomize='1')]
        # rownotrandom = [a['answerid'] for a in grid.search(self, randomize='')]
        # qn.isRandomOrder() randomise rowrandom.
        # Answerids = rowrandom + rownotrandom
        # See: Products/TutorWeb/QuizResult.py
        # rowcorrect = grid.search(newq, correct='1')
        # answerHtmlDict = qn.getAnswerDisplay()
        # Populated by initializeObject() => qn.setQuestionAndAnswer() => qn.transformQuizQuestion()
        grid = qn.getWrappedField('AnswerList')

        questionDict=dict(
            text=_inlineImages(qn, qn.getQuestionData()),
            choices=dict((k, _inlineImages(qn, v)) for (k, v) in qn.getAnswerDisplay().items())
        )
        if qn.isRandomOrder():
            questionDict['random_order'] = [int(a['answerid']) for a in grid.search(qn, randomize='1')]
            questionDict['fixed_order'] = [int(a['answerid']) for a in grid.search(qn, randomize='')]
        else:
            questionDict['random_order'] = []
            questionDict['fixed_order'] = [int(a['answerid']) for a in grid.search(qn)]

        answerDict=dict(
            correct=[int(a['answerid']) for a in grid.search(qn, correct='1')],
            explanation=_inlineImages(qn, qn.getQuestionExplanationData()),
        )

        return dict(uid=uid, question=questionDict, answer=answerDict)
