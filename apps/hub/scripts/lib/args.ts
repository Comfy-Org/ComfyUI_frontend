import { LOCALE_INDEX_FILES, DEFAULT_LOCALE } from './constants'
import { logger } from './logger'

function printHelp(): void {
  logger.info(`
Usage: sync-templates.ts [options]

Options:
  --all         Sync all templates (default behavior)
  --top-50      Sync top 50 templates by usage (shortcut for --limit 50)
  --limit N     Sync top N templates by usage
  --locale X    Sync only specific locale (e.g., --locale zh)
  --en-only     Sync English only (faster for development)
  --help, -h    Show this help message

Examples:
  pnpm run sync                  # Sync ALL templates (200+)
  pnpm run sync -- --top-50      # Sync top 50 by usage
  pnpm run sync -- --limit 100   # Sync top 100 by usage
  pnpm run sync -- --en-only     # Sync English only
`)
}

export function parseArgs(): { limit?: number; locales: string[] } {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    process.exit(0)
  }

  let limit: number | undefined

  if (args.includes('--top-50')) {
    limit = 50
  }

  const limitIndex = args.indexOf('--limit')
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    const parsedLimit = parseInt(args[limitIndex + 1], 10)
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = parsedLimit
    }
  }

  let locales: string[] = Object.keys(LOCALE_INDEX_FILES)
  const localeIndex = args.indexOf('--locale')
  if (localeIndex !== -1 && args[localeIndex + 1]) {
    const requestedLocale = args[localeIndex + 1]
    if (LOCALE_INDEX_FILES[requestedLocale]) {
      locales = [requestedLocale]
    } else {
      logger.error(`Unknown locale: ${requestedLocale}`)
      logger.error(
        `Available locales: ${Object.keys(LOCALE_INDEX_FILES).join(', ')}`
      )
      process.exit(1)
    }
  }

  if (args.includes('--en-only')) {
    locales = [DEFAULT_LOCALE]
  }

  return { limit, locales }
}
