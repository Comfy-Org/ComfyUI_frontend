import { hubWorkflowName } from '../../config/hub-models'
import hubWorkflowNames from '../../config/hub-workflow-names.json' with { type: 'json' }
import { buildHubWorkflowsManifest } from '../../config/hub-workflows-manifest'
import { hubWorkflowsRouting } from '../../config/hub-workflows-routing'
import { workflowModels } from '../../config/workshop-workflow-content'

export function GET() {
  const built = workflowModels.map(({ slug }) => hubWorkflowName(slug)).sort()
  if (built.join('\n') !== [...hubWorkflowNames].sort().join('\n'))
    throw new Error(
      'hub-workflow-names.json does not match the built workflow pages; run vitest -u on hub-workflow-names.test.ts.'
    )
  return Response.json(
    buildHubWorkflowsManifest(hubWorkflowNames, hubWorkflowsRouting)
  )
}
