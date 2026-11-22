import { pathToFileURL } from 'node:url'

export function isMainModule(moduleUrl: string): boolean {
  const entry = process.argv.at(1)
  return entry !== undefined && pathToFileURL(entry).href === moduleUrl
}
