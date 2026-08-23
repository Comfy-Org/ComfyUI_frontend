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
    ...lintCommands(codeFiles, styleFiles),
    ...(designFiles.length > 0 ? ['pnpm lint:design-system --staged'] : []),
    ...(designSystemSourceFiles.length > 0
      ? ['pnpm design-system:docs:check']
      : []),
    ...typecheckCommands(typecheckFiles)
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
