from Products.CMFCore.utils import getToolByName
from zope.configuration import xmlconfig
from plone.app.testing import applyProfile
from plone.app.testing import PloneFixture
from plone.app.testing import PloneTestLifecycle
from plone.app.testing import PloneSandboxLayer
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID
from plone.testing import z2


class TWFixture(PloneFixture):

    # No sunburst please
    extensionProfiles = ()

TW_FIXTURE = TWFixture()


class TWTestLifecycle(PloneTestLifecycle):

    defaultBases = (TW_FIXTURE, )


class IntegrationTesting(TWTestLifecycle, z2.IntegrationTesting):
    pass


class FunctionalTesting(TWTestLifecycle, z2.FunctionalTesting):
    pass


class TWLayer(PloneSandboxLayer):
    """ layer for integration tests """

    defaultBases = (TW_FIXTURE, )

    def setUpZope(self, app, configurationContext):
        import tutorweb.quiz
        import Products.TutorWeb
        import Products.CMFPlone
        import tutorweb.quiz.tests

        xmlconfig.file("configure.zcml", tutorweb.quiz,
                       context=configurationContext)
        xmlconfig.file("configure.zcml", Products.TutorWeb,
                       context=configurationContext)
        xmlconfig.file("configure.zcml", tutorweb.quiz.tests,
                       context=configurationContext)

        z2.installProduct(app, 'Products.TutorWeb')

    def tearDownZope(self, app):
        z2.uninstallProduct(app, 'Products.TutorWeb')

    def setUpPloneSite(self, portal):
        from Products.TutorWeb.Extensions.Install import install
        install(portal)
        applyProfile(portal, 'plonetheme.sunburst:default')

        mt = getToolByName(portal, 'portal_membership')
        mt.addMember(
            'foo@example.com', 'new_password', ['Member'], [],
            {'email': 'foo@example.com'})

        setRoles(portal, TEST_USER_ID, ['Manager'])
        # Create test content
        portal.invokeFactory('Department','test-department')
        portal['test-department'].invokeFactory('Tutorial','test-tutorial')
        portal['test-department']['test-tutorial'].invokeFactory('Lecture','test-lecture1')
        portal['test-department']['test-tutorial'].invokeFactory('Lecture','test-lecture2')
        lecture = portal['test-department']['test-tutorial']['test-lecture1']
        lecture.invokeFactory('TutorWebQuestion','qn1')
        lecture['qn1'].setQuestionText("This is qn1")
        lecture['qn1'].setAnswerList([
            dict(answerid='0', answertext="answer 1 incorrect", correct='', randomize=''),
            dict(answerid='1', answertext="answer 2 CORRECT", correct='1', randomize=''),
            dict(answerid='2', answertext="answer 3 incorrect", correct='', randomize=''),
        ])
        lecture['qn1'].setQuestionAndAnswer()
        lecture.invokeFactory('TutorWebQuestion','qn2')
        lecture['qn2'].setQuestionText("This is qn2")
        lecture['qn2'].setAnswerList([
            dict(answerid='0', answertext="answer 1 incorrect", correct='', randomize=''),
            dict(answerid='1', answertext="answer 2 incorrect", correct='', randomize=''),
            dict(answerid='2', answertext="answer 3 CORRECT", correct='1', randomize=''),
        ])
        lecture['qn2'].setQuestionAndAnswer()
        lecture.invokeFactory('TutorWebQuestion','qn3')
        lecture['qn3'].setQuestionText("This is qn3")
        lecture['qn3'].setAnswerList([
            dict(answerid='0', answertext="answer 1 CORRECT", correct='1', randomize=''),
            dict(answerid='1', answertext="answer 2 incorrect", correct='', randomize=''),
            dict(answerid='2', answertext="answer 3 incorrect", correct='', randomize=''),
        ])
        lecture['qn3'].setQuestionAndAnswer()

        lecture = portal['test-department']['test-tutorial']['test-lecture2']
        lecture.invokeFactory('TutorWebQuestion','qn1')
        lecture['qn1'].setQuestionText("This is qn1")
        lecture['qn1'].setAnswerList([
            dict(answerid='0', answertext="answer 1 incorrect", correct='', randomize=''),
            dict(answerid='1', answertext="answer 2 CORRECT", correct='1', randomize=''),
            dict(answerid='2', answertext="answer 3 incorrect", correct='', randomize=''),
        ])
        lecture['qn1'].setQuestionAndAnswer()
        lecture.invokeFactory('TutorWebQuestion','qn2')
        lecture['qn2'].setQuestionText("This is qn2")
        lecture['qn2'].setAnswerList([
            dict(answerid='0', answertext="answer 1 CORRECT", correct='1', randomize=''),
            dict(answerid='1', answertext="answer 2 incorrect", correct='', randomize=''),
            dict(answerid='2', answertext="answer 3 incorrect", correct='', randomize=''),
        ])
        lecture['qn2'].setQuestionAndAnswer()

        mt = getToolByName(portal, 'portal_membership')
        acl_users = getToolByName(portal, 'acl_users')
        acl_users.userFolderAddUser('quiz_taker1', 'secret', ['Member'], [])
        mt.getMemberById('quiz_taker1').setMemberProperties(dict(
            fullname='Quiz Taker',
            email='qt1@example.com',
        ))
        acl_users.userFolderAddUser('quiz_taker2', 'secret', ['Member'], [])
        mt.getMemberById('quiz_taker2').setMemberProperties(dict(
            fullname='Another Taker',
            email='qt2@example.com',
        ))
        import transaction; transaction.commit()

        setRoles(portal, TEST_USER_ID, ['Member'])
        self.setUpDatabase()

    def setUpDatabase(self):
        from shutil import copyfile
        import logging
        copyfile(self._testFile('unittest.sqlite'), '/tmp/tutorweb.quiz.unittest.sqlite')
        logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

    def _testFile(self, *args):
        import pkg_resources
        import os.path
        return os.path.join(
            pkg_resources.get_distribution('tutorweb.quiz').location,
            'tutorweb', 'quiz', 'tests',
            *args
        )

TW_LAYER = TWLayer()
TW_INTEGRATION = IntegrationTesting(
    bases=(TW_LAYER, ), name="TW:Integration")
TW_FUNCTIONAL = FunctionalTesting(
    bases=(TW_LAYER, ), name="TW:Functional")
