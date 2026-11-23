import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { userEvent, within } from 'storybook/test'

import type { ListProjectsResponse } from '@comfyorg/ingest-types'
import {
  listProjectsByRole,
  projectAsOwner
} from '@/platform/workspace/api/__fixtures__/projects'
import { useProjectStore } from '@/platform/workspace/stores/projectStore'

import ProjectSwitcherFlyout from './ProjectSwitcherFlyout.vue'

const meta: Meta<typeof ProjectSwitcherFlyout> = {
  title: 'Components/ProjectSwitcherFlyout',
  component: ProjectSwitcherFlyout,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="w-80 rounded-xl border border-border p-2"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

function seeded(list: ListProjectsResponse, selectedId?: string): Story {
  return {
    decorators: [
      (story) => ({
        components: { story },
        setup() {
          useProjectStore().receiveList(list, selectedId)
        },
        template: '<story />'
      })
    ]
  }
}

function manyProjects(): ListProjectsResponse {
  const owner = listProjectsByRole.owner
  return {
    ...owner,
    projects: [
      owner.projects[0],
      ...Array.from({ length: 7 }, (_, index) => ({
        ...projectAsOwner,
        id: `proj-${index}`,
        name: `Campaign ${index + 1}`,
        is_default: false
      }))
    ]
  }
}

export const FewProjects: Story = seeded(
  listProjectsByRole.owner,
  'proj-studio'
)

export const CannotCreate: Story = seeded(
  listProjectsByRole.runner,
  'proj-studio'
)

export const ManyProjects: Story = seeded(manyProjects(), 'proj-0')

export const SearchNoMatch: Story = {
  ...seeded(manyProjects(), 'proj-0'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByTestId('project-switcher-search'), 'zzz')
  }
}

export const Loading: Story = {
  decorators: [
    (story) => ({
      components: { story },
      setup() {
        useProjectStore().receiveLoading()
      },
      template: '<story />'
    })
  ]
}

export const LoadFailed: Story = {
  decorators: [
    (story) => ({
      components: { story },
      setup() {
        useProjectStore().receiveError()
      },
      template: '<story />'
    })
  ]
}
