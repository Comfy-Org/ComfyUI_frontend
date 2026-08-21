import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import pc from 'picocolors'
import { transform, formatTransformSummary } from '../transform/engine'
import { header } from '../ui/logger'

export async function runTransform(
  filePath: string,
  options: {
    testName?: string
    tags?: string[]
    output?: string
  } = {}
): Promise<void> {
  header('Transform Codegen → Conventions')

  // Read input
  let rawCode: string
  try {
    rawCode = readFileSync(filePath, 'utf-8')
  } catch {
    console.log(pc.red(`  Could not read file: ${filePath}`))
    process.exit(1)
  }

  console.log(pc.dim(`  Input: ${filePath}`))
  console.log()

  // Transform
  const inferredName = basename(filePath).replace(/\.raw\.spec\.ts$/, '')
  const testName = options.testName ?? (inferredName || 'test')
  const tags = options.tags ?? ['@canvas']
  const result = transform(rawCode, { testName, tags })

  // Print summary
  console.log('  Transforms applied:')
  for (const line of formatTransformSummary(result)) {
    console.log(`    ${line}`)
  }
  console.log()

  // Write output
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
  console.log(pc.green(`  ✅ Saved: ${outputPath}`))
}
