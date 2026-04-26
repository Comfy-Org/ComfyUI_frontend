const COMFY_API_BASE_FLAG = '--comfy-api-base'
export const DEFAULT_CLOUD_API_BASE = 'https://api.comfy.org'

type SystemInfo = { argv?: string[]; comfy_api_base?: string }

function parseArgvApiBase(argv: string[] | undefined): string | undefined {
  if (!argv) return undefined
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === COMFY_API_BASE_FLAG && i + 1 < argv.length) return argv[i + 1]
    if (a.startsWith(`${COMFY_API_BASE_FLAG}=`))
      return a.slice(COMFY_API_BASE_FLAG.length + 1)
  }
  return undefined
}

export function resolveBackendCloudBase(
  system: SystemInfo | undefined
): string {
  const explicit = system?.comfy_api_base
  if (explicit) return explicit.replace(/\/+$/, '')
  const fromArgv = parseArgvApiBase(system?.argv)
  return (fromArgv ?? DEFAULT_CLOUD_API_BASE).replace(/\/+$/, '')
}
