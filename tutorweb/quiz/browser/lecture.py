import json

from AccessControl import getSecurityManager

from zope.app.component.hooks import getSite
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
        qn = getSite().__parent__.unrestrictedTraverse(qnLocation)

        self.request.response.setHeader("Content-type", "application/json")
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
        if qn.isRandomOrder():
            random_order = [a['answerid'] for a in grid.search(qn, randomize='1')]
            fixed_order = [a['answerid'] for a in grid.search(qn, randomize='')]
        else:
            random_order = []
            fixed_order = [a['answerid'] for a in grid.search(qn, randomize='')]
            fixed_order =  [a['answerid'] for a in grid.search(qn, randomize='1')]
        return json.dumps(dict(
            question=qn.getQuestionData(),
            inline_answer=qn.inlineAnswer(),
            explination=qn.getQuestionExplanationData(),
            answer=dict(
                html=dict(qn.getAnswerDisplay().items()),
                random_order= random_order,
                fixed_order= fixed_order,
            ),
        ))


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
