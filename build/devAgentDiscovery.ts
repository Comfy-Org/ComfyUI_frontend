import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Name of the discovery file the standalone agent publishes in its data
 * directory, mirroring `localdb.DiscoveryFile` in `Comfy-Org/cloud`. The file
 * is `{ port, token, pid }`, mode 0600, written atomically through a temp file
 * and a rename.
 */
export const AGENT_DISCOVERY_FILE = 'agent.json'
const MAX_AGENT_DISCOVERY_TOKEN_LENGTH = 4096

/**
 * Reads the bearer token the standalone agent is accepting *right now*.
 *
 * The agent mints a fresh 32-byte session token on every start when
 * `AGENT_SESSION_TOKEN` is unset and atomically replaces its discovery file
 * with it, so a token captured once — when the dev server started — is stale
 * the moment the agent restarts, and every `/api/agent` request answers 401
 * until the dev server itself is restarted. Reading the file per request is
 * what lets a restarted agent be reached again without restarting Vite, the
 * browser tab, or ComfyUI.
 *
 * Deliberately uncached. The file is tens of bytes on local disk, and a cache
 * keyed on mtime cannot tell two writes inside one filesystem timestamp tick
 * apart — which is exactly a fast agent restart, the case this exists for.
 *
 * `undefined` means "no usable token published": the file is absent (the agent
 * has not started, or is between its bind and its publish), or it does not
 * parse, or it carries no token. Callers send the request unauthenticated and
 * let the agent's own `LocalAuth` answer 401; the next request re-reads, so the
 * pairing heals on its own.
 *
 * The failure is never reported with the file's contents attached — including
 * indirectly, which is why a `JSON.parse` error is dropped rather than
 * forwarded: its message quotes the input, and the input is a live credential.
 */
export function readAgentDiscoveryToken(dataDir: string): string | undefined {
  let raw: string
  try {
    raw = readFileSync(join(dataDir, AGENT_DISCOVERY_FILE), 'utf8')
  } catch {
    return undefined
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  const token = (parsed as { token?: unknown } | null)?.token
  return typeof token === 'string' &&
    token.length > 0 &&
    token.length <= MAX_AGENT_DISCOVERY_TOKEN_LENGTH &&
    /^[\x20-\x7e]+$/.test(token)
    ? token
    : undefined
}
