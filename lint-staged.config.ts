import path from 'node:path'

const isCms = (fileName: string) => fileName.startsWith('apps/cms/')

export default function lintStaged(stagedFiles: string[]) {
  const relativePaths = stagedFiles.map(toRelativePath)

  if (relativePaths.some((fileName) => fileName.startsWith('tests-ui/'))) {
    return 'echo "Files in tests-ui/ are deprecated. Colocate tests with source files." && exit 1'
  }

  // apps/cms is a Payload app with its own Prettier, ESLint and tsconfig; it is
  // excluded from the repo-wide oxfmt/oxlint/stylelint/typecheck gates and runs
  // its own instead.
  const cmsPaths = relativePaths.filter(isCms)
  const repoPaths = relativePaths.filter((fileName) => !isCms(fileName))

  const formattableFiles = repoPaths.filter(
    (fileName) =>
      /\.(js|ts|tsx|vue|mts|json|yaml|md)$/.test(fileName) &&
      !fileName.endsWith('pnpm-lock.yaml')
  )
  const codeFiles = repoPaths.filter((fileName) =>
    /\.(js|ts|tsx|vue|mts)$/.test(fileName)
  )
  const styleFiles = repoPaths.filter((fileName) =>
    /\.(css|vue)$/.test(fileName)
  )
  const typecheckFiles = formattableFiles.filter((fileName) =>
    /\.(ts|tsx|vue|mts)$/.test(fileName)
  )

  return [
    ...cmsCommands(cmsPaths),
    ...commandsWithFiles(
      formattableFiles,
      'pnpm exec oxfmt --write --no-error-on-unmatched-pattern'
    ),
    ...lintCommands(codeFiles, styleFiles),
    ...typecheckCommands(typecheckFiles)
  ]
}

function cmsCommands(cmsPaths: string[]) {
  if (cmsPaths.length === 0) {
    return []
  }

  return [
    'pnpm format:check:cms',
    ...(cmsPaths.some((fileName) => /\.(ts|tsx|mjs|js)$/.test(fileName))
      ? ['pnpm lint:cms', 'pnpm typecheck:cms']
      : [])
  ]
}

function lintCommands(codeFiles: string[], styleFiles: string[]) {
  if (new Set([...codeFiles, ...styleFiles]).size > 10) {
    return ['pnpm lint']
  }

  return [
    ...commandsWithFiles(styleFiles, 'pnpm exec stylelint --allow-empty-input'),
    ...commandsWithFiles(
      codeFiles,
      'pnpm exec oxlint --type-aware --no-error-on-unmatched-pattern --fix',
      'pnpm exec eslint --cache --fix --no-warn-ignored'
    )
  ]
}

function typecheckCommands(fileNames: string[]) {
  if (fileNames.length === 0) {
    return []
  }

  return [
    'pnpm typecheck',
    ...(fileNames.some((fileName) => fileName.startsWith('browser_tests/'))
      ? ['pnpm typecheck:browser']
      : []),
    ...(fileNames.some((fileName) => fileName.startsWith('apps/website/'))
      ? ['pnpm typecheck:website']
      : [])
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
