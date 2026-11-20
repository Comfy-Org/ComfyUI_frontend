import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fromPartial } from '@total-typescript/shoehorn'
import { markRaw } from 'vue'

import Tabs from '@comfyorg/design-system/tabs/Tabs'
import TabsList from '@comfyorg/design-system/tabs/TabsList'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import WorkflowTab from './WorkflowTab.vue'

type WorkflowOption = {
  value: string
  workflow: LoadedComfyWorkflow
}

function makeWorkflowOption(
  path: string,
  filename: string,
  extras: Partial<LoadedComfyWorkflow> = {}
): WorkflowOption {
  const workflow = fromPartial<LoadedComfyWorkflow>({
    key: path,
    path,
    filename,
    isPersisted: extras.isPersisted ?? true,
    isModified: extras.isModified ?? false,
    activeMode: 'graph',
    ...extras
  })
  return { value: path, workflow: markRaw(workflow) }
}

const targetOption = makeWorkflowOption(
  'workflows/untitled.json',
  'Untitled workflow',
  { isPersisted: false }
)

const neighborOptions: WorkflowOption[] = [
  makeWorkflowOption(
    'workflows/image_krea2_turbo_t2i.json',
    'image_krea2_turbo_t2i',
    { isModified: true }
  ),
  targetOption,
  makeWorkflowOption(
    'workflows/api_nano_banana_2_1_t2i.json',
    'api_nano_banana_2_1_t2i',
    { isModified: true }
  )
]

function bindTargetTab() {
  const workflowStore = useWorkflowStore()
  for (const option of neighborOptions) {
    if (
      !workflowStore.openWorkflows.some(
        (workflow) => workflow.path === option.workflow.path
      )
    )
      workflowStore.attachWorkflow(
        option.workflow,
        workflowStore.openWorkflows.length
      )
  }
  workflowStore.activeWorkflow = targetOption.workflow
  const panel = useAgentPanelStore()
  panel.enabled = true
  panel.setWorkflowTarget(targetOption.workflow)
}

const meta: Meta<typeof WorkflowTab> = {
  title: 'Components/Topbar/WorkflowTab',
  component: WorkflowTab,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    workflowOption: targetOption,
    isFirst: false,
    isLast: false,
    compact: false
  },
  decorators: [
    () => ({
      template: '<div class="h-9.5 w-full bg-background px-1"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { Tabs, TabsList, WorkflowTab },
    setup() {
      bindTargetTab()
      return { args, path: args.workflowOption.workflow.path }
    },
    template: `
      <Tabs :model-value="path" class="h-full">
        <TabsList class="h-full flex-nowrap gap-1">
          <WorkflowTab v-bind="args" />
        </TabsList>
      </Tabs>
    `
  })
}

export const TargetTab: Story = {
  render: () => ({
    components: { Tabs, TabsList, WorkflowTab },
    setup() {
      bindTargetTab()
      return {
        neighborOptions,
        targetPath: targetOption.workflow.path
      }
    },
    template: `
      <Tabs :model-value="targetPath" class="h-full">
        <TabsList class="workflow-tabs h-full flex-nowrap gap-1">
          <WorkflowTab
            v-for="(option, index) in neighborOptions"
            :key="option.value"
            :workflow-option="option"
            :is-first="index === 0"
            :is-last="index === neighborOptions.length - 1"
          />
        </TabsList>
      </Tabs>
    `
  })
}
