// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import type { AccountCredential } from '@comfyorg/account/core'

import type { WorkshopModelDetail } from '../../config/models-catalogue'
import ModelDetail from './ModelDetail.vue'

const auth = vi.hoisted(() => ({
  session: { value: undefined as AccountCredential | undefined }
}))

vi.mock('../../config/workshop-session-state', () => ({
  useWorkshopSession: () => ({ session: auth.session })
}))

const credential: AccountCredential = {
  token: 'workspace-jwt',
  expiresAt: Date.now() + 60_000,
  uid: 'user-1',
  workspace: { id: 'workspace-1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: []
}

const prompt = {
  kind: 'text',
  name: 'prompt',
  label: 'Prompt',
  multiline: true,
  required: true
} as const

const model: WorkshopModelDetail = {
  slug: 'demo',
  name: 'Demo',
  workflowCount: 1,
  href: '/models/demo/',
  routerId: 'demo/demo',
  capabilities: [],
  runs: 12_000,
  provider: 'Demo',
  modality: 'image',
  task: 'text-to-image',
  creditsPerRun: 8,
  nodeDisplayName: 'Demo Text to Image',
  fields: [prompt],
  defaults: {},
  examples: [
    {
      name: 'flf',
      title: 'Start and end frame',
      description: '',
      tags: [],
      thumbnailUrl: 'https://example.com/flf.webp',
      node: { id: 'DemoFLF', displayName: 'Demo First-Last-Frame' },
      fields: [
        prompt,
        {
          kind: 'file',
          name: 'end_frame',
          label: 'End frame',
          accept: 'image',
          required: true
        }
      ],
      values: { prompt: 'a capybara' },
      // The input the example ran with; the page shows it in the matching
      // file field instead of inventing a stand-in.
      inputs: [{ role: 'end_frame', url: 'https://example.com/pool-end.webp' }]
    }
  ]
}

function mountDetail(options?: {
  clone?: { href: string }
  details?: () => ReturnType<typeof h>
  model?: WorkshopModelDetail
}) {
  render(
    defineComponent({
      setup() {
        return () =>
          h(
            ModelDetail,
            { model: options?.model ?? model, clone: options?.clone },
            options?.details ? { details: options.details } : undefined
          )
      }
    })
  )
}

async function signedInDetail() {
  auth.session.value = credential
  mountDetail()
  await nextTick()
}

const user = () =>
  userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })

describe('ModelDetail', () => {
  beforeEach(() => {
    auth.session.value = undefined
    localStorage.clear()
    sessionStorage.clear()
    vi.useFakeTimers()
  })

  it('sends a signed-out visitor to sign in and come back', async () => {
    history.replaceState(null, '', '/models/demo/?tab=api')
    mountDetail()
    await nextTick()
    const button = screen.getByTestId('run-button')
    expect(button.getAttribute('data-gate')).toBe('signedOut')
    expect(button.getAttribute('href')).toBe(
      '/login/?returnTo=%2Fmodels%2Fdemo%2F%3Ftab%3Dapi'
    )
  })

  it('does not simulate a paid run after real authentication', async () => {
    await signedInDetail()
    const button = screen.getByTestId('run-button')
    expect(button.getAttribute('data-gate')).toBe('unavailable')
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.textContent).toContain(
      'Running models is not connected in this preview'
    )
  })

  it('arrives with the first example loaded and editable', async () => {
    await signedInDetail()
    expect(screen.getByTestId<HTMLTextAreaElement>('field-prompt').value).toBe(
      'a capybara'
    )
    expect(screen.getByText('pool-end.webp')).toBeTruthy()
    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe('example')
  })

  it('shows a Details tab and the clone button when given workflow details', async () => {
    auth.session.value = credential
    mountDetail({
      clone: { href: '/x.json' },
      details: () => h('p', 'About this workflow')
    })
    await nextTick()
    expect(screen.queryByTestId('examples-section')).toBeNull()
    expect(screen.getByTestId('clone-button').getAttribute('href')).toBe(
      '/x.json'
    )
    await user().click(screen.getByTestId('tab-details'))
    expect(screen.getByTestId('details-tab').textContent).toContain(
      'About this workflow'
    )
  })

  it('draws the model picker rather than nothing when it is the only field', async () => {
    const picker = {
      kind: 'select',
      name: 'model',
      label: 'Model',
      options: ['Omni Flash 1.1', 'Omni Flash'],
      default: 'Omni Flash 1.1'
    } as const
    auth.session.value = credential
    mountDetail({
      model: { ...model, fields: [picker], defaults: {}, examples: [] }
    })
    await nextTick()

    expect(screen.getByTestId('field-model')).toBeTruthy()
  })

  it('swaps the form to the example template', async () => {
    await signedInDetail()
    await user().click(screen.getAllByTestId('example-card')[0])

    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe('example')
    expect(screen.getByText('pool-end.webp')).toBeTruthy()
    expect(screen.getByTestId<HTMLTextAreaElement>('field-prompt').value).toBe(
      'a capybara'
    )
  })

  it('renders a declared audio example with audio transport', async () => {
    auth.session.value = credential
    mountDetail({
      model: {
        ...model,
        modality: 'audio',
        examples: [
          {
            ...model.examples[0],
            thumbnailUrl: 'https://cdn.example/asset-without-extension',
            mediaKind: 'audio'
          }
        ]
      }
    })
    await nextTick()

    expect(
      screen.getByLabelText('Start and end frame').getAttribute('src')
    ).toBe('https://cdn.example/asset-without-extension')
  })
})
