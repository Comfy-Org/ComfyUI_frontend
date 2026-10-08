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

type Catalog = 'confirmed' | 'unconfirmed' | 'disabled' | 'another scope'

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

function renderReference({
  catalog = 'confirmed',
  packs = [],
  description = 'Original description'
}: {
  catalog?: Catalog
  packs?: SkillPack[]
  description?: string
}) {
  Object.assign(useSkillPacksStore(), {
    flagsEnabled: catalog !== 'disabled',
    catalogConfirmed: catalog !== 'unconfirmed',
    packs
  })
  render(CatalogSkillReference, {
    props: {
      skill: { name: 'old-name', description },
      scope: catalog === 'another scope' ? 'another-workspace' : undefined
    },
    global: { plugins: [i18n] }
  })
  return screen.getByTestId('skill-reference')
}

async function expectAvailability(
  reference: HTMLElement,
  expected: 'available' | 'unavailable' | 'checking'
) {
  const unavailable = expected === 'unavailable'
  expect(reference).toHaveTextContent(/^\/old-name$/)
  expect(reference).toHaveClass(
    'underline',
    unavailable ? 'text-muted-foreground' : 'text-warning-background'
  )
  if (unavailable)
    expect(reference).toHaveAccessibleDescription('Not available')
  else expect(reference).not.toHaveAttribute('aria-description')
  await userEvent.hover(reference)
  expect(await screen.findByRole('tooltip')).toHaveTextContent(
    unavailable ? /^Not available$/ : /^Original description$/
  )
  await userEvent.unhover(reference)
}

const sameName = pack('current-id', 'old-name')
const renamed = pack('current-id', 'new-name')

it.for([
  {
    when: 'the catalog has its name',
    packs: [sameName],
    expected: 'available'
  },
  {
    when: 'its skill was renamed',
    packs: [renamed],
    expected: 'unavailable'
  },
  { when: 'the catalog lacks its name', expected: 'unavailable' },
  {
    when: 'the catalog is unconfirmed',
    catalog: 'unconfirmed',
    expected: 'checking'
  },
  {
    when: 'skills are disabled',
    catalog: 'disabled',
    expected: 'checking'
  },
  {
    when: 'the catalog belongs to another scope',
    catalog: 'another scope',
    expected: 'checking'
  }
] satisfies {
  when: string
  catalog?: Catalog
  packs?: SkillPack[]
  expected: 'available' | 'unavailable' | 'checking'
}[])('shows a reference as $expected when $when', async (scenario) => {
  await expectAvailability(renderReference(scenario), scenario.expected)
})

it('shows a skill deleted then recreated with the same name as available again', async () => {
  const reference = renderReference({ packs: [sameName] })
  await expectAvailability(reference, 'available')
  const skills = useSkillPacksStore()
  skills.packs = []
  await nextTick()
  await expectAvailability(reference, 'unavailable')
  skills.packs = [pack('recreated-id', 'old-name')]
  await nextTick()
  await expectAvailability(reference, 'available')
})

it.for([
  { availability: 'available', packs: [sameName], tooltip: undefined },
  { availability: 'unavailable', packs: [], tooltip: /^Not available$/ }
])(
  'shows only the availability line on hover of a description-less $availability reference',
  async ({ packs, tooltip }) => {
    const reference = renderReference({ packs, description: '' })
    await userEvent.hover(reference)
    await waitFor(() => expect(reference).toHaveAttribute('data-state', 'open'))
    if (tooltip) expect(screen.getByRole('tooltip')).toHaveTextContent(tooltip)
    else expect(screen.queryByRole('tooltip')).toBeNull()
  }
)
