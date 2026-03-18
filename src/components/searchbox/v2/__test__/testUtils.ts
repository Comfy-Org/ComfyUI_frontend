import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

export function createMockNodeDef(
  overrides: Partial<ComfyNodeDef> = {}
): ComfyNodeDef {
  return {
    name: 'TestNode',
    display_name: 'Test Node',
    category: 'test',
    python_module: 'nodes',
    description: 'Test description',
    input: {},
    output: [],
    output_is_list: [],
    output_name: [],
    output_node: false,
    deprecated: false,
    experimental: false,
    ...overrides
  }
}

export function setupTestPinia() {
  setActivePinia(createTestingPinia({ stubActions: false }))
}

export const testI18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        addNode: 'Add a node...',
        filterBy: 'Filter by:',
        mostRelevant: 'Most relevant',
        recents: 'Recents',
        favorites: 'Favorites',
        essentials: 'Essentials',
        custom: 'Custom',
        comfy: 'Comfy',
        partner: 'Partner',
        extensions: 'Extensions',
        noResults: 'No results',
        filterByType: 'Filter by {type}...',
        input: 'Input',
        output: 'Output',
        source: 'Source',
        search: 'Search'
      },
      sideToolbar: {
        nodeLibraryTab: {
          filterOptions: {
            blueprints: 'Blueprints',
            partnerNodes: 'Partner Nodes'
          }
        }
      }
    }
  }
})
