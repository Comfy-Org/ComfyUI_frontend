import { api } from '@/scripts/api'

import type { Command, CommandRegistry } from '../types'
import { emptyIter, stringIter } from '../types'

interface ExternalModelEntry {
  name: string
  type?: string
  base: string
  save_path: string
  filename: string
  url: string
}

/**
 * Fetch ComfyUI-Manager's curated model list and return a map from url →
 * entry. Manager's whitelist check requires save_path+base+filename to match
 * an entry; we lift those values from here automatically.
 */
async function fetchManagerModelList(): Promise<ExternalModelEntry[]> {
  const res = await fetch(api.apiURL('/externalmodel/getlist?mode=cache'))
  if (!res.ok) throw new Error(`externalmodel/getlist ${res.status}`)
  const json = (await res.json()) as { models?: ExternalModelEntry[] }
  return json.models ?? []
}

/**
 * install-model <url> <saveAs>
 *      OR install-model --find <filename>  (search the DB)
 *
 * Queue a model download in ComfyUI-Manager. <saveAs> is the target path
 * relative to ComfyUI's models dir, e.g.:
 *   install-model https://huggingface.co/.../model.safetensors checkpoints/model.safetensors
 *
 * The command auto-fills required `base` and exact `save_path` from
 * Manager's curated model list (/externalmodel/getlist). If the URL isn't
 * recognised, installation will still be attempted with save_path=type,
 * but the Manager whitelist may reject it.
 *
 * Requires ComfyUI-Manager. 404 → manager not available.
 */
const installModel: Command = async (ctx) => {
  const args = ctx.argv.slice(1)
  if (args[0] === '--find') {
    const query = args.slice(1).join(' ').trim()
    if (!query) {
      return {
        stdout: emptyIter(),
        exitCode: 2,
        stderr: 'usage: install-model --find <filename-substring>'
      }
    }
    try {
      const models = await fetchManagerModelList()
      const lower = query.toLowerCase()
      const matches = models.filter(
        (m) =>
          m.filename?.toLowerCase().includes(lower) ||
          m.name?.toLowerCase().includes(lower)
      )
      if (matches.length === 0) {
        return {
          stdout: stringIter('(no matches in manager model list)\n'),
          exitCode: 0
        }
      }
      const lines = matches
        .slice(0, 20)
        .map((m) => `${m.save_path}/${m.filename}  [${m.base}]\n  ${m.url}`)
      lines.push(
        '',
        `${matches.length} match(es). Use the URL + save_path/filename shown.`
      )
      return { stdout: stringIter(lines.join('\n') + '\n'), exitCode: 0 }
    } catch (err) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: err instanceof Error ? err.message : String(err)
      }
    }
  }

  const [url, saveAs] = args
  if (!url || !saveAs) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr:
        'usage: install-model <url> <save_path/filename>\n' +
        '       install-model --find <filename>         # search Manager DB\n' +
        '  example: install-model https://huggingface.co/stabilityai/sdxl-vae/resolve/main/sdxl_vae.safetensors vae/SDXL/sdxl_vae.safetensors'
    }
  }
  const lastSlash = saveAs.lastIndexOf('/')
  if (lastSlash <= 0) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr:
        'install-model: <saveAs> must be of the form "<save_path>/<filename>"\n' +
        '  hint: install-model --find <filename> to look up the exact save_path'
    }
  }
  const savePath = saveAs.slice(0, lastSlash)
  const filename = saveAs.slice(lastSlash + 1)
  const type = savePath.split('/')[0]
  if (!filename) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'install-model: filename is empty'
    }
  }

  // Auto-fill required `base` from Manager's curated list (whitelist check
  // in manager_server.py requires save_path + base + filename match).
  let base = 'Other'
  try {
    const models = await fetchManagerModelList()
    const entry =
      models.find((m) => m.url === url) ??
      models.find((m) => m.filename === filename && m.save_path === savePath)
    if (entry) base = entry.base
  } catch {
    /* Manager list unreachable — try anyway */
  }

  // Legacy endpoint. The v2 routes in the frontend's type schema are only
  // present in manager-v4 (pip-installed); most deployments run main.
  const uiId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : String(Date.now())

  const body = {
    name: filename,
    type,
    base,
    url,
    filename,
    save_path: savePath,
    ui_id: uiId
  }

  try {
    const res = await fetch(api.apiURL('/manager/queue/install_model'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (res.status === 404) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr:
          'install-model: ComfyUI-Manager not available on this backend.\n' +
          '  The user must install it manually and restart ComfyUI.'
      }
    }
    if (res.status === 403) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: `install-model: rejected by security policy (403). URL may be on a deny list.`
      }
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: `install-model: queue failed (${res.status}) ${text.slice(0, 200)}`
      }
    }
    // Queue must be started after adding tasks (matches manager UI flow).
    // Route is POST (legacy Manager) — GET returns 404.
    const startRes = await fetch(api.apiURL('/manager/queue/start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
    const startOk = startRes.ok || startRes.status === 409 // 409 = already running
    return {
      stdout: stringIter(
        `queued install of ${saveAs} from ${url}\n` +
          `  ui_id: ${uiId}\n` +
          (startOk
            ? '  queue started — track with: install-status\n'
            : `  WARNING: queue-start returned ${startRes.status}; task may not run\n`)
      ),
      exitCode: 0
    }
  } catch (err) {
    // A bare TypeError "Failed to fetch" almost always means the Manager
    // route isn't registered (plugin missing) and the request never reached
    // a real handler. Surface that explicitly so the user knows to install
    // ComfyUI-Manager rather than debugging their network.
    const msg = err instanceof Error ? err.message : String(err)
    const hint = /Failed to fetch/i.test(msg)
      ? '\n  hint: ComfyUI-Manager plugin is likely not installed on this backend.\n' +
        '        See: https://github.com/Comfy-Org/ComfyUI-Manager'
      : ''
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: msg + hint
    }
  }
}

