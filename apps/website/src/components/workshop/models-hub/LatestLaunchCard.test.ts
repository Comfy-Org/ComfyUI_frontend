import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
import LatestLaunchCard from './LatestLaunchCard.vue'

const launch: WorkshopModel = {
  slug: 'byteplus--seedance-2-5-text-to-video--generate-videos',
  name: 'Seedance 2.5 Text-to-Video',
  summary: 'Generates a 4-30 second 480p or 720p MP4.',
  workflowCount: 1,
  href: '/models/seedance-2-5/',
  routerId: 'byteplus/seedance-2-5',
  capabilities: ['byteplus', 'seedance', 'seedance-2.5', 'text-to-video'],
  provider: 'ByteDance',
  modality: 'video',
  task: 'text-to-video'
}

function chips() {
  return screen
    .getAllByText(/^(Text to Video|Run|API)$/)
    .map((chip) => chip.textContent.trim())
}

describe('LatestLaunchCard', () => {
  it('links the title and a Try button to the model page, never one inside the other', () => {
    vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
    render(LatestLaunchCard, { props: { model: launch } })

    const title = screen.getByRole('link', {
      name: 'Seedance 2.5 Text-to-Video'
    })
    const tryLink = screen.getByRole('link', {
      name: 'Try Seedance 2.5 Text-to-Video'
    })
    expect(title).toHaveAttribute('href', '/models/seedance-2-5/')
    expect(tryLink).toHaveAttribute('href', '/models/seedance-2-5/')
    expect(tryLink).toHaveTextContent(/^Try$/)
    expect(title).not.toContainElement(tryLink)
    expect(tryLink).not.toContainElement(title)
    expect(screen.getByText('Latest launch')).toBeTruthy()
  })

  it('shows only the task, without Run, API or its raw tags', () => {
    render(LatestLaunchCard, { props: { model: launch } })

    expect(chips()).toEqual(['Text to Video'])
    expect(screen.queryByText('seedance-2.5')).toBeNull()
    expect(screen.queryByText('byteplus')).toBeNull()
  })
})
