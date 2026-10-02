import type { OxlintConfig } from 'oxlint'

const imports = {
  plugins: ['import', 'typescript'],
  rules: {
    'typescript/consistent-type-imports': 'error',
    'import/consistent-type-specifier-style': ['error', 'prefer-top-level']
  }
} satisfies OxlintConfig

export default imports
