import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref, nextTick } from 'vue'
import type { Ref } from 'vue'

import type { WorkshopBrowseModel } from '../../config/workshop'
import {
  useWorkshopEnabled,
  useWorkshopEnabledSettled
} from '../../scripts/posthog'
import WorkshopSection from './WorkshopSection.vue'

vi.mock(import('../../scripts/posthog'))

let enabled: Ref<boolean>
let settled: Ref<boolean>

beforeEach(() => {
  enabled = ref(true)
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(enabled))
  settled = ref(true)
  vi.mocked(useWorkshopEnabledSettled).mockReturnValue(readonly(settled))
})

const models: WorkshopBrowseModel[] = [
  {
    id: 'bfl/flux-2-pro',
    href: '/workshop/models/bfl--flux-2-pro/',
    name: 'FLUX 2 Pro',
    provider: 'bfl',
    output: 'image',
    description: 'Generates an image.',
    tags: ['text-to-image']
  },
  {
    id: 'kling/text-to-video',
    href: '/workshop/models/kling--text-to-video/',
    name: 'Kling 2.5 Turbo',
    provider: 'kling',
    output: 'video',
    description: 'Generates a video.',
    tags: []
  }
]

async function renderSection() {
  render(WorkshopSection, { props: { models } })
  await nextTick()
}

describe('WorkshopSection', async () => {
  it('keeps featured models unavailable until enabled and hides them on revocation', async () => {
    enabled.value = false
    await renderSection()
    expect(screen.queryByText('Browse all models')).toBeNull()
    expect(screen.queryByText('FLUX 2 Pro')).toBeNull()

    enabled.value = true
    await nextTick()
    expect(screen.getByRole('link', { name: 'Browse all models' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /FLUX 2 Pro/ })).toBeTruthy()

    enabled.value = false
    await nextTick()
    expect(screen.queryByRole('link', { name: 'Browse all models' })).toBeNull()
    expect(screen.queryByRole('link', { name: /FLUX 2 Pro/ })).toBeNull()
  })

  it('links each featured model to its own page', async () => {
    await renderSection()

    expect(
      screen.getByRole('link', { name: /FLUX 2 Pro/ }).getAttribute('href')
    ).toBe('/workshop/models/bfl--flux-2-pro/')
    expect(
      screen.getByRole('link', { name: /Kling 2.5 Turbo/ }).getAttribute('href')
    ).toBe('/workshop/models/kling--text-to-video/')
  })

  it('offers a way through to the whole catalog', async () => {
    await renderSection()

    expect(
      screen
        .getByRole('link', { name: 'Browse all models' })
        .getAttribute('href')
    ).toBe('/workshop/')
  })

  it('shows what each model produces alongside who makes it', async () => {
    await renderSection()

    const card = screen.getByRole('link', { name: /FLUX 2 Pro/ })
    expect(card.textContent).toContain('bfl')
    expect(card.textContent).toContain('image')
    expect(card.textContent).toContain('Generates an image.')
  })
})
