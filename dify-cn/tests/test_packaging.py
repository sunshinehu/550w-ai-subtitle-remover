import pathlib
import re
import tomllib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class PackagingTests(unittest.TestCase):
    def test_runtime_dependencies_match_project(self):
        project = tomllib.loads((ROOT / 'pyproject.toml').read_text())
        def normalize(value):
            return re.sub(r'[-_.]+', '-', value.strip().lower())
        requirements = {normalize(line) for line in
                        (ROOT / 'requirements.txt').read_text().splitlines()
                        if line.strip() and not line.lstrip().startswith('#')}
        self.assertEqual(requirements,
                         {normalize(value) for value in project['project']['dependencies']})
