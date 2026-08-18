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
    ...commandsWithFiles(formattableFiles, 'pnpm exec oxfmt --write'),
    ...lintCommands(codeFiles, styleFiles),
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
