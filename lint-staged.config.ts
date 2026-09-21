import path from 'node:path'

/**
 * lint-staged splits a large stage into chunks and calls this config once per
 * chunk, running the chunks concurrently. The commands below scan the whole
 * repository and ignore the file list they are handed, so a chunked commit
 * starts a copy of each per chunk: two full lint passes together exhaust the
 * memory on a 16GB machine and both are killed, which is what a branch merging
 * main back in runs into. Give each one to the first chunk that asks for it.
 */
const claimed = new Set<string>()

function repoWide(command: string) {
  if (claimed.has(command)) {
    return []
  }

  claimed.add(command)
  return [command]
}

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
  const astroFiles = relativePaths.filter(
    (fileName) =>
      fileName.startsWith('apps/website/src/') && fileName.endsWith('.astro')
  )
  const typecheckFiles = relativePaths.filter((fileName) =>
    /\.(astro|ts|tsx|vue|mts)$/.test(fileName)
  )

  return [
    ...commandsWithFiles(
      formattableFiles,
      'pnpm exec oxfmt --write --no-error-on-unmatched-pattern'
    ),
    ...lintCommands(codeFiles, styleFiles, astroFiles),
    ...commandsWithFiles(
      astroFiles.map((fileName) => fileName.slice('apps/website/'.length)),
      'pnpm --dir apps/website exec prettier --write'
    ),
    ...typecheckCommands(typecheckFiles)
  ]
}

function lintCommands(
  codeFiles: string[],
  styleFiles: string[],
  astroFiles: string[]
) {
  if (new Set([...codeFiles, ...styleFiles, ...astroFiles]).size > 10) {
    return repoWide('pnpm lint')
  }

  return [
    ...commandsWithFiles(styleFiles, 'pnpm exec stylelint --allow-empty-input'),
    ...commandsWithFiles(
      codeFiles,
      'pnpm exec oxlint --type-aware --no-error-on-unmatched-pattern --fix'
    ),
    ...commandsWithFiles(
      [...codeFiles, ...astroFiles],
      'pnpm exec eslint --cache --fix --no-warn-ignored'
    )
  ]
}

function typecheckCommands(fileNames: string[]) {
  if (fileNames.length === 0) {
    return []
  }

  return [
    ...repoWide('pnpm typecheck'),
    ...(fileNames.some((fileName) => fileName.startsWith('browser_tests/'))
      ? repoWide('pnpm typecheck:browser')
      : []),
    ...(fileNames.some((fileName) => fileName.startsWith('apps/website/'))
      ? repoWide('pnpm typecheck:website')
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
