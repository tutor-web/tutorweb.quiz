import datetime
import logging
import random
import time

from sqlalchemy.exceptions import InvalidRequestError
from sqlalchemy.sql import select, and_

from zope.component import getUtility

from collective.lead.interfaces import IDatabase

from Products.TutorWeb.interfaces import IQuestionLocator
from Products.TutorWeb.db import AllocationInformation, QuestionInformation \
    , QuizInformation, StudentInformation

logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO) #TODO:


class Quiz(object):
    """
    Object that encapsulates a quiz a student is taking
    """
    def __init__(self, lecture, username):
        self.username = username
        self.lectureLoc = lecture

        # Fetch DB connection
        self.db = getUtility(IDatabase, name='tutorweb.quizquestioninformation')

        # Does the student already exist?
        results = (self.db.session.query(StudentInformation)
            .filter(StudentInformation.c.student_username == username)
            .all())

        if len(results) > 1:
            raise ValueError("Too many %s students: %d" % (username, len(results)))
        if len(results) < 1:
            # No student_id yet, assign one
            #TODO: Or should we be saying ENOTENROLLED?
            raise NotImplementedError()
        self.student = results[0]

    def getAllocation(self, desiredCount):
        """
        Allocate (count) question, return some URIs

        desiredCount: How many questions should return
        """
        def toDict(a, qn):
            """Convert to a dict entry"""
            return dict(
                student_id = a.student_id,
                allocation_id = a.allocation_id,
                question_uid = qn.question_unique_id,
                allocation_time = int(time.mktime(a.allocation_time.timetuple())),
            )

        # Get existing allocation from DB
        allocation = []
        for a, qn in (self.db.session.query(AllocationInformation, QuestionInformation)
            .filter(AllocationInformation.c.question_id == QuestionInformation.c.question_id)
            .filter(AllocationInformation.c.student_id == self.student.student_id)
            .filter(AllocationInformation.c.answered_flag == False)
            .limit(desiredCount)
            .order_by(AllocationInformation.c.allocation_time)
            .all()):
            allocation.append(toDict(a, qn))

        # If already have enough, stop
        if len(allocation) >= desiredCount:
            return allocation

        # Get heap of questions for this lecture.
        #TODO: .with_only_columns
        results = (self.db.session.query(QuestionInformation)
            .filter(QuestionInformation.c.question_location.like(self.lectureLoc + '/%'))
            .filter(QuestionInformation.c.question_id)
            .filter("""question_id NOT IN (
                SELECT question_id FROM allocation_information
                WHERE student_id = %d AND answered_flag = 0
                )""" % self.student.student_id) # SQLAlchemy 0.4 can't do this.
            .all())

        while (len(allocation) < desiredCount) and (len(results) > 0):
            #TODO: An actual IAA
            qn = results.pop(random.randrange(len(results)))

            # Create an allocation object, and add it to DB
            a = AllocationInformation(self.student.student_id, self.lectureLoc, qn.question_id)
            self.db.session.add(a)
            self.db.session.flush()
            allocation.append(toDict(a, qn))
        return allocation

    def getQuestionLocation(self, uid):
        """
        Return question associated with UID, checking that student is allowed
        access to this question.
        """
        # Check that user has been allocated this question
        try:
            #TODO: Only return question_location
            (a, qn) = (self.db.session.query(AllocationInformation, QuestionInformation)
                .filter(AllocationInformation.c.question_id == QuestionInformation.c.question_id)
                .filter(AllocationInformation.c.student_id == self.student.student_id)
                .filter(AllocationInformation.c.answered_flag == False)
                .filter(QuestionInformation.c.question_unique_id == uid)
                .one())
            return str(qn.question_location)
        except InvalidRequestError, e:
            return None

    def storeAnswers(self, answers):
        """
        Update answers
            allocation_id=1,
            question_uid=0ad98aba24cc3d43c3008bc34166babb,
            student_answer=-2,
            quiz_time=datetime.now - 5,
            answer_time=datetime.now,
        """
        self.db.session.begin()
        count = 0
        try:
            for a in answers:
                if 'student_answer' not in a:
                    continue

                # Sanity check: allocation_id and question_uid match
                (alloc, qn) = (self.db.session.query(AllocationInformation, QuestionInformation)
                    .filter(AllocationInformation.c.question_id == QuestionInformation.c.question_id)
                    .filter(AllocationInformation.c.student_id == self.student.student_id)
                    .filter(AllocationInformation.c.answered_flag == False)
                    .filter(AllocationInformation.c.allocation_id == a['allocation_id'])
                    .filter(QuestionInformation.c.question_unique_id == a['question_uid'])
                    .one())

                # Update allocation_information, question answered
                alloc.answered_flag = True

                # Update question_information
                qn.num_asked_for += 1
                if qn.correct_id == a.get('student_answer', -1):
                    qn.num_correct += 1

                # Insert answer into quiz_information
                self.db.session.save(QuizInformation(
                    self.student,
                    qn,
                    self.lectureLoc,
                    datetime.datetime.fromtimestamp(int(a['quiz_time'])),
                    a.get('student_answer', -1),
                    datetime.datetime.fromtimestamp(int(a['answer_time'])),
                ))

                self.db.session.flush()
                count += 1
            self.db.session.commit()
        except:
            self.db.session.rollback()
            raise
        return count
