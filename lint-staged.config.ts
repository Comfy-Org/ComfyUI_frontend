import path from 'node:path'

export default function lintStaged(stagedFiles: string[]) {
  const relativePaths = stagedFiles.map(toRelativePath)

  if (relativePaths.some((fileName) => fileName.startsWith('tests-ui/'))) {
    return 'echo "Files in tests-ui/ are deprecated. Colocate tests with source files." && exit 1'
  }

  const formattableFiles = relativePaths.filter(
    (fileName) =>
      /\.(js|ts|tsx|vue|mts|json|yaml|md)$/.test(fileName) &&
      !fileName.endsWith('pnpm-lock.yaml')
  )
  const codeFiles = relativePaths.filter((fileName) =>
    /\.(js|ts|tsx|vue|mts)$/.test(fileName)
  )
  const styleFiles = relativePaths.filter((fileName) =>
    /\.(css|vue)$/.test(fileName)
  )
  const typecheckFiles = formattableFiles.filter((fileName) =>
    /\.(ts|tsx|vue|mts)$/.test(fileName)
  )

  return [
    ...commandsWithFiles(
      formattableFiles,
      'pnpm exec oxfmt --write --no-error-on-unmatched-pattern'
    ),
    ...lintCommands(codeFiles, styleFiles),
    ...typecheckCommands(typecheckFiles)
  ]
}

function lintCommands(codeFiles: string[], styleFiles: string[]) {
  return [
    ...commandsWithFiles(
      styleFiles,
      'pnpm exec stylelint --cache --cache-strategy content --allow-empty-input'
    ),
    ...commandsWithFiles(
      codeFiles,
      'pnpm exec oxlint --type-aware --no-error-on-unmatched-pattern --fix'
    ),
    ...commandsWithFiles(
      codeFiles,
      'pnpm exec eslint --cache --cache-strategy content --concurrency auto --fix --no-warn-ignored'
    )
  ]
}

const standaloneTypecheckScripts = {
  'browser_tests/': 'typecheck:browser',
  'scripts/': 'typecheck:scripts',
  'tools/': 'typecheck:tools',
  'apps/website/': 'typecheck:website'
}

function typecheckCommands(fileNames: string[]) {
  const isStandalone = (fileName: string) =>
    Object.keys(standaloneTypecheckScripts).some((directory) =>
      fileName.startsWith(directory)
    )

  const projectScripts = Object.entries(standaloneTypecheckScripts)
    .filter(([directory]) =>
      fileNames.some((fileName) => fileName.startsWith(directory))
    )
    .map(([, script]) => `pnpm ${script}`)

  return [
    ...(fileNames.some((fileName) => !isStandalone(fileName))
      ? ['pnpm typecheck:app']
      : []),
    ...projectScripts
  ]
}

function commandsWithFiles(fileNames: string[], ...commands: string[]) {
  if (fileNames.length === 0) {
    return []
  }

  const joinedPaths = fileNames.map((fileName) => `"${fileName}"`).join(' ')
  return commands.map((command) => `${command} ${joinedPaths}`)
}

function toRelativePath(fileName: string) {
  return path.relative(process.cwd(), fileName).replace(/\\/g, '/')
}
