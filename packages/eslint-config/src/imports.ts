import type { Linter } from 'eslint'

export default function imports(
  importNamespace: 'import' | 'import-x' = 'import-x'
): Linter.Config {
  return {
    name: '@comfyorg/eslint-config/imports',
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      [`${importNamespace}/consistent-type-specifier-style`]: [
        'error',
        'prefer-top-level'
      ]
    }
  }
}
