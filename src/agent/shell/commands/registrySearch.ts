import { useComfyRegistryService } from '@/services/comfyRegistryService'
import type { components } from '@comfyorg/registry-types'

import type { Command, CommandRegistry } from '../types'
import { emptyIter, stringIter } from '../types'

type Pack = components['schemas']['Node']
type ComfyNode = components['schemas']['ComfyNode']

const DEFAULT_LIMIT = 20

function packLine(p: Pack): string {
  const id = p.id ?? '?'
  const ver = p.latest_version?.version ?? 'unknown'
  const name = p.name ?? id
  const desc = (p.description ?? '').replace(/\s+/g, ' ').slice(0, 80)
  return `${id}@${ver}  ${name}${desc ? '  — ' + desc : ''}`
}

function nodeLine(n: ComfyNode): string {
  const name = n.comfy_node_name ?? '?'
  const cat = n.category ?? ''
  const desc = (n.description ?? '').replace(/\s+/g, ' ').slice(0, 80)
  const tail = [cat, desc].filter(Boolean).join(' — ')
  return tail ? `${name}  (${tail})` : name
}

/**
 * node-search-registry <pattern>
 *
 * Search the public Comfy Registry for node-classes matching <pattern>
 * across ALL published custom-node packs — including ones the user has
 * not installed locally. Use this when local `node-search` returns no
 * results: the node may exist in a pack that hasn't been installed yet.
 *
 * Output: one pack per line with install hint underneath.
 */
const nodeSearchRegistry: Command = async (ctx) => {
  const pattern = ctx.argv.slice(1).join(' ').trim()
  if (!pattern) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: node-search-registry <pattern>'
    }
  }
  const svc = useComfyRegistryService()
  const res = await svc.search({
    comfy_node_search: pattern,
    limit: DEFAULT_LIMIT
  })
  const packs = res?.nodes ?? []
  if (packs.length === 0) {
    return {
      stdout: stringIter(
        `no registry packs expose a node matching "${pattern}".\n` +
          'note: registry only indexes published packs. Try `pack-search ' +
          pattern +
          '` for pack-name/description match, or fall back to a github repo search.\n'
      ),
      exitCode: 0
    }
  }
  const total = res?.total ?? packs.length
  const lines = packs.map(
    (p) => packLine(p) + (p.id ? '\n  inspect: pack-info ' + p.id : '')
  )
  const header =
    packs.length < total
      ? `${packs.length} of ${total} pack(s) expose a node matching "${pattern}". To install one, ask the user to use ComfyUI-Manager (Settings → Extensions) — there is no shell command for pack installs yet.\n`
      : `${packs.length} pack(s) expose a node matching "${pattern}". To install one, ask the user to use ComfyUI-Manager (Settings → Extensions) — there is no shell command for pack installs yet.\n`
  return {
    stdout: stringIter(header + lines.join('\n') + '\n'),
    exitCode: 0
  }
}

/**
 * pack-search <pattern>
 *
 * Search the public Comfy Registry for packs whose name or description
 * matches <pattern>. Complements `node-search-registry` (which matches
 * node-class names) — use this when looking for a pack by topic rather
 * than by a specific node-class.
 */
const packSearch: Command = async (ctx) => {
  const pattern = ctx.argv.slice(1).join(' ').trim()
  if (!pattern) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: pack-search <pattern>'
    }
  }
  const svc = useComfyRegistryService()
  const res = await svc.search({ search: pattern, limit: DEFAULT_LIMIT })
  const packs = res?.nodes ?? []
  if (packs.length === 0) {
    return {
      stdout: stringIter(`no registry packs match "${pattern}".\n`),
      exitCode: 0
    }
  }
  const total = res?.total ?? packs.length
  const header =
    packs.length < total
      ? `${packs.length} of ${total} pack(s) match "${pattern}":\n`
      : `${packs.length} pack(s) match "${pattern}":\n`
  const lines = packs.map(
    (p) => packLine(p) + (p.id ? '\n  inspect: pack-info ' + p.id : '')
  )
  return {
    stdout: stringIter(header + lines.join('\n') + '\n'),
    exitCode: 0
  }
}

/**
 * pack-info <pack_id>
 *
 * List all node-classes provided by <pack_id>'s latest version. Use this
 * to verify a pack actually contains the node you want before installing
 * it — registry node-search returns the pack, but not the full node list.
 */
const packInfo: Command = async (ctx) => {
  const packId = ctx.argv[1]?.trim()
  if (!packId) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: pack-info <pack_id>'
    }
  }
  const svc = useComfyRegistryService()
  const pack = await svc.getPackById(packId)
  if (!pack) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: `pack-info: pack "${packId}" not found in registry`
    }
  }
  const version = pack.latest_version?.version
  if (!version) {
    return {
      stdout: stringIter(packLine(pack) + '\n  (no published version)\n'),
      exitCode: 0
    }
  }
  const defs = await svc.getNodeDefs({ packId, version })
  const nodes = defs?.comfy_nodes ?? []
  const head = packLine(pack)
  if (nodes.length === 0) {
    return {
      stdout: stringIter(head + '\n  (this pack publishes no node defs)\n'),
      exitCode: 0
    }
  }
  return {
    stdout: stringIter(
      head +
        `\nnodes (${nodes.length}):\n` +
        nodes.map((n) => '  ' + nodeLine(n)).join('\n') +
        '\n'
    ),
    exitCode: 0
  }
}

export function registerRegistrySearchCommands(
  registry: CommandRegistry
): void {
  registry.register('node-search-registry', nodeSearchRegistry)
  registry.register('pack-search', packSearch)
  registry.register('pack-info', packInfo)
}
