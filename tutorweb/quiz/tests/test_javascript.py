import os.path
import unittest
import subprocess

class NodeJSTest(unittest.TestCase):
    def test_runNodeTests(self):
        """Run node tests"""
        pkgDir = os.path.normpath(os.path.join(__file__, '..', '..', '..', '..'))
        out = subprocess.call(["make"], cwd=pkgDir)
        self.assertEqual(out, 0)
