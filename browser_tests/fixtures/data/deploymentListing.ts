import type {
  DeploymentCompatibility,
  WorkspaceDeployment,
  WorkspaceDeploymentList
} from '@comfyorg/ingest-types'

const LEGACY_BROWSER_DEPLOYMENT: WorkspaceDeployment = {
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

export const DEPLOYMENT_LISTING: WorkspaceDeploymentList = {
  builds_visible: true,
  picked_deployment_id: 'dep-legacy-browser',
  pick_source: 'browser',
  items: [LEGACY_BROWSER_DEPLOYMENT]
}

export const JUST_READY_DEPLOYMENT_ID = 'dep-just-ready'

export const JUST_READY_DEPLOYMENT_LISTING: WorkspaceDeploymentList = {
  ...DEPLOYMENT_LISTING,
  items: [
    {
      deployment_id: JUST_READY_DEPLOYMENT_ID,
      deployment_name: 'staging',
      release_id: 'release-just-ready',
      build_id: 'build-just-ready',
      build_name: 'Just Ready Studio',
      release_version: 1,
      status: 'ready',
      can_start: false,
      created_at: '2026-10-02T00:00:00Z'
    },
    LEGACY_BROWSER_DEPLOYMENT
  ]
}

const CLOUD_MISSING_A_NODE: DeploymentCompatibility['cloud'] = {
  missing_node_types: ['KSampler']
}

export const JUST_READY_UNKNOWN: DeploymentCompatibility = {
  cloud: CLOUD_MISSING_A_NODE,
  deployments: [
    {
      deployment_id: JUST_READY_DEPLOYMENT_ID,
      missing_node_types: [],
      unknown: true
    },
    {
      deployment_id: 'dep-legacy-browser',
      missing_node_types: [],
      unknown: false
    }
  ]
}

export const JUST_READY_COMPATIBLE: DeploymentCompatibility = {
  cloud: CLOUD_MISSING_A_NODE,
  deployments: [
    {
      deployment_id: JUST_READY_DEPLOYMENT_ID,
      missing_node_types: [],
      unknown: false
    },
    {
      deployment_id: 'dep-legacy-browser',
      missing_node_types: [],
      unknown: false
    }
  ]
}
