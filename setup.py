# -*- coding: utf-8 -*-

import os

from setuptools import setup
from setuptools import find_packages


def read(*rnames):
    return open(os.path.join(os.path.dirname(__file__), *rnames)).read()


setup(
    name='tutorweb.quiz',
    version='0.1.dev0',
    description='Tutorweb quiz module',
    long_description=read('README.rst') +
                     read('HISTORY.rst'),
    classifiers=[
        "Programming Language :: Python",
    ],
    keywords='plone tutorweb',
    author='Jamie Lentin',
    author_email='lentinj@shuttlethread.com',
    url='https://github.com/tutorweb/tutorweb.quiz',
    license='GPL',
    packages=find_packages(),
    namespace_packages=['tutorweb'],
    install_requires=[
        'setuptools',
        'plone.subrequest',
        'lxml',
    ],
    extras_require={
        'test': [
            'plone.app.testing',
        ],
    },
    entry_points="""
        [z3c.autoinclude.plugin]
        target = plone
    """,
    include_package_data=True,
    zip_safe=False,
)
