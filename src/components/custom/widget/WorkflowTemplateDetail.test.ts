import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { TemplateDetailGroup } from '@/platform/workflow/templates/types/templateDetail'

import WorkflowTemplateDetail from './WorkflowTemplateDetail.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const groups = [
  {
    id: 'models',
    label: 'Models',
    total: '30 GB',
    rows: [
      {
        id: 'model:checkpoint',
        name: 'wan2.2_i2v_high_noise_14B_fp16.safetensors',
        description: 'Checkpoint · Used by Load Checkpoint'
      },
      {
        id: 'model:text-encoder',
        name: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
        description: 'Text encoder · Used by CLIP Text Encode'
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
  renderedGroups?: readonly TemplateDetailGroup[]
  cloudUrl?: string
  isPartnerNode?: boolean
  openPending?: boolean
} = {}) {
  return render(WorkflowTemplateDetail, {
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
  it('presents only declared model requirements', () => {
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

  it('presents installed, manual, unavailable, and unknown model states', () => {
    const renderedGroups = [
      {
        id: 'model-statuses',
        label: 'Model statuses',
        rows: [
          {
            id: 'installed-model',
            name: 'installed.safetensors',
            description: 'Checkpoint · 1 GB',
            status: { kind: 'installed', label: 'Installed' }
          },
          {
            id: 'manual-model',
            name: 'manual.safetensors',
            description: 'Checkpoint · 2 GB',
            status: {
              kind: 'manual',
              label: 'Get it manually',
              href: 'https://huggingface.co/org/gated-model'
            }
          },
          {
            id: 'unavailable-model',
            name: 'unavailable.safetensors',
            description: 'Checkpoint',
            status: {
              kind: 'unavailable',
              label: 'Unavailable'
            }
          },
          {
            id: 'unknown-model',
            name: 'unknown.safetensors',
            description: 'Checkpoint',
            status: { kind: 'unknown', label: 'Unknown' }
          }
        ]
      }
    ] as const

    renderDetail({ renderedGroups })

    expect(screen.getByRole('img', { name: 'Installed' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Get it manually/ })
    ).toHaveAttribute('href', 'https://huggingface.co/org/gated-model')
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('emits the exact row id for a model download and failed retry', async () => {
    const user = userEvent.setup()
    const renderedGroups = [
      {
        id: 'model-actions',
        label: 'Model actions',
        rows: [
          {
            id: 'download-this-model',
            name: 'downloadable.safetensors',
            description: 'Checkpoint',
            status: { kind: 'downloadable', label: 'Download model' }
          },
          {
            id: 'retry-this-model',
            name: 'failed.safetensors',
            description: 'Diffusion model',
            status: {
              kind: 'downloadable',
              label: 'Download model',
              downloadState: {
                status: 'failed',
                attempt: 1,
                reason: 'error'
              }
            }
          }
        ]
      }
    ] as const
    const { emitted } = renderDetail({ renderedGroups })

    await user.click(
      screen.getByRole('button', { name: 'Download downloadable.safetensors' })
    )
    const retry = screen.getByRole('button', {
      name: 'Retry download for failed.safetensors'
    })
    expect(retry).toHaveTextContent('Retry')
    await user.click(retry)

    expect(emitted()['download-model']).toEqual([
      ['download-this-model'],
      ['retry-this-model']
    ])
  })

  it('keeps queued and starting handoff states non-interactive', () => {
    const renderedGroups = [
      {
        id: 'passive-states',
        label: 'Passive states',
        rows: [
          {
            id: 'queued-model',
            name: 'queued.safetensors',
            description: 'Checkpoint',
            status: {
              kind: 'downloadable',
              label: 'Download queued model',
              downloadState: { status: 'queued', attempt: 1 }
            }
          },
          {
            id: 'starting-model',
            name: 'starting.safetensors',
            description: 'Checkpoint',
            status: {
              kind: 'downloadable',
              label: 'Download starting model',
              downloadState: { status: 'starting', attempt: 1 }
            }
          }
        ]
      }
    ] as const
    renderDetail({ renderedGroups })

    for (const label of ['Queued', 'Starting']) {
      expect(screen.getByText(label)).toHaveAttribute('role', 'status')
    }
    expect(
      screen.queryByRole('button', { name: /^(Download|Retry)/ })
    ).not.toBeInTheDocument()
  })

  it('renders known and unknown download progress without inventing a percentage', () => {
    const renderedGroups = [
      {
        id: 'download-progress',
        label: 'Download progress',
        rows: [
          {
            id: 'known-progress',
            name: 'known.safetensors',
            description: 'Checkpoint',
            status: {
              kind: 'downloadable',
              label: 'Download known model',
              downloadState: {
                status: 'downloading',
                attempt: 1,
                activity: 'active',
                receivedBytes: 1024,
                totalBytes: 4096,
                fraction: 0.25
              }
            }
          },
          {
            id: 'unknown-progress',
            name: 'unknown.safetensors',
            description: 'Checkpoint',
            status: {
              kind: 'downloadable',
              label: 'Download unknown model',
              downloadState: {
                status: 'downloading',
                attempt: 1,
                activity: 'active',
                receivedBytes: null,
                totalBytes: null,
                fraction: null
              }
            }
          }
        ]
      }
    ] as const
    renderDetail({ renderedGroups })

    const knownProgress = screen.getByRole('progressbar', {
      name: 'Downloading known.safetensors'
    })
    expect(knownProgress).toHaveAttribute('aria-valuenow', '25')
    expect(knownProgress).toHaveAttribute('aria-valuetext', '1 KB / 4 KB')
    expect(screen.getByText('1 KB / 4 KB')).toBeInTheDocument()

    const unknownProgress = screen.getByRole('progressbar', {
      name: 'Downloading unknown.safetensors'
    })
    expect(unknownProgress).not.toHaveAttribute('aria-valuenow')
    expect(unknownProgress).toHaveAttribute('aria-valuetext', 'Downloading')
  })

  it('keeps paused progress truthful and presents completion as final', () => {
    const renderedGroups = [
      {
        id: 'terminal-states',
        label: 'Terminal states',
        rows: [
          {
            id: 'paused-model',
            name: 'paused.safetensors',
            description: 'Checkpoint',
            status: {
              kind: 'downloadable',
              label: 'Download paused model',
              downloadState: {
                status: 'downloading',
                attempt: 1,
                activity: 'paused',
                receivedBytes: 512,
                totalBytes: 1024,
                fraction: 0.5
              }
            }
          },
          {
            id: 'paused-unknown-model',
            name: 'paused-unknown.safetensors',
            description: 'Checkpoint',
            status: {
              kind: 'downloadable',
              label: 'Download paused unknown model',
              downloadState: {
                status: 'downloading',
                attempt: 1,
                activity: 'paused',
                receivedBytes: null,
                totalBytes: null,
                fraction: null
              }
            }
          },
          {
            id: 'done-model',
            name: 'done.safetensors',
            description: 'Checkpoint',
            status: {
              kind: 'downloadable',
              label: 'Download done model',
              downloadState: { status: 'done', attempt: 1 }
            }
          }
        ]
      }
    ] as const
    renderDetail({ renderedGroups })

    const paused = screen.getByRole('progressbar', {
      name: 'Paused download for paused.safetensors'
    })
    expect(paused).toHaveAttribute('aria-valuenow', '50')
    expect(paused).toHaveAttribute('aria-valuetext', 'Paused · 512 B / 1 KB')
    expect(screen.getByText('Paused · 512 B / 1 KB')).toBeInTheDocument()
    const pausedUnknown = screen.getByRole('progressbar', {
      name: 'Paused download for paused-unknown.safetensors'
    })
    expect(pausedUnknown).not.toHaveAttribute('aria-valuenow')
    expect(pausedUnknown).toHaveAttribute('aria-valuetext', 'Paused')
    expect(
      screen.getByRole('status', { name: 'Downloaded' })
    ).toHaveTextContent('Downloaded')
  })
})
