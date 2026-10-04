import type { Meta, StoryObj } from '@storybook/vue3-vite'

import WorkflowTemplateDetail from '@/components/custom/widget/WorkflowTemplateDetail.vue'
import type { TemplateDetailGroup } from '@/platform/workflow/templates/types/templateDetail'

const meta: Meta<typeof WorkflowTemplateDetail> = {
  title: 'Components/Templates/WorkflowTemplateDetail',
  component: WorkflowTemplateDetail,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

/** Stands in for the template thumbnail the dialog passes through this slot. */
const withPreview = (args: Record<string, unknown>) => ({
  components: { WorkflowTemplateDetail },
  setup: () => ({ args }),
  template: `
    <div style="height: 640px">
      <WorkflowTemplateDetail v-bind="args">
        <template #preview>
          <div
            style="aspect-ratio: 16 / 10; display: grid; place-items: center;
                   background: linear-gradient(135deg, #e5e7eb, #cbd5e1);
                   color: #64748b; font-size: 13px"
          >
            Template preview
          </div>
        </template>
      </WorkflowTemplateDetail>
    </div>
  `
})

const nodes: TemplateDetailGroup = {
  id: 'nodes',
  label: 'Nodes',
  total: '3 nodes',
  rows: [
    { id: 'n1', name: 'Load Checkpoint', description: 'Core' },
    { id: 'n2', name: 'KSampler', description: 'Core' },
    { id: 'n3', name: 'VAE Decode', description: 'Core' }
  ]
}

function models(
  downloadable: boolean,
  total = '2 models'
): TemplateDetailGroup {
  return {
    id: 'models',
    label: 'Models',
    total,
    rows: [
      {
        id: 'm1',
        name: 'sd_xl_base_1.0.safetensors',
        description: 'checkpoints',
        status: downloadable
          ? {
              kind: 'downloadable',
              label: 'Download model',
              downloadState: { status: 'idle', attempt: 0 }
            }
          : { kind: 'installed', label: 'Downloaded' }
      },
      {
        id: 'm2',
        name: 'sdxl_vae.safetensors',
        description: 'vae',
        status: { kind: 'installed', label: 'Downloaded' }
      }
    ]
  }
}

/** While resolving, no row has a resolved status yet. */
const unresolvedModels: TemplateDetailGroup = {
  id: 'models',
  label: 'Models',
  total: '2 models',
  rows: [
    {
      id: 'm1',
      name: 'sd_xl_base_1.0.safetensors',
      description: 'checkpoints'
    },
    { id: 'm2', name: 'sdxl_vae.safetensors', description: 'vae' }
  ]
}

const base = {
  title: 'SDXL Text to Image',
  description:
    'Generate an image from a text prompt with the SDXL base checkpoint.'
}

/** Nothing is missing, so the only action opens the template. */
export const OpenNow: Story = {
  args: { ...base, groups: [nodes, models(false)], modelSetupState: 'none' },
  render: withPreview
}

/** Availability is not known yet, so no download action is offered. */
export const Resolving: Story = {
  args: {
    ...base,
    groups: [nodes, unresolvedModels],
    modelSetupState: 'resolving'
  },
  render: withPreview
}

/** A missing model adds the bulk action and the per-row action beside it. */
export const DownloadableRow: Story = {
  args: {
    ...base,
    groups: [nodes, models(true)],
    modelSetupState: 'downloadable'
  },
  render: withPreview
}
