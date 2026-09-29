import { describe, expect, it } from 'vitest'

import type { RouterWorkshopModel } from './models-catalogue'
import { relatedModels } from './workshop-related'

function model(
  slug: string,
  fields: Partial<RouterWorkshopModel> = {}
): RouterWorkshopModel {
  return {
    slug,
    name: slug,
    workflowCount: 1,
    href: `/models/${slug}/`,
    routerId: `x/${slug}`,
    capabilities: [],
    modality: 'video',
    ...fields
  }
}

describe('relatedModels', () => {
  it.for<[string, RouterWorkshopModel[], string[], number?]>([
    [
      'ranks the same modality first, then the most used',
      [
        model('current', { workflowCount: 9 }),
        model('busy-image', { modality: 'image', workflowCount: 8 }),
        model('quiet-video', { workflowCount: 1 }),
        model('busy-video', { workflowCount: 5 }),
        model('audio', { modality: 'audio', workflowCount: 7 }),
        model('other-image', { modality: 'image', workflowCount: 2 })
      ],
      ['busy-video', 'quiet-video', 'busy-image', 'audio']
    ],
    [
      'honours the limit',
      [
        model('current', { workflowCount: 9 }),
        model('quiet-video', { workflowCount: 1 }),
        model('busy-video', { workflowCount: 5 }),
        model('audio', { modality: 'audio', workflowCount: 7 })
      ],
      ['busy-video', 'quiet-video'],
      2
    ],
    [
      'puts the same provider first',
      [
        model('hailuo-03', { provider: 'MiniMax', workflowCount: 9 }),
        model('busy-video', { workflowCount: 8 }),
        model('hailuo-02', { provider: 'MiniMax', workflowCount: 2 }),
        model('hailuo-i2v', { provider: 'MiniMax', modality: 'image' })
      ],
      ['hailuo-02', 'hailuo-i2v', 'busy-video']
    ],
    [
      'tops up with the nearest capability when the provider runs out',
      [
        model('current', { provider: 'MiniMax', capabilities: ['Lip sync'] }),
        model('popular-stranger', { workflowCount: 8 }),
        model('lip-sync-stranger', { capabilities: ['Lip sync'] })
      ],
      ['lip-sync-stranger', 'popular-stranger']
    ],
    [
      'leads with the other tasks of the same model',
      [
        model('seedance-t2v', {
          routerId: 'x/seedance',
          provider: 'ByteDance'
        }),
        model('popular', { workflowCount: 9 }),
        model('seedance-i2v', {
          routerId: 'x/seedance',
          provider: 'ByteDance'
        }),
        model('quiet', { workflowCount: 0 })
      ],
      ['seedance-i2v', 'popular', 'quiet']
    ],
    [
      'keeps every other task of the model even past the limit',
      [
        model('a', { routerId: 'x/a' }),
        model('a-2', { routerId: 'x/a' }),
        model('a-3', { routerId: 'x/a' }),
        model('a-4', { routerId: 'x/a' }),
        model('stranger', { workflowCount: 9 })
      ],
      ['a-2', 'a-3', 'a-4'],
      2
    ],
    [
      'shows one page per other model',
      [
        model('m'),
        model('a-1', { routerId: 'x/a', workflowCount: 5 }),
        model('a-2', { routerId: 'x/a', workflowCount: 4 }),
        model('n')
      ],
      ['a-1', 'n']
    ],
    [
      'ends with the next model in catalogue order when the ranking leaves it out',
      [
        model('m'),
        model('hot-1', { workflowCount: 9 }),
        model('hot-2', { workflowCount: 8 }),
        model('hot-3', { workflowCount: 7 }),
        model('n-next', { workflowCount: 0 })
      ],
      ['hot-1', 'hot-2', 'n-next'],
      3
    ],
    [
      'wraps from the last model in the catalogue to the first',
      [
        model('z-last'),
        model('a-first', { workflowCount: 0 }),
        model('hot-1', { workflowCount: 9 }),
        model('hot-2', { workflowCount: 8 })
      ],
      ['hot-1', 'a-first'],
      2
    ],
    [
      'represents another model by its next page in the catalogue',
      [
        model('m'),
        model('b-busy', { routerId: 'x/o', workflowCount: 9 }),
        model('n-quiet', { routerId: 'x/o', workflowCount: 0 })
      ],
      ['n-quiet']
    ],
    ['is empty when the model is alone', [model('alone')], []]
  ])('%s', ([, list, expected, limit]) => {
    expect(relatedModels(list[0], list, limit).map((m) => m.slug)).toEqual(
      expected
    )
  })
})
