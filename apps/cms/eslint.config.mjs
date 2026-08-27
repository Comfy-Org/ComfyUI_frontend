import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'src/payload-types.ts',
      'src/payload-generated-schema.ts',
      'src/migrations/**',
      'src/app/(payload)/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
)
