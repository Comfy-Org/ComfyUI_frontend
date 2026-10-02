import { ESLint } from 'eslint'
import importX from 'eslint-plugin-import-x'
import pluginVue from 'eslint-plugin-vue'
import { parser, plugin } from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'
import { expect, test } from 'vitest'

import imports from './imports.js'
import vue from './vue.js'

function createEslint(importNamespace: 'import' | 'import-x' = 'import-x') {
  return new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.{ts,vue}'],
        languageOptions: {
          parser: vueParser,
          parserOptions: { parser }
        },
        plugins: {
          '@typescript-eslint': plugin,
          [importNamespace]: importX,
          vue: pluginVue
        }
      },
      imports(importNamespace),
      vue
    ]
  })
}

test.for([
  {
    name: 'unmarked type imports',
    source: 'import { Ref } from "vue"; export type Value = Ref<string>',
    corrected:
      'import type { Ref } from "vue"; export type Value = Ref<string>',
    ruleId: '@typescript-eslint/consistent-type-imports'
  },
  {
    name: 'inline type imports',
    source: 'import { type Ref } from "vue"; export type Value = Ref<string>',
    corrected:
      'import type { Ref } from "vue"; export type Value = Ref<string>',
    ruleId: 'import-x/consistent-type-specifier-style'
  },
  {
    name: 'mixed imports',
    source:
      'import { ref, type Ref } from "vue"; export const value: Ref<string> = ref("")',
    corrected:
      'import { ref } from "vue"; import type { Ref } from "vue"; export const value: Ref<string> = ref("")',
    ruleId: 'import-x/consistent-type-specifier-style'
  }
])(
  'rejects $name and accepts separate type imports',
  async ({ source, corrected, ruleId }) => {
    const eslint = createEslint()
    const [invalid] = await eslint.lintText(source, { filePath: 'probe.ts' })
    const [valid] = await eslint.lintText(corrected, { filePath: 'probe.ts' })
    expect(invalid.messages).toContainEqual(
      expect.objectContaining({ ruleId, severity: 2 })
    )
    expect(valid.errorCount).toBe(0)
  }
)

test('preserves runtime imports used only by the Vue template', async () => {
  const eslint = createEslint()
  const [result] = await eslint.lintText(
    '<script setup lang="ts">import { Widget } from "./widgets"; defineProps<{ widget: InstanceType<typeof Widget> }>()</script><template><Widget /></template>',
    { filePath: 'Probe.vue' }
  )
  expect(result.messages).toEqual([])
})

test('supports the Nuxt import namespace in Vue scripts', async () => {
  const eslint = createEslint('import')
  const [invalid] = await eslint.lintText(
    '<script setup lang="ts">import { ref, type Ref } from "vue"; const value: Ref<string> = ref("")</script><template>{{ value }}</template>',
    { filePath: 'Probe.vue' }
  )
  const [valid] = await eslint.lintText(
    '<script setup lang="ts">import { ref } from "vue"; import type { Ref } from "vue"; const value: Ref<string> = ref("")</script><template>{{ value }}</template>',
    { filePath: 'Probe.vue' }
  )
  expect(invalid.messages).toContainEqual(
    expect.objectContaining({
      ruleId: 'import/consistent-type-specifier-style'
    })
  )
  expect(valid.errorCount).toBe(0)
})

test.for(['v-else', 'v-else-if="items.length"'])(
  'requires a wrapper around %s lists',
  async (directive) => {
    const eslint = createEslint()
    const script =
      '<script setup lang="ts">defineProps<{ loading: boolean; items: string[] }>()</script>'
    const [invalid] = await eslint.lintText(
      `${script}<template><span v-if="loading">Loading</span><span v-for="item in items" ${directive} :key="item">{{ item }}</span></template>`,
      { filePath: 'Probe.vue' }
    )
    const [valid] = await eslint.lintText(
      `${script}<template><span v-if="loading">Loading</span><template ${directive}><span v-for="item in items" :key="item">{{ item }}</span></template></template>`,
      { filePath: 'Probe.vue' }
    )
    expect(invalid.messages).toContainEqual(
      expect.objectContaining({ ruleId: 'vue/no-use-v-else-with-v-for' })
    )
    expect(valid.errorCount).toBe(0)
  }
)
