import { ESLint } from 'eslint'
import { expect, it } from 'vitest'

import {
  imports,
  importX,
  typescript,
  vue,
  vueParser,
  vueTemplates
} from '../src/eslint.js'
import plugin from '../src/plugin.js'

it('rejects mixed type imports while accepting separate type imports', async () => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.ts'],
        languageOptions: { parser: typescript.parser },
        plugins: {
          '@typescript-eslint': typescript.plugin,
          'import-x': importX
        },
        ...imports()
      }
    ]
  })
  const bad = await eslint.lintText(
    "import { type Input, live } from './lib'\nexport const name = (input: Input) => live(input)\n",
    { filePath: 'probe.ts' }
  )
  expect(bad[0].messages.map((message) => message.ruleId)).toContain(
    'import-x/consistent-type-specifier-style'
  )
  const good = await eslint.lintText(
    "import type { Input } from './lib'\nimport { live } from './lib'\nexport const name = (input: Input) => live(input)\n",
    { filePath: 'probe.ts' }
  )
  expect(good[0].errorCount).toBe(0)
})

it('keeps Vue template checks available independently of Oxlint', async () => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.vue'],
        languageOptions: {
          parser: vueParser,
          parserOptions: { parser: typescript.parser }
        },
        plugins: { vue },
        ...vueTemplates
      }
    ]
  })
  const [result] = await eslint.lintText(
    '<template><p v-if="ready">Ready</p><p v-else v-for="item in items" :key="item">{{ item }}</p></template>',
    { filePath: 'Probe.vue' }
  )
  expect(result.messages.map((message) => message.ruleId)).toContain(
    'vue/no-use-v-else-with-v-for'
  )
})

it('distinguishes JavaScript private members from TypeScript private members', async () => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.ts'],
        languageOptions: { parser: typescript.parser },
        plugins: { comfy: plugin },
        rules: { 'comfy/no-js-private-class-members': 'error' }
      }
    ]
  })
  for (const [member, count] of [
    ['#value', 1],
    ['private value', 0]
  ] as const) {
    const [result] = await eslint.lintText(
      `export class Model { ${member} = 1 }`,
      { filePath: 'probe.ts' }
    )
    expect(result.errorCount).toBe(count)
  }
})
