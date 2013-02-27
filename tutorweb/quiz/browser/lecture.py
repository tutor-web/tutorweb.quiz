import json

from AccessControl import getSecurityManager

from zope.app.component.hooks import getSite
from zope.component import getUtility
from zope.interface import implements
from zope.publisher.interfaces import IPublishTraverse, NotFound

from Products.Five import BrowserView

from tutorweb.quiz.quiz import Quiz


class GetAllocationView(BrowserView):
    def __call__(self):
        """
        Ensure user has at least n items allocated to them, say what they are.
        """
        count = int(self.request.get("count", 1));
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
        qnLocation = quiz.getQuestionLocation(uid)
        if qnLocation is None:
            raise NotFound(self, uid, self.request)

        #TODO: Is this wise?
        out = self._questionDict(getSite().__parent__.unrestrictedTraverse(qnLocation))
        self.request.response.setHeader("Content-type", "application/json")
        return json.dumps(out)

    @staticmethod
    def _questionDict(qn):
        """
        Render question as a dict.
        """
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
            text=qn.getQuestionData(),
            choices=dict(qn.getAnswerDisplay().items())
        )
        if qn.isRandomOrder():
            questionDict['random_order'] = [int(a['answerid']) for a in grid.search(qn, randomize='1')]
            questionDict['fixed_order'] = [int(a['answerid']) for a in grid.search(qn, randomize='')]
        else:
            questionDict['random_order'] = []
            questionDict['fixed_order'] = [int(a['answerid']) for a in grid.search(qn)]

        answerDict=dict(
            correct=[int(a['answerid']) for a in grid.search(qn, correct='1')],
            explanation=qn.getQuestionExplanationData(),
        )

        return dict(question=questionDict, answer=answerDict)


class UpdateScoresView(BrowserView):
    def __call__(self):
        answers = [dict( #TODO: Expect a JSON structure lie this
            allocation_id=1,
            question_id=2,
            student_answer=-2,
            quiz_time=datetime.now - 5,
            answer_time=datetime.now,
        )]

        quiz = Quiz(
            '/'.join(self.context.getPhysicalPath()),
            getSecurityManager().getUser().getUserName(),
        )
        quiz.setAnswers(answers)

        #TODO: Return another allocation instead?
        self.request.response.setHeader("Content-type", "application/json")
        return json.dumps(dict(success=True))
