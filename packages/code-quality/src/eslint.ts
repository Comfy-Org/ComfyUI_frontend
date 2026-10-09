import type { Linter } from 'eslint'

export { default as typescript } from 'typescript-eslint'
export { default as vue } from 'eslint-plugin-vue'
export { default as vueParser } from 'vue-eslint-parser'
export { importX } from 'eslint-plugin-import-x'
export { default as oxlint } from 'eslint-plugin-oxlint'
export { default as playwright } from 'eslint-plugin-playwright'
export { default as prettier } from 'eslint-config-prettier/flat'

export function imports(
  namespace: 'import' | 'import-x' = 'import-x'
): Linter.Config {
  return {
    name: '@comfyorg/code-quality/imports',
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      [`${namespace}/consistent-type-specifier-style`]: [
        'error',
        'prefer-top-level'
      ]
    }
  }
}

export const vueTemplates: Linter.Config = {
  name: '@comfyorg/code-quality/vue-templates',
  rules: { 'vue/no-use-v-else-with-v-for': 'error' }
}

export const asyncSafety: Linter.Config = {
  name: '@comfyorg/code-quality/async-safety',
  rules: { '@typescript-eslint/no-floating-promises': 'error' }
}

export const browserTests: Linter.Config = {
  name: '@comfyorg/code-quality/browser-tests',
  rules: {
    'playwright/no-focused-test': 'error',
    'playwright/no-wait-for-timeout': 'error',
    'playwright/no-force-option': 'error',
    'playwright/prefer-web-first-assertions': 'error',
    'playwright/valid-expect': 'error',
    'playwright/missing-playwright-await': 'error'
  }
}

export { default as vitest } from '@vitest/eslint-plugin'

export const unitTests: Linter.Config = {
  name: '@comfyorg/code-quality/unit-tests',
  rules: {
    'vitest/no-focused-tests': 'error',
    'vitest/valid-expect': ['error', { maxArgs: 2 }]
  }
}
