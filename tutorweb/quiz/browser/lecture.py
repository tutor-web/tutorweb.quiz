import base64
from StringIO import StringIO
from lxml import etree
import json

from AccessControl import getSecurityManager

try:
    from zope.component.hooks import getSite
except ImportError:
    from zope.app.component.hooks import getSite
from zope.publisher.interfaces import NotFound

from Products.CMFCore.utils import getToolByName
from Products.Five import BrowserView

from plone.subrequest import subrequest

from tutorweb.quiz.quiz import Quiz


class JSONBrowserView(BrowserView):
    def getContent(self, quiz):
        raise NotImplementedError("Abstract method")

    def __call__(self):
        """
        Create Quiz model, format results / exception as JSON
        """
        try:
            quiz = Quiz(
                '/'.join(self.context.getPhysicalPath()),
                getSecurityManager().getUser(),
            )
            out = self.getContent(quiz)
            self.request.response.setStatus(200)
            self.request.response.setHeader("Content-type", "application/json")
            return json.dumps(out)
        except Exception, ex:
            self.request.response.setStatus(500)
            self.request.response.setHeader("Content-type", "application/json")
            return json.dumps(dict(
                error= ex.__class__.__name__,
                message= str(ex),
            ))


class GetAllocationView(JSONBrowserView):
    def getContent(self, quiz):
        """
        Ensure user has at least n items allocated to them, say what they are.
        """
        def getQuestions(path):
            catalog = getToolByName(self.context, 'portal_catalog')
            return catalog.unrestrictedSearchResults(
                {'portal_type' : 'TutorWebQuestion'},
                path= path,
            )

        out = {}

        # Write-back answers if there's anythong to write back
        answers = json.loads(self.request.get("answers", "[]"))
        out['answers_stored'] = quiz.storeAnswers(answers)

        # Fetch questions
        count = int(self.request.get("count", 1));
        if count > 40:
            return ValueError("Cannot fetch more than 40");
        out['questions'] = quiz.getAllocation(count, getQuestions)

        return out


class GetQuestionView(JSONBrowserView):
    def getContent(self, quiz):
        """
        Get a question, turn it into JSON.
        """
        uid = self.request.get("uid", None);
        if uid is None:
            raise NotFound(self, "No UID supplied", self.request)

        quiz = Quiz(
            '/'.join(self.context.getPhysicalPath()),
            getSecurityManager().getUser()
        )
        catalog = getToolByName(self.context, 'portal_catalog')
        results = catalog.unrestrictedSearchResults(dict(
            portal_type='TutorWebQuestion',
            UID=uid,
        ))
        if len(results) < 1:
            raise NotFound(self, uid, self.request)
        return self._questionDict(results[0].getObject())

    @staticmethod
    def _questionDict(qn):
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
            return etree.tostring(xml.xpath('/html/body/div')[0])

        #TODO: Shift this to a question view (so multiple question types can implement)
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
        answerString = base64.b64encode(json.dumps(answerDict))

        return dict(uid=qn.UID(), question=questionDict, answer=answerString)
