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

type ReferenceExpectation = {
  colorClass: 'text-warning-background' | 'text-muted-foreground'
  accessibleDescription: '' | 'Not available'
  tooltip: RegExp
}

async function expectReference(
  reference: HTMLElement,
  { colorClass, accessibleDescription, tooltip }: ReferenceExpectation
) {
  expect(reference).toHaveTextContent(/^\/old-name$/)
  expect(reference).toHaveClass('underline', colorClass)
  expect(reference).toHaveAccessibleDescription(accessibleDescription)
  await userEvent.hover(reference)
  expect(await screen.findByRole('tooltip')).toHaveTextContent(tooltip)
  await userEvent.unhover(reference)
}

const sameName = pack('current-id', 'old-name')
const renamed = pack('current-id', 'new-name')

it.for([
  {
    when: 'the catalog has its name',
    packs: [sameName],
    expected: 'available',
    colorClass: 'text-warning-background',
    accessibleDescription: '',
    tooltip: /^Original description$/
  },
  {
    when: 'its skill was renamed',
    packs: [renamed],
    expected: 'unavailable',
    colorClass: 'text-muted-foreground',
    accessibleDescription: 'Not available',
    tooltip: /^Not available$/
  },
  {
    when: 'the catalog lacks its name',
    expected: 'unavailable',
    colorClass: 'text-muted-foreground',
    accessibleDescription: 'Not available',
    tooltip: /^Not available$/
  },
  {
    when: 'the catalog is unconfirmed',
    catalogConfirmed: false,
    expected: 'checking',
    colorClass: 'text-warning-background',
    accessibleDescription: '',
    tooltip: /^Original description$/
  },
  {
    when: 'skills are disabled',
    flagsEnabled: false,
    expected: 'checking',
    colorClass: 'text-warning-background',
    accessibleDescription: '',
    tooltip: /^Original description$/
  },
  {
    when: 'the catalog belongs to another scope',
    scope: 'another-workspace',
    expected: 'checking',
    colorClass: 'text-warning-background',
    accessibleDescription: '',
    tooltip: /^Original description$/
  }
] satisfies (ReferenceSetup &
  ReferenceExpectation & {
    when: string
    expected: 'available' | 'unavailable' | 'checking'
  })[])('shows a reference as $expected when $when', async (scenario) => {
  await expectReference(renderReference(scenario), scenario)
})

it('shows a skill deleted then recreated with the same name as available again', async () => {
  const reference = renderReference({ packs: [sameName] })
  await expectReference(reference, {
    colorClass: 'text-warning-background',
    accessibleDescription: '',
    tooltip: /^Original description$/
  })
  const skills = useSkillPacksStore()
  skills.packs = []
  await nextTick()
  await expectReference(reference, {
    colorClass: 'text-muted-foreground',
    accessibleDescription: 'Not available',
    tooltip: /^Not available$/
  })
  skills.packs = [pack('recreated-id', 'old-name')]
  await nextTick()
  await expectReference(reference, {
    colorClass: 'text-warning-background',
    accessibleDescription: '',
    tooltip: /^Original description$/
  })
})

it.for([
  {
    availability: 'available',
    packs: [sameName],
    shows: 'no tooltip',
    tooltips: []
  },
  {
    availability: 'unavailable',
    packs: [],
    shows: 'only the availability line',
    tooltips: ['Not available']
  }
])(
  'shows $shows on hover of a description-less $availability reference',
  async ({ packs, tooltips }) => {
    const reference = renderReference({ packs, description: '' })
    await userEvent.hover(reference)
    await waitFor(() => expect(reference).toHaveAttribute('data-state', 'open'))
    expect(
      screen.queryAllByRole('tooltip').map((tooltip) => tooltip.textContent)
    ).toEqual(tooltips)
  }
)
