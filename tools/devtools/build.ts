import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const source = await readFile(
  new URL('./widgetAugmentations.ts', import.meta.url),
  'utf8'
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext
  }
})
await writeFile(
  fileURLToPath(new URL('./web/widgetAugmentations.js', import.meta.url)),
  `${outputText}\nimport { app } from '../../scripts/app.js'\napp.registerExtension(extension)\n`
)
