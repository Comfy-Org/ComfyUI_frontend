import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { BUILD_RECIPE_SECTION } from '@/platform/workspace/customDeploymentBrief'

/** Node types a deployment lacks, under the registry pack that has them, or null when no pack is known. */
export interface MissingBuildPack {
  packId: string | null
  nodeTypes: readonly string[]
}

/** A model a deployment lacks, with its folder under models/ and its download link when known. */
export interface MissingBuildModel {
  name: string
  directory: string | null
  url?: string
}

function packLine({ packId, nodeTypes }: MissingBuildPack): string {
  const nodes = nodeTypes.map((type) => `\`${type}\``).join(', ')
  return packId ? `- Pack \`${packId}\`: ${nodes}` : `- Pack unknown: ${nodes}`
}

function modelLine({ name, directory, url }: MissingBuildModel): string {
  const folder = directory ? ` in \`models/${directory}\`` : ''
  const source = url ? `, from ${url}` : ''
  return `- \`${name}\`${folder}${source}`
}

function listSection(title: string, lines: readonly string[]): string[] {
  return lines.length > 0 ? [`## ${title}`, '', ...lines, ''] : []
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
    ...listSection('Custom nodes', packs.map(packLine)),
    ...listSection('Models', models.map(modelLine)),
    BUILD_RECIPE_SECTION,
    '',
    '## Where the user decides',
    '',
    'Find the pack for any node under an unknown pack, and a download link for',
    'any model without one. Show the user what you will add to the Build, and',
    'wait for a yes. Then cut a new release of it, as the recipe says.',
    '',
    '## When you are done',
    '',
    'Report the release id, and whether it is deployable. Ask the user before',
    `you deploy it to **${deploymentName}**.`
  ].join('\n')
}
