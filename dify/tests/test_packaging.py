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

    def test_declared_translations_cover_every_human_readable_field(self):
        import yaml
        class StrictLoader(yaml.SafeLoader):
            pass
        def mapping(loader, node, deep=False):
            result = {}
            for key_node, value_node in node.value:
                key = loader.construct_object(key_node, deep=deep)
                if key in result:
                    raise ValueError(f'duplicate YAML key: {key}')
                result[key] = loader.construct_object(value_node, deep=deep)
            return result
        StrictLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, mapping)
        total = 0
        def inspect(value):
            nonlocal total
            if isinstance(value, dict):
                if 'en_US' in value:
                    total += 1
                    self.assertTrue(all(re.fullmatch(r'[a-z]{2}_[A-Za-z]+', key)
                                        for key in value), f'Unexpected locale key: {value.keys()}')
                    self.assertTrue(all(isinstance(text, str) and text.strip()
                                        for text in value.values()))
                    for language in ('zh_Hans', 'ja_JP', 'pt_BR'):
                        self.assertIn(language, value)
                        self.assertTrue(value[language].strip())
                        self.assertEqual(re.findall(r'\{\w+\}', value['en_US']),
                                         re.findall(r'\{\w+\}', value[language]))
                for child in value.values(): inspect(child)
            elif isinstance(value, list):
                for child in value: inspect(child)
        for path in [ROOT / 'manifest.yaml', *ROOT.glob('provider/*.yaml'), *ROOT.glob('tools/*.yaml')]:
            inspect(yaml.load(path.read_text(), Loader=StrictLoader))
        self.assertGreaterEqual(total, 65)
