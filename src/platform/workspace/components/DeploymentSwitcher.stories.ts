import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import type { DeploymentPickState } from '@/platform/workspace/deploymentPickState'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

import DeploymentSwitcher from './DeploymentSwitcher.vue'

/** The Run bar's engine button and its Run on list; click it to open. */
const meta: Meta<typeof DeploymentSwitcher> = {
  title: 'Components/DeploymentSwitcher',
  component: DeploymentSwitcher,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="flex h-10 items-center gap-2 floating-panel"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

const studioProd: WorkspaceDeployment = {
  deployment_id: 'dep-f24d36bb-fd1f-4cd7-bfa9-fe015b5cd33d',
  deployment_name: 'Studio production',
  release_id: '6f1c2b0e-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
  build_id: 'b-1',
  build_name: 'Studio Build',
  release_version: 2,
  status: 'ready',
  created_at: '2026-09-16T18:00:00Z'
}

const studioStaging: WorkspaceDeployment = {
  deployment_id: 'dep-0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  deployment_name: 'Studio staging',
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
  gonePickedDeploymentId: null,
  goneDefaultDeploymentId: null,
  buildsVisible: true
})

/** A deployment picked; the button shows its status dot. */
export const Picked: Story = seeded({
  phase: 'ready',
  deployments: [studioProd, experiments, studioStaging],
  pickedDeploymentId: studioProd.deployment_id,
  pickSource: 'browser',
  defaultDeploymentId: null,
  gonePickedDeploymentId: null,
  goneDefaultDeploymentId: null,
  buildsVisible: true
})

/** No pick of its own, so this browser follows the workspace default. */
export const FollowingWorkspaceDefault: Story = seeded({
  phase: 'ready',
  deployments: [studioProd, experiments, studioStaging],
  pickedDeploymentId: studioProd.deployment_id,
  pickSource: 'workspace_default',
  defaultDeploymentId: studioProd.deployment_id,
  gonePickedDeploymentId: null,
  goneDefaultDeploymentId: null,
  buildsVisible: true
})

/** An own pick; choosing the default's row follows the default again. */
export const OwnPickOverWorkspaceDefault: Story = seeded({
  phase: 'ready',
  deployments: [studioProd, experiments, studioStaging],
  pickedDeploymentId: experiments.deployment_id,
  pickSource: 'browser',
  defaultDeploymentId: studioProd.deployment_id,
  gonePickedDeploymentId: null,
  goneDefaultDeploymentId: null,
  buildsVisible: true
})

/**
 * The workspace default this browser followed is gone (deleted, or no
 * longer the workspace's): ingest serves Comfy Cloud, and the list says why.
 */
export const DefaultGone: Story = seeded({
  phase: 'ready',
  deployments: [studioProd, experiments],
  pickedDeploymentId: null,
  pickSource: null,
  defaultDeploymentId: null,
  gonePickedDeploymentId: null,
  goneDefaultDeploymentId: studioStaging.deployment_id,
  buildsVisible: true
})

/** A workspace with no deployments yet. */
export const Empty: Story = seeded({
  phase: 'ready',
  deployments: [],
  pickedDeploymentId: null,
  pickSource: null,
  defaultDeploymentId: null,
  gonePickedDeploymentId: null,
  goneDefaultDeploymentId: null,
  buildsVisible: true
})

/**
 * comfy-builder refused the caller (its routes sit behind the Builds beta):
 * the deployments are listed by name without their Build and Release, and
 * an unnamed one by id.
 */
export const BuildsHidden: Story = seeded({
  phase: 'ready',
  deployments: [
    {
      deployment_id: studioProd.deployment_id,
      deployment_name: studioProd.deployment_name,
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
  gonePickedDeploymentId: null,
  goneDefaultDeploymentId: null,
  buildsVisible: false
})

export const NamedDeployments: Story = seeded({
  phase: 'ready',
  deployments: [
    { ...studioProd, deployment_name: 'Agency A production' },
    {
      ...studioProd,
      deployment_id: studioStaging.deployment_id,
      deployment_name: 'Agency A staging'
    },
    experiments
  ],
  pickedDeploymentId: studioProd.deployment_id,
  pickSource: 'workspace_default',
  defaultDeploymentId: studioProd.deployment_id,
  gonePickedDeploymentId: null,
  goneDefaultDeploymentId: null,
  buildsVisible: true
})
