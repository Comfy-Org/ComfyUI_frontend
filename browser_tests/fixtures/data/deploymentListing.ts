import type { WorkspaceDeploymentList } from '@comfyorg/ingest-types'

export const DEPLOYMENT_LISTING: WorkspaceDeploymentList = {
  builds_visible: true,
  picked_deployment_id: 'dep-legacy-browser',
  pick_source: 'browser',
  items: [
    {
      deployment_id: 'dep-legacy-browser',
      deployment_name: 'production',
      release_id: 'release-legacy-browser',
      build_id: 'build-legacy-browser',
      build_name: 'Legacy Browser Studio',
      release_version: 1,
      status: 'ready',
      can_start: false,
      created_at: '2026-10-01T00:00:00Z'
    }
  ]
}
