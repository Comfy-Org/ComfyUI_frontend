import type { Meta, StoryObj } from '@storybook/vue3-vite'

import WorkflowTemplateDetail from '@/components/custom/widget/WorkflowTemplateDetail.vue'
import { t } from '@/i18n'
import type { TemplateDetailGroup } from '@/platform/workflow/templates/types/templateDetail'

const meta: Meta<typeof WorkflowTemplateDetail> = {
  title: 'Components/Templates/WorkflowTemplateDetail',
  component: WorkflowTemplateDetail,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

const withPreview: NonNullable<Story['render']> = (args) => ({
  components: { WorkflowTemplateDetail },
  setup: () => ({ args }),
  template: `
    <div class="h-160">
      <WorkflowTemplateDetail v-bind="args">
        <template #preview>
          <div
            class="grid aspect-8/5 place-items-center bg-secondary-background text-xs text-muted-foreground"
          >
            Template preview
          </div>
        </template>
      </WorkflowTemplateDetail>
    </div>
  `
})

const checkpoint = {
  id: 'm1',
  name: 'sd_xl_base_1.0.safetensors',
  description: 'Checkpoints · 6.46 GB · Used by Load Checkpoint'
}
const vae = {
  id: 'm2',
  name: 'sdxl_vae.safetensors',
  description: 'VAE · 319.8 MB · Used by VAE Decode'
}

const unsizedCheckpoint = {
  ...checkpoint,
  description: 'Checkpoints · Used by Load Checkpoint'
}
const unsizedVae = { ...vae, description: 'VAE · Used by VAE Decode' }

const installed = {
  kind: 'installed',
  label: t('templateWorkflows.detail.installed')
} as const

/**
 * `buildTemplateDetailGroups` emits one `models` group, and its total only when
 * every declaration carries a size - so the resolving case shows none.
 */
function modelsGroup(
  rows: TemplateDetailGroup['rows'],
  total?: string
): TemplateDetailGroup {
  return {
    id: 'models',
    label: t('templateWorkflows.detail.models'),
    ...(total !== undefined && { total }),
    rows
  }
}

const base = {
  title: 'SDXL Text to Image',
  description:
    'Generate an image from a text prompt with the SDXL base checkpoint.'
}

/**
 * Detail only opens when something is missing, so this state is a missing model
 * that cannot be fetched automatically rather than a template with none.
 */
export const OpenNow: Story = {
  args: {
    ...base,
    groups: [
      modelsGroup(
        [
          {
            ...checkpoint,
            status: {
              kind: 'manual',
              label: t('templateWorkflows.detail.getItManually'),
              href: 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0'
            }
          },
          { ...vae, status: installed }
        ],
        '6.77 GB'
      )
    ],
    modelSetupState: 'none'
  },
  render: withPreview
}

/** Metadata is still resolving, so Download models & open is shown disabled. */
export const Resolving: Story = {
  args: {
    ...base,
    groups: [
      modelsGroup([
        {
          ...unsizedCheckpoint,
          status: {
            kind: 'unknown',
            label: t('templateWorkflows.detail.unknown')
          }
        },
        { ...unsizedVae, status: installed }
      ])
    ],
    modelSetupState: 'resolving'
  },
  render: withPreview
}

export const DownloadableRow: Story = {
  args: {
    ...base,
    groups: [
      modelsGroup(
        [
          {
            ...checkpoint,
            status: {
              kind: 'downloadable',
              label: t('templateWorkflows.detail.downloadModel'),
              downloadState: { status: 'idle', attempt: 0 }
            }
          },
          { ...vae, status: installed }
        ],
        '6.77 GB'
      )
    ],
    modelSetupState: 'downloadable'
  },
  render: withPreview
}
