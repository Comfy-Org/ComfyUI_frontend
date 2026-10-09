import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillPack } from '@/platform/skills/types'
import CatalogSkillReference from './CatalogSkillReference.vue'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/telemetry/reportError'))

function pack(id: string, name: string): SkillPack {
  return {
    id,
    name,
    description: 'Current description',
    body: '',
    body_hash: '',
    created_at: '',
    updated_at: ''
  }
}

type ReferenceSetup = {
  flagsEnabled?: boolean
  catalogConfirmed?: boolean
  scope?: string
  packs?: SkillPack[]
  description?: string
}

function renderReference({
  flagsEnabled = true,
  catalogConfirmed = true,
  scope,
  packs = [],
  description = 'Original description'
}: ReferenceSetup) {
  Object.assign(useSkillPacksStore(), {
    flagsEnabled,
    catalogConfirmed,
    packs
  })
  render(CatalogSkillReference, {
    props: {
      skill: { name: 'old-name', description },
      scope
    },
    global: { plugins: [i18n] }
  })
  return screen.getByTestId('skill-reference')
}

const sameName = pack('current-id', 'old-name')
const renamed = pack('current-id', 'new-name')

it.for([
  {
    when: 'the catalog has its name',
    packs: [sameName],
    expected: 'available',
    accessibleDescription: ''
  },
  {
    when: 'its skill was renamed',
    packs: [renamed],
    expected: 'unavailable',
    accessibleDescription: 'Not available'
  },
  {
    when: 'the catalog lacks its name',
    expected: 'unavailable',
    accessibleDescription: 'Not available'
  },
  {
    when: 'the catalog is unconfirmed',
    catalogConfirmed: false,
    expected: 'checking',
    accessibleDescription: ''
  },
  {
    when: 'skills are disabled',
    flagsEnabled: false,
    expected: 'checking',
    accessibleDescription: ''
  },
  {
    when: 'the catalog belongs to another scope',
    scope: 'another-workspace',
    expected: 'checking',
    accessibleDescription: ''
  }
])('shows a reference as $expected when $when', (scenario) => {
  const reference = renderReference(scenario)
  expect(reference).toHaveTextContent(/^\/old-name$/)
  expect(reference).toHaveClass('underline')
  expect(reference).toHaveAccessibleDescription(scenario.accessibleDescription)
})

it('shows a deleted reference as available again once a skill with its name is recreated', async () => {
  const reference = renderReference({})
  expect(reference).toHaveAccessibleDescription('Not available')
  useSkillPacksStore().packs = [pack('recreated-id', 'old-name')]
  await nextTick()
  expect(reference).toHaveAccessibleDescription('')
})

it.for([
  {
    packs: [sameName],
    description: 'Original description',
    tooltips: ['Original description']
  },
  {
    packs: [],
    description: 'Original description',
    tooltips: ['Not available']
  },
  { packs: [sameName], description: '', tooltips: [] },
  { packs: [], description: '', tooltips: ['Not available'] }
])(
  'shows $tooltips on hover of a reference described as "$description"',
  async ({ packs, description, tooltips }) => {
    const reference = renderReference({ packs, description })
    await userEvent.hover(reference)
    await waitFor(() => expect(reference).toHaveAttribute('data-state', 'open'))
    expect(
      screen.queryAllByRole('tooltip').map((tooltip) => tooltip.textContent)
    ).toEqual(tooltips)
  }
)
