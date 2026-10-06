import { describe, expect, it } from 'vitest'

import type {
  RouterWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import {
  canCompare,
  compareRows,
  MAX_COMPARED,
  toggleCompared
} from './compare'

function hosted(
  overrides: Partial<RouterWorkshopModel> = {}
): RouterWorkshopModel {
  return {
    slug: 'kling',
    name: 'Kling',
    workflowCount: 0,
    routerId: 'kling/kling',
    capabilities: [],
    ...overrides
  }
}

describe('toggleCompared', () => {
  it('adds, removes and stops at the limit', () => {
    const full = Array.from({ length: MAX_COMPARED }, (_, i) => `m${i}`)
    expect(toggleCompared([], 'a')).toEqual(['a'])
    expect(toggleCompared(['a', 'b'], 'a')).toEqual(['b'])
    expect(toggleCompared(full, 'extra')).toEqual(full)
    expect(toggleCompared(full, 'm0')).toEqual(full.slice(1))
  })
})

describe('canCompare', () => {
  it.for([
    ['a hosted model', hosted(), true],
    [
      'a model missing its input schema',
      hosted({ incompleteReason: 'missing-input-schema' }),
      false
    ],
    [
      'a workflow',
      {
        slug: 'workflows/relight',
        name: 'Relight',
        workflowCount: 0,
        capabilities: [],
        href: '/hub/workflows/relight/',
        type: 'CLOUD',
        workflowId: 'relight'
      } satisfies WorkshopModel,
      false
    ]
  ] as const)('%s → %s', ([, model, expected]) => {
    expect(canCompare(model)).toBe(expected)
  })
})

describe('compareRows', () => {
  it('lists one value per model for every real field', () => {
    const rows = compareRows(
      [
        hosted({
          provider: 'Kling',
          modality: 'video',
          task: 'text-to-video',
          creditsPerRun: 24
        }),
        hosted({ slug: 'mystery', name: 'Mystery' })
      ],
      'en'
    )
    expect(
      Object.fromEntries(rows.map((row) => [row.key, row.values]))
    ).toEqual({
      provider: ['Kling', '—'],
      task: ['Text to Video', expect.any(String)],
      access: ['Run · API', 'Run · API']
    })
  })
})
