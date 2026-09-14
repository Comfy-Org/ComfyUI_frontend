import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { LOCALIZED_CODES, localePrefix } from '../../src/config/locales'

function englishBuildRoutes(dist: string): string[] {
  const prefixes = new Set(
    LOCALIZED_CODES.map(localePrefix).map((prefix) => prefix.slice(1))
  )
  function skipRoot(name: string): boolean {
    return prefixes.has(name) || name.startsWith('_')
  }
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (dir === dist && skipRoot(entry.name)) return []
      if (entry.isDirectory()) return walk(join(dir, entry.name))
      return entry.name === 'index.html'
        ? [relative(dist, dir).split(sep).join('/')]
        : []
    })
  }
  return walk(dist)
}

export function localizedBuildPages(dist: string) {
  const routes = englishBuildRoutes(dist)
  return LOCALIZED_CODES.flatMap((locale) => {
    const prefix = localePrefix(locale).slice(1)
    return routes.flatMap((route) => {
      const file = join(dist, prefix, route, 'index.html')
      if (!existsSync(file)) return []
      return [
        {
          locale,
          prefix,
          route,
          english: readFileSync(join(dist, route, 'index.html'), 'utf8'),
          localized: readFileSync(file, 'utf8')
        }
      ]
    })
  })
}
