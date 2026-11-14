import json
import os
import unittest

import project_object_info as proj

HERE = os.path.dirname(os.path.abspath(__file__))
SHAPE = os.path.join(HERE, 'object_info.shape.json')
PIN = os.path.join(HERE, 'object_info.pin.json')
FIXTURE = os.path.join(HERE, 'object_info.fixture.json')


def read_json(path):
    with open(path, encoding='utf-8') as fh:
        return json.load(fh)


class ProjectionKeepsShape(unittest.TestCase):
    def test_drops_prose_and_keeps_everything_that_changes_a_widget(self):
        out = proj.project({
            'N': {
                'input': {'required': {
                    'seed': ['INT', {
                        'default': 3, 'min': 0, 'max': 9, 'step': 1,
                        'control_after_generate': True, 'serialize': False,
                        'tooltip': 'prose', 'description': 'more prose',
                    }],
                    'pick': [['a', 'b'], {'tooltip': 'prose'}],
                }},
                'output': ['INT'],
                'output_name': ['INT'],
                'output_node': False,
                'python_module': 'custom_nodes.Thing',
                'display_name': 'Nice Name',
                'description': 'prose',
                'search_aliases': ['x'],
            }
        })
        seed = out['N']['input']['required']['seed'][1]
        self.assertNotIn('tooltip', seed)
        self.assertNotIn('description', seed)
        for kept in ('default', 'min', 'max', 'step',
                     'control_after_generate', 'serialize'):
            self.assertIn(kept, seed)
        self.assertEqual(out['N']['input']['required']['pick'][0], ['a', 'b'])
        self.assertEqual(out['N']['python_module'], 'custom_nodes.Thing')
        for dropped in ('display_name', 'description', 'search_aliases'):
            self.assertNotIn(dropped, out['N'])

    def test_copies_an_unrecognised_input_spec_verbatim(self):
        weird = {'N': {'input': {'required': {'x': {'odd': True}}}}}
        self.assertEqual(
            proj.project(weird)['N']['input']['required']['x'], {'odd': True}
        )

    def test_is_deterministic_and_sorted(self):
        dump = {'B': {'python_module': 'nodes'}, 'A': {'python_module': 'nodes'}}
        self.assertEqual(list(proj.project(dump)), ['A', 'B'])
        self.assertEqual(proj.project(dump), proj.project(dump))


class CommittedArtefactsAgree(unittest.TestCase):
    """The pin, the projection and the test fixture must describe one thing."""

    def setUp(self):
        self.shape = read_json(SHAPE)
        self.pin = read_json(PIN)

    def test_pin_population_matches_the_projection(self):
        pop = self.pin['population']
        self.assertEqual(pop['classes'], len(self.shape))
        self.assertEqual(
            pop['coreClasses'] + pop['packClasses'], len(self.shape)
        )
        core = sum(
            1 for v in self.shape.values()
            if not str(v.get('python_module', '')).startswith('custom_nodes.')
        )
        self.assertEqual(pop['coreClasses'], core)

    def test_projection_carries_only_the_fields_the_pin_claims(self):
        allowed = set(self.pin['projection']['keptNodeFields'])
        for name, node in self.shape.items():
            self.assertTrue(
                set(node) <= allowed, f'{name} carries {set(node) - allowed}'
            )

    def test_fixture_is_a_faithful_slice_of_the_projection(self):
        fixture = read_json(FIXTURE)
        self.assertTrue(fixture)
        for name, node in fixture.items():
            self.assertIn(name, self.shape)
            self.assertEqual(
                json.dumps(node, sort_keys=True),
                json.dumps(self.shape[name], sort_keys=True),
            )

    def test_the_six_classes_the_battery_hardcodes_are_all_present(self):
        for name in ('CheckpointLoaderSimple', 'CLIPTextEncode',
                     'EmptyLatentImage', 'KSampler', 'VAEDecode', 'SaveImage'):
            self.assertIn(name, self.shape)


if __name__ == '__main__':
    unittest.main()
