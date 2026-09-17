import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { WorkspaceRelease } from '@/platform/workspace/api/workspaceApi'
import type { ReleasePickState } from '@/platform/workspace/releasePickState'
import { useReleasePickStore } from '@/platform/workspace/stores/releasePickStore'

import ReleaseSwitcher from './ReleaseSwitcher.vue'

/**
 * The Release switcher under the workspace selector in the user popover:
 * which developer-platform Release this browser runs its Cloud jobs on, and
 * the list it may pick from. Each story seeds the store's state directly; the
 * Storybook team-workspace stub has no active workspace, so the store never
 * calls the listing route here. Click the trigger to open the panel.
 */
const meta: Meta<typeof ReleaseSwitcher> = {
  title: 'Components/ReleaseSwitcher',
  component: ReleaseSwitcher,
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

const studioV2: WorkspaceRelease = {
  release_id: '6f1c2b0e-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
  build_id: 'b-1',
  build_name: 'Studio Build',
  version: 2,
  created_at: '2026-09-16T18:00:00Z',
  deployed: true,
  deployment_status: 'ready'
}

const studioV1: WorkspaceRelease = {
  release_id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  build_id: 'b-1',
  build_name: 'Studio Build',
  version: 1,
  created_at: '2026-09-12T09:30:00Z',
  deployed: false
}

const experimentsV3: WorkspaceRelease = {
  release_id: 'c0ffee00-1111-4222-8333-444455556666',
  build_id: 'b-2',
  build_name: 'Experiments',
  version: 3,
  created_at: '2026-09-15T12:00:00Z',
  deployed: true,
  deployment_status: 'stopped'
}

// The store is seeded from a component's setup(), where the app's Pinia is
// injected; a story beforeEach runs before any component and has no active
// Pinia.
function seeded(state: ReleasePickState): Story {
  return {
    decorators: [
      (story) => ({
        components: { story },
        setup() {
          useReleasePickStore().state = state
        },
        template: '<story />'
      })
    ]
  }
}

/** Nothing picked: this browser runs on Comfy Cloud. */
export const Default: Story = seeded({
  phase: 'ready',
  releases: [studioV2, experimentsV3, studioV1],
  pickedReleaseId: null,
  buildsVisible: true
})

/** A Release picked; the trigger names it. */
export const Picked: Story = seeded({
  phase: 'ready',
  releases: [studioV2, experimentsV3, studioV1],
  pickedReleaseId: studioV2.release_id,
  buildsVisible: true
})

/** The listing has not answered yet. */
export const Loading: Story = seeded({ phase: 'loading' })

/** The platform could not be asked; the server's message is shown. */
export const Unavailable: Story = seeded({
  phase: 'unavailable',
  message: 'could not list releases from comfy-deploy; try again'
})

/** A workspace with no Releases yet. */
export const Empty: Story = seeded({
  phase: 'ready',
  releases: [],
  pickedReleaseId: null,
  buildsVisible: true
})

/**
 * comfy-builder refused the caller (its routes sit behind the Builds beta):
 * the deployed Releases are listed nameless, and the panel says why.
 */
export const BuildsHidden: Story = seeded({
  phase: 'ready',
  releases: [
    {
      release_id: studioV2.release_id,
      deployed: true,
      deployment_status: 'ready'
    },
    {
      release_id: experimentsV3.release_id,
      deployed: true,
      deployment_status: 'stopped'
    }
  ],
  pickedReleaseId: studioV2.release_id,
  buildsVisible: false
})
