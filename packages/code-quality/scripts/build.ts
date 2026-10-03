import { cp } from 'node:fs/promises'

await cp(
  new URL('../presets/', import.meta.url),
  new URL('../dist/presets/', import.meta.url),
  { recursive: true }
)
