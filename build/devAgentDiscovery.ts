import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Mirrors `localdb.DiscoveryFile` in Comfy-Org/cloud.
const AGENT_DISCOVERY_FILE = 'agent.json'
const MAX_AGENT_DISCOVERY_FILE_SIZE = 16 * 1024
const MAX_AGENT_DISCOVERY_TOKEN_LENGTH = 4096

function readDiscoveryJson(discoveryPath: string): unknown {
  try {
    const discoveryFile = statSync(discoveryPath)
    if (
      !discoveryFile.isFile() ||
      discoveryFile.size > MAX_AGENT_DISCOVERY_FILE_SIZE
    ) {
      return undefined
    }
    return JSON.parse(readFileSync(discoveryPath, 'utf8'))
  } catch {
    return undefined
  }
}

/**
 * Uncached on purpose: an mtime cache cannot tell apart two writes in one
 * timestamp tick, which is what a fast agent restart produces. Parse errors
 * are dropped, not forwarded, because their message quotes the token.
 */
export function readAgentDiscoveryToken(dataDir: string): string | undefined {
  const parsed = readDiscoveryJson(join(dataDir, AGENT_DISCOVERY_FILE))
  const token =
    typeof parsed === 'object' && parsed !== null && 'token' in parsed
      ? parsed.token
      : undefined
  return typeof token === 'string' &&
    token.length > 0 &&
    token.length <= MAX_AGENT_DISCOVERY_TOKEN_LENGTH &&
    /^[\x20-\x7e]+$/.test(token)
    ? token
    : undefined
}
