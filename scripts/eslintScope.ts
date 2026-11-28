import path from 'node:path'

export const templateFiles = ['**/*.vue']

// better-tailwindcss also reads class strings from cn()/cva() calls in .ts.
export const tailwindScriptFiles = ['{src,apps,packages}/**/*.ts']
export const tailwindScriptIgnores = ['**/*.test.ts', '**/*.d.ts']

const matchesAny = (fileName: string, patterns: string[]) =>
  patterns.some((pattern) => path.matchesGlob(fileName, pattern))

export function isEslintFile(fileName: string): boolean {
  return (
    matchesAny(fileName, templateFiles) ||
    (matchesAny(fileName, tailwindScriptFiles) &&
      !matchesAny(fileName, tailwindScriptIgnores))
  )
}
