import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { listProjectsByRole } from '@/platform/workspace/api/__fixtures__/projects'
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
type ListedProject = ProjectList['projects'][number]

function listedAs(
  source: ListedProject,
  id: string,
  name: string
): ListedProject {
  return { ...source, id, name, is_default: false }
}

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

function fewProjects(): ProjectList {
  const owner = listProjectsByRole.owner
  return {
    ...owner,
    projects: [
      owner.projects[0],
      listedAs(
        listProjectsByRole.builder.projects[1],
        'proj-builder',
        'Studio'
      ),
      listedAs(listProjectsByRole.runner.projects[1], 'proj-runner', 'Queue'),
      listedAs(listProjectsByRole.projectAdmin.projects[1], 'proj-admin', 'Ops')
    ]
  }
}

function manyProjects(): ProjectList {
  const owner = listProjectsByRole.owner
  const roleTemplates = [
    listProjectsByRole.builder.projects[1],
    listProjectsByRole.runner.projects[1],
    listProjectsByRole.projectAdmin.projects[1],
    owner.projects[1]
  ]
  return {
    ...owner,
    projects: [
      owner.projects[0],
      ...Array.from({ length: 7 }, (_, index) =>
        listedAs(
          roleTemplates[index % roleTemplates.length],
          `proj-${index}`,
          `Campaign ${index + 1}`
        )
      )
    ]
  }
}

export const FewProjects: Story = seeded(fewProjects(), 'proj-builder')

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
