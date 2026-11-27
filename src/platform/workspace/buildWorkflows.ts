import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import {
  capturePreservedQuery,
  clearPreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'

const WORKFLOWS_NAMESPACE = PRESERVED_QUERY_NAMESPACES.WORKFLOWS

function pathPart(name: string): string {
  return name
    .replace(/[\\/]/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.\s]+|[.\s]+$/g, '')
}

/**
 * The folder under `workflows/` that Platform saves a Build's dropped
 * workflows in, worked out from the Build the way Platform's
 * `buildWorkflowFolder` does (BE-21146): its cleaned name, then the first
 * eight characters of its id.
 */
export function buildWorkflowFolder(build: {
  id: string
  name: string
}): string {
  const name = pathPart(build.name.replace(/,/g, '-')) || 'New Build'
  return `${name} (${build.id.slice(0, 8)})`
}

/** The folder of the Build a deployment runs, or null when its Build is not known. */
export function deploymentWorkflowFolder(
  deployment: WorkspaceDeployment | null | undefined
): string | null {
  if (!deployment?.build_id || deployment.build_name === undefined) return null
  return buildWorkflowFolder({
    id: deployment.build_id,
    name: deployment.build_name
  })
}

function bootLinksAWorkflow(): boolean {
  const params = new URLSearchParams(window.location.search)
  return (
    params.has('workflows') ||
    params.has('workflowId') ||
    getPreservedQueryParam(WORKFLOWS_NAMESPACE, 'workflows') !== undefined ||
    getPreservedQueryParam(
      PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID,
      'workflowId'
    ) !== undefined
  )
}

/**
 * Has the boot after a switch's reload open the workflows saved for the
 * deployment's Build, as a `?workflows=` link would, unless this page's link
 * already names a workflow. Returns the undo for a reload that never comes.
 */
export function carryBuildWorkflowsIntoReload(
  deployment: WorkspaceDeployment | null | undefined
): () => void {
  const folder = deploymentWorkflowFolder(deployment)
  if (!folder || bootLinksAWorkflow()) return () => {}
  capturePreservedQuery(WORKFLOWS_NAMESPACE, { workflows: folder }, [
    'workflows'
  ])
  return () => clearPreservedQuery(WORKFLOWS_NAMESPACE)
}
