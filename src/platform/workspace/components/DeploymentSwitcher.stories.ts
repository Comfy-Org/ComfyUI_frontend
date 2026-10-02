import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { WorkspaceDeployment } from '@comfyorg/ingest-types'
import type { DeploymentPickState } from '@/platform/workspace/deploymentPickState'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

import DeploymentSwitcher from './DeploymentSwitcher.vue'

/**
 * The deployment switcher under the workspace selector in the user popover:
 * which developer-platform deployment this browser runs its Cloud jobs on,
 * and the list it may pick from. Each row is a deployment with the Release it
 * runs now; a pick follows the deployment when its owner updates it. Each story seeds the store's state directly; the
 * Storybook team-workspace stub has no active workspace, so the store never
 * calls the listing route here. Click the trigger to open the panel.
 */
const meta: Meta<typeof DeploymentSwitcher> = {
  title: 'Components/DeploymentSwitcher',
  component: DeploymentSwitcher,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="ml-96 w-80 rounded-lg border border-border-default bg-base-background p-2"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

const studioProd: WorkspaceDeployment = {
  deployment_id: 'dep-f24d36bb-fd1f-4cd7-bfa9-fe015b5cd33d',
  release_id: '6f1c2b0e-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
  build_id: 'b-1',
  build_name: 'Studio Build',
  release_version: 2,
  status: 'ready',
  created_at: '2026-09-16T18:00:00Z'
}

const studioStaging: WorkspaceDeployment = {
  deployment_id: 'dep-0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  release_id: 'c4a8e2f0-5b6c-4d7e-8f90-1a2b3c4d5e6f',
  build_id: 'b-1',
  build_name: 'Studio Build',
  release_version: 3,
  status: 'starting',
  created_at: '2026-09-12T09:30:00Z'
}

const experiments: WorkspaceDeployment = {
  deployment_id: 'dep-c0ffee00-1111-4222-8333-444455556666',
  release_id: 'c0ffee00-1111-4222-8333-444455556666',
  build_id: 'b-2',
  build_name: 'Experiments',
  release_version: 3,
  status: 'stopped',
  created_at: '2026-09-15T12:00:00Z'
}

// The store is seeded from a component's setup(), where the app's Pinia is
// injected; a story beforeEach runs before any component and has no active
// Pinia.
function seeded(state: DeploymentPickState): Story {
  return {
    decorators: [
      (story) => ({
        components: { story },
        setup() {
          useDeploymentPickStore().state = state
        },
        template: '<story />'
      })
    ]
  }
}

/** Nothing picked: this browser runs on Comfy Cloud. */
export const Default: Story = seeded({
  phase: 'ready',
  deployments: [studioProd, experiments, studioStaging],
  pickedDeploymentId: null,
  pickSource: null,
  defaultDeploymentId: null,
  buildsVisible: true
})

/** A deployment picked; the trigger names its Build and Release. */
export const Picked: Story = seeded({
  phase: 'ready',
  deployments: [studioProd, experiments, studioStaging],
  pickedDeploymentId: studioProd.deployment_id,
  pickSource: 'browser',
  defaultDeploymentId: null,
  buildsVisible: true
})

/**
 * An owner set a workspace default (BE-17480) and this browser has no pick
 * of its own, so it follows it; the trigger says so.
 */
export const FollowingWorkspaceDefault: Story = seeded({
  phase: 'ready',
  deployments: [studioProd, experiments, studioStaging],
  pickedDeploymentId: studioProd.deployment_id,
  pickSource: 'workspace_default',
  defaultDeploymentId: studioProd.deployment_id,
  buildsVisible: true
})

/**
 * This browser picked for itself while the workspace has a default: the
 * panel offers the default as a row to go back to.
 */
export const OwnPickOverWorkspaceDefault: Story = seeded({
  phase: 'ready',
  deployments: [studioProd, experiments, studioStaging],
  pickedDeploymentId: experiments.deployment_id,
  pickSource: 'browser',
  defaultDeploymentId: studioProd.deployment_id,
  buildsVisible: true
})

/** A workspace with no deployments yet. */
export const Empty: Story = seeded({
  phase: 'ready',
  deployments: [],
  pickedDeploymentId: null,
  pickSource: null,
  defaultDeploymentId: null,
  buildsVisible: true
})

/**
 * comfy-builder refused the caller (its routes sit behind the Builds beta):
 * the deployments are listed by id, and the panel says why.
 */
export const BuildsHidden: Story = seeded({
  phase: 'ready',
  deployments: [
    {
      deployment_id: studioProd.deployment_id,
      release_id: studioProd.release_id,
      status: 'ready',
      created_at: studioProd.created_at
    },
    {
      deployment_id: experiments.deployment_id,
      release_id: experiments.release_id,
      status: 'stopped',
      created_at: experiments.created_at
    }
  ],
  pickedDeploymentId: studioProd.deployment_id,
  pickSource: 'browser',
  defaultDeploymentId: null,
  buildsVisible: false
})
