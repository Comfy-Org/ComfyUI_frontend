import path from 'node:path'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import packData from '@e2e/fixtures/data/nodes2AcceptancePacks.json' with { type: 'json' }
import { keepMixlabOffNodeDrawHooks } from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import type { SurveyRenderer } from '@e2e/fixtures/helpers/nodes2LayoutSurvey'
import {
  NOT_RENDERED,
  answerOutsideRequestsLocally,
  measureSurveyNode,
  packNodeTypes,
  placeSurveyNode,
  probeNode,
  probeTargets
} from '@e2e/fixtures/helpers/nodes2LayoutSurvey'
import type {
  LayoutData,
  NodeMeasure,
  ProbeOutcome,
  ProbeTarget
} from '@e2e/reporters/nodes2Acceptance/layout'
import { REPORT_DIR } from '@e2e/reporters/nodes2Acceptance/reportDir'
import { writeReportFile } from '@e2e/reporters/nodes2Acceptance/reportFiles'

const MAX_PROBED_WIDGETS = 6

async function withPageErrors<T>(
  comfyPage: ComfyPage,
  action: () => Promise<T>
): Promise<{ value: T; errors: string[] }> {
  const errors: string[] = []
  const collect = (error: Error) =>
    errors.push(error.message.split('\n')[0].slice(0, 200))
  comfyPage.page.on('pageerror', collect)
  try {
    return { value: await action(), errors }
  } finally {
    comfyPage.page.off('pageerror', collect)
  }
}

async function measureType(
  comfyPage: ComfyPage,
  type: string,
  imagePath: string,
  classic?: NodeMeasure
): Promise<NodeMeasure> {
  const placed = await withPageErrors(comfyPage, () =>
    placeSurveyNode(comfyPage, type)
  )
  if (placed.value === null) return { ...NOT_RENDERED, errors: placed.errors }
  return measureSurveyNode(
    comfyPage,
    placed.value,
    imagePath,
    placed.errors,
    classic
  )
}

async function probeType(
  comfyPage: ComfyPage,
  type: string,
  targets: ProbeTarget[]
): Promise<ProbeOutcome[]> {
  const outcomes: ProbeOutcome[] = []
  for (const target of targets) {
    const outcome = await probeNode(comfyPage, type, target)
    if (outcome) outcomes.push(outcome)
  }
  return outcomes
}

async function surveyRenderer(
  comfyPage: ComfyPage,
  pack: string,
  types: string[],
  renderer: SurveyRenderer,
  targetsFor: (index: number, measure: NodeMeasure) => ProbeTarget[],
  classicFor: (index: number) => NodeMeasure | undefined = () => undefined
) {
  const passes: { measure: NodeMeasure; probes: ProbeOutcome[] }[] = []
  for (const [index, type] of types.entries()) {
    const measure = await measureType(
      comfyPage,
      type,
      `layout/img/${pack}/${index}.${renderer}.png`,
      classicFor(index)
    )
    const probes = await probeType(comfyPage, type, targetsFor(index, measure))
    passes.push({ measure, probes })
  }
  return passes
}

function writeLayoutData(data: LayoutData) {
  const file = path.join(REPORT_DIR, 'layout', 'data', `${data.pack}.json`)
  writeReportFile(file, JSON.stringify(data, null, 2))
}

const surveyedPacks = packData.packs.filter(
  (pack) => pack.directory !== 'ComfyUI_devtools'
)

test.describe(
  'Node pack layout survey: classic against Nodes 2.0',
  { tag: ['@nodes2-acceptance', '@acceptance-layout'] },
  () => {
    for (const pack of surveyedPacks) {
      test(`${pack.directory} node types render and respond the same`, async ({
        comfyPage
      }) => {
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await answerOutsideRequestsLocally(comfyPage)
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
        await comfyPage.vueNodes.setEnabled(true)
        comfyPage.isVueNodes = true
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
