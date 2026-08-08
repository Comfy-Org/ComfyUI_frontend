import path from 'node:path'

export default function lintStaged(stagedFiles: string[]) {
  const relativePaths = stagedFiles.map(toRelativePath)

  if (relativePaths.some((fileName) => fileName.startsWith('tests-ui/'))) {
    return 'echo "Files in tests-ui/ are deprecated. Colocate tests with source files." && exit 1'
  }

  const formattable = relativePaths.filter(
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
  const typecheckFiles = formattable.filter(
    (fileName) => !fileName.endsWith('.js')
  )
  const lintFileCount = new Set([...codeFiles, ...styleFiles]).size
  const commands: string[] = []

  if (formattable.length > 0) {
    commands.push(`pnpm exec oxfmt --write ${joinPaths(formattable)}`)
  }

  if (lintFileCount > 10) {
    commands.push('pnpm lint')
  } else {
    if (styleFiles.length > 0) {
      commands.push(
        `pnpm exec stylelint --allow-empty-input ${joinPaths(styleFiles)}`
      )
    }

    if (codeFiles.length > 0) {
      const joinedPaths = joinPaths(codeFiles)
      commands.push(
        `pnpm exec oxlint --type-aware --no-error-on-unmatched-pattern --fix ${joinedPaths}`,
        `pnpm exec eslint --cache --fix --no-warn-ignored ${joinedPaths}`
      )
    }
  }

  if (typecheckFiles.length > 0) {
    commands.push('pnpm typecheck')

    if (
      typecheckFiles.some((fileName) => fileName.startsWith('browser_tests/'))
    ) {
      commands.push('pnpm typecheck:browser')
    }

    if (
      typecheckFiles.some((fileName) => fileName.startsWith('apps/website/'))
    ) {
      commands.push('pnpm typecheck:website')
    }
  }

  return commands
}

function toRelativePath(fileName: string) {
  return path.relative(process.cwd(), fileName).replace(/\\/g, '/')
}

function joinPaths(fileNames: string[]) {
  return fileNames.map((fileName) => `"${fileName}"`).join(' ')
}
