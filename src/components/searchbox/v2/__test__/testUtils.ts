import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

export function createMockNodeDef(
  overrides: Partial<ComfyNodeDef> = {}
): ComfyNodeDefImpl {
  return new ComfyNodeDefImpl({
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
  })
}

export function setupTestPinia() {
  setActivePinia(createTestingPinia({ stubActions: false }))
}

export const testI18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})
