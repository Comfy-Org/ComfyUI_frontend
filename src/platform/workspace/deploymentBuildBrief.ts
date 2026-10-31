import { partition, uniq } from 'es-toolkit'

import { isModelUrlAllowlisted } from '@/platform/workflowErrors/missingModel/modelUrlAllowlist'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import {
  BUILD_RECIPE_SECTION,
  CUT_AND_REPORT_SECTION
} from '@/platform/workspace/customDeploymentBrief'

/** Node types a deployment lacks, under their pack, or null if none is known. */
export interface MissingBuildPack {
  packId: string | null
  nodeTypes: readonly string[]
  /** Set when the Build has the pack but its release cannot load it. */
  loadFailure?: { cause: string }
}

/** A model a deployment lacks, with its models/ folder and download link. */
export interface MissingBuildModel {
  name: string
  directory: string | null
  url?: string
}

function inline(text: string): string {
  return text.replace(/[\p{Cc}\p{Zl}\p{Zp}`]/gu, ' ')
}

function packLine({ packId, nodeTypes }: MissingBuildPack): string {
  const nodes = uniq(nodeTypes)
    .map((type) => `\`${inline(type)}\``)
    .join(', ')
  return packId
    ? `- Pack \`${inline(packId)}\`: ${nodes}`
    : `- Pack unknown: ${nodes}`
}

function failingPackLine(pack: MissingBuildPack): string {
  const cause = pack.loadFailure?.cause
  return cause
    ? `${packLine(pack)} (fails with: ${inline(cause)})`
    : packLine(pack)
}

function downloadLink(url: string | undefined): string | undefined {
  if (!url || !isModelUrlAllowlisted(url) || !URL.canParse(url)) return
  return new URL(url).href
}

function modelLine({ name, directory, url }: MissingBuildModel): string {
  const folder = directory ? ` in \`models/${inline(directory)}\`` : ''
  const link = downloadLink(url)
  const source = link ? `, from ${link}` : ''
  return `- \`${inline(name)}\`${folder}${source}`
}

function listSection(title: string, lines: readonly string[]): string[] {
  return lines.length > 0 ? [`## ${title}`, '', ...lines, ''] : []
}

function failingPackSection(packs: readonly MissingBuildPack[]): string[] {
  if (packs.length === 0) return []
  return [
    '## Packs the Build has but cannot load',
    '',
    'The Build already has these packs, so do not add them again. Find out why',
    'each one fails to load, and fix that.',
    '',
    ...packs.map(failingPackLine),
    ''
  ]
}

function missingSections(
  packs: readonly MissingBuildPack[],
  models: readonly MissingBuildModel[]
): string[] {
  const [failingPacks, absentPacks] = partition(
    packs,
    (pack) => pack.loadFailure !== undefined
  )
  return [
    ...listSection('Custom nodes', absentPacks.map(packLine)),
    ...failingPackSection(failingPacks),
    ...listSection('Models', models.map(modelLine))
  ]
}

function buildReference(deployment: WorkspaceDeployment): string {
  if (!deployment.build_id) return 'its Build'
  const name = deployment.build_name ?? deployment.build_id
  return `the Build **${name}** (\`${deployment.build_id}\`)`
}

/** Brief an agent follows to add what a deployment lacks to the Build it runs. */
export function deploymentBuildBrief(
  deployment: WorkspaceDeployment,
  packs: readonly MissingBuildPack[],
  models: readonly MissingBuildModel[]
): string {
  const deploymentName = deployment.deployment_name ?? deployment.deployment_id
  return [
    '# Add custom nodes and models to a Comfy Cloud deployment',
    '',
    `The user's ComfyUI workflow runs on the deployment **${deploymentName}**`,
    `(\`${deployment.deployment_id}\`). It runs release \`${deployment.release_id}\` of`,
    `${buildReference(deployment)} on the Comfy developer platform. That release`,
    'lacks these custom nodes and models the workflow uses:',
    '',
    ...missingSections(packs, models),
    BUILD_RECIPE_SECTION,
    '',
    '## Where the user decides',
    '',
    'Find the pack for any node under an unknown pack, and a download link for',
    'any model without one. Show the user what you will change in the Build,',
    'and wait for a yes. Then cut a new release of it, as the recipe says.',
    '',
    '## When you are done',
    '',
    'Report the release id, and whether it is deployable. Ask the user before',
    `you deploy it to **${deploymentName}**.`
  ].join('\n')
}

/** Agent brief for a custom deployment that runs a workflow Cloud can't. */
export function workflowDeploymentBrief(
  packs: readonly MissingBuildPack[],
  models: readonly MissingBuildModel[]
): string {
  return [
    '# Create a custom deployment that runs a workflow',
    '',
    'The user opened a ComfyUI workflow on Comfy Cloud that uses custom nodes',
    'and models Comfy Cloud does not have. Help the user create a **custom',
    'deployment** on the Comfy developer platform that runs it. Once it is',
    'deployed, it appears under **Run on** in the ComfyUI editor for everyone in',
    "the user's workspace.",
    '',
    ...missingSections(packs, models),
    BUILD_RECIPE_SECTION,
    '',
    '## Where the user decides',
    '',
    'Find the pack for any node under an unknown pack, and a download link for',
    'any model without one. Ask the user which GPU the deployment should run on.',
    CUT_AND_REPORT_SECTION
  ].join('\n')
}
