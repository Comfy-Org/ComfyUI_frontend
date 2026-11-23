import type { Meta, StoryObj } from '@storybook/vue3-vite'

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
type ProjectList = typeof listProjectsByRole.owner

function seeded(list: ProjectList, selectedId?: string): Story {
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

function manyProjects(): ProjectList {
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
