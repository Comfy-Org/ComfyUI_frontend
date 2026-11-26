import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import packData from '@e2e/fixtures/data/nodes2AcceptancePacks.json' with { type: 'json' }
import {
  measureSurveyNode,
  packNodeTypes,
  placeSurveyNode,
  probeNode,
  probeTargets,
  surveyRenderer,
  writeLayoutData
} from '@e2e/fixtures/helpers/nodes2LayoutSurvey'
import {
  SURVEY_WIDGET,
  failSurveyWidgetRedraw,
  installSurveyProbeWidget
} from '@e2e/fixtures/helpers/nodes2SurveyProbeFixture'
import { layoutSurveyTest as test } from '@e2e/fixtures/nodes2LayoutSurveyFixture'

const MAX_PROBED_WIDGETS = 6
const surveyedPacks = packData.packs.filter(
  (pack) => pack.directory !== 'ComfyUI_devtools'
)

test.describe(
  'Survey instrumentation',
  { tag: ['@acceptance-layout', '@vue-nodes'] },
  () => {
    test('retains a widget redraw failure and continues collecting nodes', async ({
      comfyPage
    }) => {
      await installSurveyProbeWidget(comfyPage)
      const id = await placeSurveyNode(comfyPage, 'Note')
      if (id === null) throw new Error('Note was not placed')
      await failSurveyWidgetRedraw(comfyPage, id)

      const measure = await measureSurveyNode(
        comfyPage,
        id,
        'layout/img/probe/redraw.png',
        []
      )
      const following = await surveyRenderer(
        comfyPage,
        'probe',
        ['Note'],
        'nodes2',
        () => []
      )

      expect(measure).toMatchObject({
        rendered: true,
        errors: [expect.stringContaining('Survey redraw failure')]
      })
      expect(following.map((pass) => pass.measure.rendered)).toEqual([true])
    })

    test('probes quoted widget names and records page errors from the click', async ({
      comfyPage
    }) => {
      await installSurveyProbeWidget(comfyPage, { throwOnClick: true })

      const passes = await surveyRenderer(
        comfyPage,
        'probe',
        ['Note'],
        'nodes2',
        () => [{ target: SURVEY_WIDGET, x: 0.5, y: 0.5 }]
      )

      expect(passes[0].probes[0]).toMatchObject({
        transitions: {
          [`widget ${SURVEY_WIDGET}`]: { before: '0', after: '1' }
        }
      })
      expect(passes[0].measure.errors).toContain('Survey probe click error')
    })

    test('records offscreen probe points as unavailable instead of clicking', async ({
      comfyPage
    }) => {
      await installSurveyProbeWidget(comfyPage, {
        name: 'tall widget',
        height: 3000
      })

      const outcome = await probeNode(comfyPage, 'Note', {
        target: 'tall widget',
        x: 0.5,
        y: 0.9
      })

      expect(outcome).toMatchObject({
        unavailable: 'Probe point is outside the viewport',
        changed: [],
        pixels: 0
      })
    })

    test('collects registered candidates on classic before switching back to Nodes 2.0', async ({
      comfyPage
    }) => {
      const types = await packNodeTypes(comfyPage, '__survey_probe__', [
        'Note',
        'Unavailable survey node'
      ])
      expect(types).toEqual(['Note'])
      const classic = await surveyRenderer(
        comfyPage,
        'probe',
        types,
        'classic',
        () => []
      )
      await expect(comfyPage.vueNodes.nodes).toHaveCount(0)

      const nodes2 = await surveyRenderer(
        comfyPage,
        'probe',
        types,
        'nodes2',
        () => []
      )

      await expect(comfyPage.vueNodes.nodes).toHaveCount(1)
      expect([classic[0].measure.rendered, nodes2[0].measure.rendered]).toEqual(
        [true, true]
      )
    })
  }
)

test.describe(
  'Node pack layout survey: classic against Nodes 2.0',
  { tag: ['@nodes2-acceptance', '@acceptance-layout', '@vue-nodes'] },
  () => {
    for (const pack of surveyedPacks) {
      test(`${pack.directory} collects layout and response comparisons`, async ({
        comfyPage
      }) => {
        const types = await packNodeTypes(
          comfyPage,
          pack.directory,
          pack.frontendNodeTypes
        )
        expect(
          types,
          `${pack.directory} has node types LiteGraph can create`
        ).not.toHaveLength(0)
        const classic = await surveyRenderer(
          comfyPage,
          pack.directory,
          types,
          'classic',
          (_, measure) => probeTargets(measure, MAX_PROBED_WIDGETS)
        )
        const nodes2 = await surveyRenderer(
          comfyPage,
          pack.directory,
          types,
          'nodes2',
          (index) => probeTargets(classic[index].measure, MAX_PROBED_WIDGETS),
          (index) => classic[index].measure
        )
        writeLayoutData({
          pack: pack.directory,
          commit: process.env.NODES2_ACCEPTANCE_BUILD ?? 'unknown',
          finishedAt: new Date().toISOString(),
          nodes: types.map((type, index) => ({
            type,
            classic: classic[index].measure,
            nodes2: nodes2[index].measure,
            probes: {
              classic: classic[index].probes,
              nodes2: nodes2[index].probes
            }
          }))
        })
      })
    }
  }
)
