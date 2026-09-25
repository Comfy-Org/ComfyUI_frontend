import path from 'node:path'

// lint-staged calls this config once per concurrent chunk in one process.
// Claim each fixed-scope command once so only its first matching chunk runs it.
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
  const designFiles = relativePaths.filter((fileName) =>
    /\.(astro|css|vue)$/.test(fileName)
  )
  const designSystemSourceFiles = relativePaths.filter(
    (fileName) =>
      fileName.startsWith('src/components/ui/') ||
      fileName.startsWith('packages/design-system/src/css/') ||
      fileName === 'apps/website/src/styles/global.css' ||
      fileName.startsWith('apps/website/src/components/common/') ||
      fileName.startsWith('apps/website/src/components/blocks/') ||
      fileName.startsWith('apps/website/src/components/ui/')
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
    ...(designFiles.length > 0 ? ['pnpm lint:design-system --staged'] : []),
    ...(designSystemSourceFiles.length > 0
      ? ['pnpm design-system:docs:check']
      : []),
    ...typecheckCommands(typecheckFiles)
  ]
}

function lintCommands(
  codeFiles: string[],
  styleFiles: string[],
  astroFiles: string[]
) {
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
      [...codeFiles, ...astroFiles],
      'pnpm exec eslint --cache --cache-strategy content --concurrency auto --fix --no-warn-ignored'
    )
  ]
}

// Directories outside the root program, each with its own tsconfig.
const standaloneTypecheckScripts = {
  'browser_tests/': 'typecheck:browser',
  'scripts/': 'typecheck:scripts',
  'tools/': 'typecheck:tools',
  'apps/website/': 'typecheck:website',
  'apps/billing-web/': 'typecheck:billing-web'
}

// The root program consumes these, so a package change also rechecks the root.
const packageTypecheckScripts = {
  'packages/account-core/': 'typecheck:account-core',
  'packages/account-ui/': 'typecheck:account-ui',
  'packages/billing-contract/': 'typecheck:billing-contract'
}

function typecheckCommands(fileNames: string[]) {
  const isStandalone = (fileName: string) =>
    Object.keys(standaloneTypecheckScripts).some((directory) =>
      fileName.startsWith(directory)
    )

  const projectScripts = Object.entries({
    ...standaloneTypecheckScripts,
    ...packageTypecheckScripts
  })
    .filter(([directory]) =>
      fileNames.some((fileName) => fileName.startsWith(directory))
    )
    .map(([, script]) => `pnpm ${script}`)

  return [
    ...(fileNames.some((fileName) => !isStandalone(fileName))
      ? repoWide('pnpm typecheck:app')
      : []),
    ...projectScripts.flatMap(repoWide)
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
