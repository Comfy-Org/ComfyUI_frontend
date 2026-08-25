import { existsSync } from 'node:fs'
import { basename, isAbsolute, join, relative } from 'node:path'
import pc from 'picocolors'
import { findProjectRoot } from '../recorder/runner'
import { openPr } from '../pr/openPr'
import { header } from '../ui/logger'

/** Opens a PR for an already-generated spec. */
export async function runPr(
  filePath: string,
  description?: string
): Promise<void> {
  header('Create Pull Request')

  const projectRoot = findProjectRoot()
  const absolute = isAbsolute(filePath)
    ? filePath
    : join(process.cwd(), filePath)

  if (!existsSync(absolute)) {
    console.log(pc.red(`No such file: ${absolute}`))
    process.exit(1)
  }

  const relativePath = relative(projectRoot, absolute).split('\\').join('/')
  const isUnderTestsDir = relativePath.startsWith('browser_tests/tests/')
  const isRawCodegen = relativePath.endsWith('.raw.spec.ts')
  const isSpec = relativePath.endsWith('.spec.ts')
  if (!isUnderTestsDir || !isSpec || isRawCodegen) {
    console.log(
      pc.red(
        isRawCodegen
          ? `Refusing to open a PR for ${relativePath}: this is untransformed codegen output. Run \`comfy-test transform\` first.`
          : `Refusing to open a PR for ${relativePath}: expected a *.spec.ts file under browser_tests/tests/.`
      )
    )
    process.exit(1)
  }

  const testName = basename(absolute).replace(/\.spec\.ts$/, '')
  await openPr({
    testFilePath: absolute,
    testName,
    description: description ?? `Adds the ${testName} browser test.`,
    projectRoot
  })
}
