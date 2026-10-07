import { describe, expect, it } from 'vitest'

import type { ModelsListState } from './models-list-return'
import { modelsListReturn } from './models-list-return'

const unfiltered: ModelsListState = {
  query: '',
  useCases: [],
  tab: 'all',
  access: []
}

describe('modelsListReturn', () => {
  it.for([
    {
      kind: 'the whole catalogue',
      state: {},
      list: { href: '/hub/models/' }
    },
    {
      kind: 'a category tab',
      state: { tab: 'video' },
      list: { href: '/hub/models/?tab=video', label: 'Video models' }
    },
    {
      kind: 'a category',
      state: { useCases: ['generate-videos'] },
      list: {
        href: '/hub/models/?useCase=generate-videos',
        label: 'Generate videos'
      }
    },
    {
      kind: 'one way of using a model',
      state: { access: ['run'] },
      list: {
        href: '/hub/models/?use=run',
        label: 'Models you can run here'
      }
    },
    {
      kind: 'two ways of using a model',
      state: { access: ['run', 'api'] },
      list: { href: '/hub/models/?use=run%2Capi' }
    },
    {
      kind: 'a search inside a tab',
      state: { query: ' flux ', tab: 'image' },
      list: {
        href: '/hub/models/?q=flux&tab=image',
        label: 'results for “flux”'
      }
    }
  ] satisfies {
    kind: string
    state: Partial<ModelsListState>
    list: { href: string; label?: string }
  }[])('addresses and names $kind', ({ state, list }) => {
    expect(modelsListReturn({ ...unfiltered, ...state }, 'en')).toEqual(list)
  })

  it('names the list in Chinese', () => {
    expect(
      modelsListReturn({ ...unfiltered, tab: 'video' }, 'zh-CN').label
    ).toBe('视频模型')
  })
})
