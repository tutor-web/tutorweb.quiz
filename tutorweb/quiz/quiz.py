import datetime
import logging
import random
import time

from AccessControl import Unauthorized

from sqlalchemy.exceptions import InvalidRequestError

from zope.component import getUtility

from collective.lead.interfaces import IDatabase

from Products.TutorWeb.db import AllocationInformation, QuestionInformation \
    , QuizInformation, StudentInformation


class Quiz(object):
    """
    Object that encapsulates a quiz a student is taking
    """
    def __init__(self, lecture, member):
        if member is None or 'Anonymous' in member.getRoles():
            raise Unauthorized("Nobody signed in")
        self.username = member.getUserName()
        self.lectureLoc = lecture

        # Fetch DB connection
        self.db = getUtility(IDatabase, name='tutorweb.quizquestioninformation')

        # Does the student already exist?
        results = (self.db.session.query(StudentInformation)
            .filter(StudentInformation.c.student_username == self.username)
            .all())

        if len(results) > 1:
            raise ValueError("Too many %s students: %d" % (self.username, len(results)))
        elif len(results) == 1:
            self.student = results[0]
        else:
            fullname = member.getProperty('fullname').split()
            # No student_id yet, assign one
            self.student = StudentInformation(
                member.getUserName(),
                (member.getUserName() + "." + str(int(time.time())))[0:64],
                fullname[0],
                fullname[-1],
                member.getProperty('email'),
            )
            self.db.session.save(self.student)
            self.db.session.flush()

    def getAllocation(self, desiredCount, getQuestions):
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

        def getCorrectAnswer(qnBrain):
            for v in qnBrain.getObject().getAnswerList():
                if v.get('correct', False):
                    return v['answerid']
            return None

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
        existingUIDs = [a['question_uid'] for a in allocation]
        results = [b for b in getQuestions(self.lectureLoc) if b.UID not in existingUIDs]
        while (len(allocation) < desiredCount) and (len(results) > 0):
            #TODO: An actual IAA
            qnBrain = results.pop(random.randrange(len(results)))

            # Create question_information if missing from DB
            questions = (self.db.session.query(QuestionInformation)
                .filter(QuestionInformation.c.question_unique_id == qnBrain.UID)
                .limit(1).all())
            if len(questions) > 0:
                qn = questions[0]
            else:
                qn = QuestionInformation(
                    qnBrain.getPath(),
                    1, 0, getCorrectAnswer(qnBrain),
                    qnBrain.UID,
                )
                self.db.session.save(qn)
                self.db.session.flush()

            # Create an allocation object, and add it to DB
            a = AllocationInformation(self.student.student_id, self.lectureLoc, qn.question_id)
            self.db.session.add(a)
            self.db.session.flush()
            allocation.append(toDict(a, qn))
        return allocation

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
