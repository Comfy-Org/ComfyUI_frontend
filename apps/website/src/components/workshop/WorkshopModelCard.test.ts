// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/workshop'
import WorkshopModelCard from './WorkshopModelCard.vue'

const base: WorkshopModel = {
  slug: 'flux',
  name: 'Flux',
  workflowCount: 2,
  href: '/workshop/models/flux/',
  routerId: 'bfl/flux',
  capabilities: [],
  provider: 'Black Forest Labs',
  modality: 'image'
}

describe('WorkshopModelCard price', () => {
  it('prefers the USD starting price', () => {
    render(WorkshopModelCard, {
      props: { model: { ...base, priceUsdFrom: 0.04, creditsPerRun: 8 } }
    })
    expect(screen.getByText('from $0.04')).toBeTruthy()
    expect(screen.queryByText('from 8 credits')).toBeNull()
  })

  it('falls back to credits per run', () => {
    render(WorkshopModelCard, {
      props: { model: { ...base, creditsPerRun: 8 } }
    })
    expect(screen.getByText('from 8 credits')).toBeTruthy()
  })

  it('shows no price when neither is known', () => {
    render(WorkshopModelCard, { props: { model: base } })
    expect(screen.queryByText(/credits|\$/)).toBeNull()
  })
})
