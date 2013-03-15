import base64
import json

from plone.app.testing import TEST_USER_NAME, login, logout

from tutorweb.quiz.tests.base import TWQuizTestCase


class TestBrowserLecture(TWQuizTestCase):

    def test_GetAllocationView(self):
        portal = self.layer['portal']
        request = self.layer['request']

        # Cannot get an allocation if logged out
        logout()
        resp = json.loads(portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-allocation')())
        self.assertEqual(request.response.status, 500)
        self.assertEqual(resp['error'], 'Unauthorized')
        self.assertTrue('signed in' in resp['message'])
        login(portal, TEST_USER_NAME)

        # Get single question
        alloc = json.loads(portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-allocation')())
        self.assertEqual(request.response.status, 200)
        self.assertEqual(alloc['answers_stored'], 0)
        self.assertEqual(len(alloc['questions']), 1)

        # Get one more
        request['count'] = 2
        alloc = json.loads(portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-allocation')())
        self.assertEqual(request.response.status, 200)
        self.assertEqual(alloc['answers_stored'], 0)
        self.assertEqual(len(alloc['questions']), 2)

        # Get lots, but limited by number of questions
        request['count'] = 10
        alloc = json.loads(portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-allocation')())
        self.assertEqual(request.response.status, 200)
        self.assertEqual(alloc['answers_stored'], 0)
        self.assertEqual(len(alloc['questions']), 3)

        login(portal, 'quiz_taker1')
        # Get 2 questions
        request['count'] = 2
        alloc = json.loads(portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-allocation')())
        self.assertEqual(request.response.status, 200)
        self.assertEqual(alloc['answers_stored'], 0)
        self.assertEqual(len(alloc['questions']), 2)

    def test_GetQuestion(self):
        portal = self.layer['portal']
        request = self.layer['request']

        # No URI is an exception
        resp = json.loads(portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-question')())
        self.assertEqual(resp['error'], 'NotFound')
        self.assertTrue('UID' in resp['message'])

        # Cannot get question not allocated
        request['uid'] = 'ABC05'
        resp = json.loads(portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-question')())
        self.assertEqual(resp['error'], 'NotFound')
        self.assertTrue('ABC05' in resp['message'])

        # Will get the same question on repeated calls
        alloc = json.loads(portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-allocation')())
        alloc2 = json.loads(portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-allocation')())
        self.assertEqual(alloc['questions'][0], alloc2['questions'][0])

        # We can fetch the question now
        request['uid'] = alloc['questions'][0]['question_uid']
        qn = json.loads(portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-question')())
        self.assertEqual(qn['uid'], request['uid'])
        self.assertTrue('This is qn' in qn['question']['text'])
        self.assertTrue('<body>' not in qn['question']['text'])
        self.assertTrue(qn['question']['text'].startswith('<div>'))
        # We can decode the answer
        ans = json.loads(base64.b64decode(qn['answer']))
        self.assertTrue('explanation' in ans)
        self.assertTrue('correct' in ans)

        choices = qn['question']['choices']
        self.assertTrue('answer 1' in choices['0'])
        self.assertTrue('answer 2' in choices['1'])
        self.assertTrue('answer 3' in choices['2'])
        for k in choices.keys():
            self.assertTrue(int(k) in ans['correct'] if 'CORRECT' in choices[k] else int(k) not in ans['correct'])

        # Answer it and you get a different question
        request['answers'] = json.dumps([
            dict(
                allocation_id=alloc['questions'][0]['allocation_id'],
                question_uid=alloc['questions'][0]['question_uid'],
                student_answer = 2,
                quiz_time=1363184746 - 5,
                answer_time=1363184746,
            ),
        ])
        alloc2 = json.loads(portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-allocation')())
        self.assertEqual(alloc2['answers_stored'], 1)
