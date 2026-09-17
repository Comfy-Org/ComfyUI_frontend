import { pathToFileURL } from 'node:url'

/** Whether the module at `moduleUrl` (pass `import.meta.url`) is the script Node was launched with. */
export function isMainModule(moduleUrl: string): boolean {
  const entry = process.argv.at(1)
  return entry !== undefined && pathToFileURL(entry).href === moduleUrl
}
