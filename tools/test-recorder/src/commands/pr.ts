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
  if (
    !relativePath.startsWith('browser_tests/') ||
    !relativePath.endsWith('.spec.ts')
  ) {
    console.log(
      pc.red(
        `Refusing to open a PR for ${relativePath}: expected a spec under browser_tests/.`
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
