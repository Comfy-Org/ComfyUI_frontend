import { readFileSync, writeFileSync } from 'node:fs'
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
  const testName =
    options.testName ??
    filePath.split('/').pop()?.replace('.raw.spec.ts', '') ??
    'test'
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
    options.output ?? filePath.replace('.raw.spec.ts', '.spec.ts')
  writeFileSync(outputPath, result.code)
  console.log(pc.green(`  ✅ Saved: ${outputPath}`))
}
