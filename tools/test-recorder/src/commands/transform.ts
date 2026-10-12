import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import pc from 'picocolors'
import { transform, formatTransformSummary } from '../transform/engine'
import { formatFile } from '../transform/format'
import { header } from '../ui/logger'

export async function runTransform(
  filePath: string,
  options: {
    testName?: string
    tags?: string[]
    output?: string
    workflow?: string
    featureFlags?: Record<string, unknown>
  } = {}
): Promise<void> {
  header('Transform Codegen → Conventions')

  let rawCode: string
  try {
    rawCode = readFileSync(filePath, 'utf-8')
  } catch {
    console.log(pc.red(`  Could not read file: ${filePath}`))
    process.exit(1)
  }

  console.log(pc.dim(`  Input: ${filePath}`))
  console.log()

  const inferredName = basename(filePath).replace(/\.raw\.spec\.ts$/, '')
  const testName = options.testName ?? (inferredName || 'test')
  const tags = options.tags ?? ['@canvas']
  const result = transform(rawCode, {
    testName,
    tags,
    workflow: options.workflow,
    featureFlags: options.featureFlags
  })

  console.log('  Transforms applied:')
  for (const line of formatTransformSummary(result)) {
    console.log(`    ${line}`)
  }
  console.log()

  const outputPath =
    options.output ?? filePath.replace(/\.raw\.spec\.ts$/, '.spec.ts')
  if (!options.output && outputPath === filePath) {
    console.log(
      pc.red(
        '  Refusing to overwrite input file. Pass --output or use a *.raw.spec.ts input.'
      )
    )
    process.exit(1)
  }
  writeFileSync(outputPath, result.code)

  if (!formatFile(outputPath)) {
    console.log(
      pc.yellow(`  ⚠️  Could not format ${outputPath} — run pnpm format`)
    )
  }

  console.log(pc.green(`  ✅ Saved: ${outputPath}`))
}
