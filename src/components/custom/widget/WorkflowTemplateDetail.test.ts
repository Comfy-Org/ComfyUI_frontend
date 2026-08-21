import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Component } from 'vue'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

const componentPath = './WorkflowTemplateDetail.vue'
const componentModule: unknown = await import(componentPath).catch(
  () => undefined
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function hasDefaultComponent(value: unknown): value is { default: Component } {
  return isRecord(value) && 'default' in value
}

const WorkflowTemplateDetail = hasDefaultComponent(componentModule)
  ? componentModule.default
  : defineComponent({ template: '<div />' })

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      templateWorkflows: {
        detail: {
          cloudUpsellTitle: 'Run this template in Comfy Cloud',
          cloudUpsellDescription:
            'Run faster on Cloud GPUs. No local setup or downloads.',
          partnerNodeTitle: 'This workflow uses Partner Nodes',
          partnerNodeDescription:
            'Run locally with Comfy Credits, or run in Comfy Cloud with a subscription.',
          openInCloud: 'Open in Cloud',
          requirements: 'Template requirements',
          openTemplate: 'Open template'
        }
      }
    }
  }
})

const groups = [
  {
    id: 'models',
    label: 'Models',
    total: '30 GB',
    rows: [
      {
        id: 'model:checkpoint',
        kind: 'model',
        name: 'wan2.2_i2v_high_noise_14B_fp16.safetensors',
        description: 'Checkpoint · Used by Load Checkpoint'
      },
      {
        id: 'model:text-encoder',
        kind: 'model',
        name: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
        description: 'Text encoder · Used by CLIP Text Encode'
      }
    ]
  },
  {
    id: 'custom-nodes',
    label: 'Custom Nodes',
    rows: [
      {
        id: 'custom-node:ComfyUI-KJNodes',
        kind: 'custom-node',
        name: 'ComfyUI-KJNodes',
        description: 'Required custom node package'
      }
    ]
  }
] as const

function renderDetail({
  renderedGroups = groups,
  cloudUrl,
  isPartnerNode = false,
  openPending = false
}: {
  renderedGroups?: readonly unknown[]
  cloudUrl?: string
  isPartnerNode?: boolean
  openPending?: boolean
} = {}) {
  return render(WorkflowTemplateDetail as Component, {
    props: {
      title: 'Wan 2.2 Image to Video',
      description: 'Create a video from a starting image.',
      groups: renderedGroups,
      cloudUrl,
      isPartnerNode,
      openPending
    },
    slots: {
      preview: '<img src="/thumbnail.webp" alt="Wan 2.2 workflow preview" />'
    },
    global: { plugins: [i18n] }
  })
}

describe('WorkflowTemplateDetail', () => {
  it('presents only declared model and custom-node requirements', () => {
    renderDetail()

    const detail = screen.getByRole('article', {
      name: 'Wan 2.2 Image to Video'
    })
    expect(
      within(detail).getByRole('img', { name: 'Wan 2.2 workflow preview' })
    ).toHaveAttribute('src', '/thumbnail.webp')
    expect(
      within(detail).getByRole('heading', {
        name: 'Wan 2.2 Image to Video',
        level: 2
      })
    ).toBeInTheDocument()
    expect(
      within(detail).getByText('Create a video from a starting image.')
    ).toBeInTheDocument()

    const requirements = within(detail).getByRole('region', {
      name: 'Template requirements'
    })
    const models = within(requirements).getByRole('region', { name: 'Models' })
    expect(within(models).getAllByRole('listitem')).toHaveLength(2)
    expect(within(models).getByText('2')).toBeInTheDocument()
    expect(within(models).getByText('30 GB')).toBeInTheDocument()
    expect(
      within(models).getByText('Checkpoint · Used by Load Checkpoint')
    ).toBeInTheDocument()

    const customNodes = within(requirements).getByRole('region', {
      name: 'Custom Nodes'
    })
    expect(within(customNodes).getAllByRole('listitem')).toHaveLength(1)
    expect(
      within(customNodes).getByText('Required custom node package')
    ).toBeInTheDocument()

    expect(within(detail).queryByText('Installed')).not.toBeInTheDocument()
    expect(within(detail).queryByText('Unknown')).not.toBeInTheDocument()
    expect(within(detail).queryByText('Input Assets')).not.toBeInTheDocument()
    expect(within(detail).queryByText(/left$/i)).not.toBeInTheDocument()
    expect(within(detail).getAllByRole('button')).toHaveLength(1)
    expect(
      within(detail).getByRole('button', { name: 'Open template' })
    ).toBeInTheDocument()
  })

  it('emits the sole launch action and disables it while opening', async () => {
    const user = userEvent.setup()
    const result = renderDetail()

    await user.click(screen.getByRole('button', { name: 'Open template' }))
    expect(result.emitted('open-template')).toEqual([[]])

    await result.rerender({ openPending: true })
    expect(screen.getByRole('button', { name: 'Open template' })).toBeDisabled()
  })

  it('omits the requirements region when nothing is declared', () => {
    renderDetail({ renderedGroups: [] })

    expect(
      screen.queryByRole('region', { name: 'Template requirements' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Open template' })
    ).toBeInTheDocument()
  })

  it('offers a generic Cloud alternative without free-run messaging or an icon', () => {
    renderDetail({
      renderedGroups: [],
      cloudUrl: 'https://cloud.comfy.org/?template=video_wan2_2_14B_i2v'
    })

    const cloudAlternative = screen.getByRole('region', {
      name: 'Run this template in Comfy Cloud'
    })
    expect(cloudAlternative).toHaveTextContent(
      'Run faster on Cloud GPUs. No local setup or downloads.'
    )
    const link = within(cloudAlternative).getByRole('link', {
      name: 'Open in Cloud'
    })
    expect(link).toHaveAttribute(
      'href',
      'https://cloud.comfy.org/?template=video_wan2_2_14B_i2v'
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByText(/free runs?/i)).not.toBeInTheDocument()
  })

  it('explains the local-credit and Cloud-subscription Partner Node policy', () => {
    renderDetail({
      renderedGroups: [],
      cloudUrl: 'https://cloud.comfy.org/?template=api_seedance2_5_t2v',
      isPartnerNode: true
    })

    const partnerAlternative = screen.getByRole('region', {
      name: 'This workflow uses Partner Nodes'
    })
    expect(partnerAlternative).toHaveTextContent(
      'Run locally with Comfy Credits, or run in Comfy Cloud with a subscription.'
    )
    expect(
      within(partnerAlternative).getByRole('link', { name: 'Open in Cloud' })
    ).toBeInTheDocument()
  })
})
