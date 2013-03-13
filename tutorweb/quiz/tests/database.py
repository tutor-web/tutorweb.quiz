from sqlalchemy.engine.url import URL

from Products.TutorWeb.db import TutorWebQuizDatabase

class TestDatabase(TutorWebQuizDatabase):
    @property
    def _url(self):
        return URL(
            drivername='sqlite',
            database='//tmp/tutorweb.quiz.unittest.sqlite',
        )