/**
 * install-status
 *
 * Show the manager install queue: what's running, pending, and recent
 * history. Useful right after install-model to watch progress.
 */
interface ManagerQueueStatus {
  running_queue?: Array<{ ui_id: string; kind: string; params?: unknown }>
  pending_queue?: Array<{ ui_id: string; kind: string; params?: unknown }>
}

const installStatus: Command = async () => {
  try {
    const statusRes = await fetch(api.apiURL('/manager/queue/status'))
    if (statusRes.status === 404) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: 'install-status: ComfyUI-Manager not available on this backend.'
      }
    }
    if (!statusRes.ok) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: `install-status: queue/status failed (${statusRes.status})`
      }
    }
    const status = (await statusRes.json()) as ManagerQueueStatus & {
      done_count?: number
      in_progress_count?: number
      is_processing?: boolean
    }

    const lines: string[] = []
    lines.push(
      `processing: ${status.is_processing ? 'yes' : 'no'}` +
        `  done: ${status.done_count ?? 0}` +
        `  in_progress: ${status.in_progress_count ?? 0}`
    )
    lines.push(`running: ${status.running_queue?.length ?? 0}`)
    for (const t of status.running_queue ?? []) {
      lines.push(`  [${t.ui_id.slice(0, 8)}] ${t.kind}`)
    }
    lines.push(`pending: ${status.pending_queue?.length ?? 0}`)
    for (const t of status.pending_queue ?? []) {
      lines.push(`  [${t.ui_id.slice(0, 8)}] ${t.kind}`)
    }
    return { stdout: stringIter(lines.join('\n') + '\n'), exitCode: 0 }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const hint = /Failed to fetch/i.test(msg)
      ? '\n  hint: ComfyUI-Manager plugin is likely not installed on this backend.'
      : ''
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: msg + hint
    }
  }
}

export function registerInstallCommands(registry: CommandRegistry): void {
  registry.register('install-model', installModel)
  registry.register('install-status', installStatus)
}
