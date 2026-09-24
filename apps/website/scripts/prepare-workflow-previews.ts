import { z } from 'astro/zod'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { parseWorkflowCatalog } from '../src/config/workshop-workflow-catalog-schema'
import { isDirectExecution } from './script-entry-point'

const coordinate = z.number().finite().min(-1e6).max(1e6)
const point = z.tuple([coordinate, coordinate])
const id = z.union([z.number().int(), z.string()])
const slots = z
  .array(z.object({ name: z.string() }))
  .max(100)
  .default([])
const bounds = z.tuple([coordinate, coordinate, coordinate, coordinate])
const node = z.object({
  id,
  type: z.string(),
  title: z.string().optional(),
  pos: point,
  size: z.tuple([coordinate.positive(), coordinate.positive()]),
  inputs: slots,
  outputs: slots
})
const link = z.object({
  origin_id: id,
  origin_slot: z.number().int().nonnegative(),
  target_id: id,
  target_slot: z.number().int().nonnegative()
})
const boundary = z.object({ id, bounding: bounds })
const graph = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  nodes: z.array(node).min(1).max(500),
  inputs: slots,
  outputs: slots,
  inputNode: boundary.optional(),
  outputNode: boundary.optional(),
  links: z
    .array(
      z.union([
        link,
        z
          .tuple([
            z.number(),
            id,
            z.number().int().nonnegative(),
            id,
            z.number().int().nonnegative(),
            z.unknown()
          ])
          .transform(([, origin_id, origin_slot, target_id, target_slot]) => ({
            origin_id,
            origin_slot,
            target_id,
            target_slot
          }))
      ])
    )
    .max(5000)
    .default([])
})
const workflow = graph.extend({
  definitions: z.object({ subgraphs: z.array(graph).max(20) }).optional()
})

function escape(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

export function workflowPreviewSvg(raw: unknown): string {
  const source = workflow.parse(raw)
  const subgraphs = source.definitions?.subgraphs ?? []
  const names = new Map(subgraphs.map((item) => [item.id, item.name]))
  let offset = 0
  const panels = [source, ...subgraphs].map((level) => {
    const nodes = level.nodes.filter(
      (item) => !['Note', 'MarkdownNote'].includes(item.type)
    )
    for (const [data, input] of [
      [level.inputNode, true],
      [level.outputNode, false]
    ] as const) {
      if (!data) continue
      const [x, y, width, height] = data.bounding
      nodes.push({
        id: data.id,
        type: input ? 'Workflow inputs' : 'Workflow outputs',
        pos: [x, y],
        size: [width, height],
        inputs: input ? [] : level.outputs,
        outputs: input ? level.inputs : []
      })
    }
    if (!nodes.length) throw new Error('No graph nodes to preview')
    const byId = new Map(nodes.map((item) => [item.id, item]))
    if (byId.size !== nodes.length) throw new Error('Duplicate preview node')
    const left = Math.min(...nodes.map((item) => item.pos[0])) - 30
    const top = Math.min(...nodes.map((item) => item.pos[1])) - 56
    const width =
      Math.max(...nodes.map((item) => item.pos[0] + item.size[0])) - left + 30
    const height =
      Math.max(...nodes.map((item) => item.pos[1] + item.size[1])) - top + 30
    const scale = Math.min(1, 1136 / width)
    const panelHeight = height * scale + 86
    const links = level.links
      .map((edge) => {
        const from = byId.get(edge.origin_id)
        const to = byId.get(edge.target_id)
        if (
          !from ||
          !to ||
          !from.outputs[edge.origin_slot] ||
          !to.inputs[edge.target_slot]
        )
          throw new Error('Preview link has no matching node slot')
        const x = from.pos[0] + from.size[0]
        const y = from.pos[1] + 14 + edge.origin_slot * 20
        const tx = to.pos[0]
        const ty = to.pos[1] + 14 + edge.target_slot * 20
        const curve = Math.max(60, Math.abs(tx - x) / 2)
        return `<path d="M${x} ${y} C${x + curve} ${y},${tx - curve} ${ty},${tx} ${ty}"/>`
      })
      .join('')
    const cards = nodes
      .map((item) => {
        const title =
          item.title ??
          names.get(item.type) ??
          item.type.replace(/([a-z])([A-Z])/g, '$1 $2')
        const labels = [item.inputs, item.outputs]
          .flatMap((ports, side) =>
            ports.map(
              (port, index) =>
                `<text x="${side ? item.size[0] - 10 : 10}" y="${19 + index * 20}" text-anchor="${side ? 'end' : 'start'}" class="slot">${escape(port.name.slice(0, 24))}</text>`
            )
          )
          .join('')
        return `<svg x="${item.pos[0]}" y="${item.pos[1] - 26}" width="${item.size[0]}" height="${item.size[1] + 26}" overflow="hidden"><rect width="100%" height="100%" rx="8" class="node"/><path d="M0 26H${item.size[0]}" class="divider"/><text x="10" y="18" class="title">${escape(title)}</text><g transform="translate(0 26)">${labels}</g></svg>`
      })
      .join('')
    const panel = `<g transform="translate(0 ${offset})"><text x="32" y="36" class="heading">${escape(level.name ?? 'Workflow overview')}</text><g transform="translate(${32 + (1136 - width * scale) / 2} 64) scale(${scale}) translate(${-left} ${-top})"><g class="links">${links}</g>${cards}</g></g>`
    offset += panelHeight
    return panel
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${Math.ceil(offset)}" viewBox="0 0 1200 ${Math.ceil(offset)}" role="img"><title>Workflow graph and nested graphs</title><desc>Original node positions and connections. Notes and widget previews are available in the downloadable workflow.</desc><style>text{font-family:Arial,sans-serif;fill:#c2bfb9}.heading{font-size:20px;fill:#f0efed}.title{font-size:14px}.slot{font-size:12px}.node{fill:#2a2330;stroke:#7e7c78;stroke-width:1}.divider{stroke:#7e7c78;stroke-opacity:.5}.links{fill:none;stroke:#f2ff59;stroke-width:2;stroke-opacity:.55}</style><rect width="100%" height="100%" fill="#211927"/>${panels.join('')}</svg>\n`
}

function main() {
  const site = join(import.meta.dirname, '..')
  const target = join(site, 'public/workflows/prepared')
  const entries = parseWorkflowCatalog(
    readFileSync(join(site, 'src/content/workshop-workflows.jsonl'), 'utf8')
  )
  mkdirSync(target, { recursive: true })
  for (const entry of entries) {
    if (entry.source.repository !== 'Comfy-Org/ComfyUI_frontend')
      throw new Error('Prepare external sources separately')
    const path = `apps/website/public/workflows/graphs/${basename(entry.source.path)}`
    const original = execFileSync(
      'git',
      ['show', `${entry.source.commit}:${path}`],
      { cwd: site, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
    )
    const raw: unknown = JSON.parse(original)
    const svg = workflowPreviewSvg(raw)
    const name = entry.id.slice('workflows/'.length)
    writeFileSync(join(target, `${name}.json`), original)
    writeFileSync(join(target, `${name}.svg`), svg)
  }
}

if (isDirectExecution(process.argv[1], import.meta.filename)) main()
