import { mkdirSync, writeFileSync } from 'node:fs'

import imports from '../src/imports.ts'

mkdirSync(new URL('../dist/', import.meta.url), { recursive: true })
writeFileSync(
  new URL('../dist/imports.json', import.meta.url),
  `${JSON.stringify(imports, null, 2)}\n`
)
