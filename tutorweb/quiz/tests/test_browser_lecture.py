import json

from tutorweb.quiz.tests.base import TWQuizTestCase


class TestBrowserLecture(TWQuizTestCase):

    def test_GetAllocationView(self):
        portal = self.layer['portal']

        # Get single question
        alloc = json.loads(portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-allocation')())
        self.assertEqual(alloc['answers_stored'], 0)
        self.assertEqual(len(alloc['questions']), 1)
        #TODO:

    def test_GetQuestion(self):
        portal = self.layer['portal']
        request = self.layer['request']

        # No URI is an exception
        from zope.publisher.interfaces import NotFound
        with self.assertRaisesRegexp(NotFound, 'UID'):
            portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-question')()

        # Cannot get question not allocated
        with self.assertRaisesRegexp(NotFound, 'ABC05'):
            request['uid'] = 'ABC05'
            portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-question')()

        # Will get the same question on repeated calls
        alloc = json.loads(portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-allocation')())
        alloc2 = json.loads(portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-allocation')())
        self.assertEqual(alloc['questions'][0], alloc2['questions'][0])

        # We can fetch the question now
        request['uid'] = alloc['questions'][0]['question_uid']
        qn = json.loads(portal.restrictedTraverse('test-department/test-tutorial/test-lecture1/quiz-get-question')())
        self.assertEqual(qn['uid'], request['uid'])

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
        self.assertTrue(alloc['questions'][0]['question_uid'] != alloc2['questions'][0]['question_uid'])
