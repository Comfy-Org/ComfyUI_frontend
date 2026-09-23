import path from 'node:path'

// oxlint owns plain TypeScript; ESLint keeps the file types it cannot parse
// (Vue SFCs, Astro components and the script blocks Astro's processor emits).
export const templateFiles = ['**/*.vue', '**/*.astro', '**/*.astro/*.{js,ts}']

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
