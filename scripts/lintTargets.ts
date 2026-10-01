import { isEslintFile } from './eslintScope'

export function lintTargets(changedFiles: string[]) {
  return {
    oxlint: changedFiles.filter((file) =>
      /\.(?:js|ts|tsx|vue|mts)$/.test(file)
    ),
    eslint: changedFiles.filter(isEslintFile)
  }
}
