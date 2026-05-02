/**
 * This code is adapted from rgthree-comfy's link_fixer.ts
 * @see https://github.com/rgthree/rgthree-comfy/blob/b84f39c7c224de765de0b54c55b967329011819d/src_web/common/link_fixer.ts
 *
 * MIT License
 *
 * Copyright (c) 2023 Regis Gaughan, III (rgthree)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import type {
  SerialisedGraph,
  SerialisedLinkArray,
  SerialisedLinkObject,
  SerialisedNode,
  SerialisedNodeOutput
} from './serialised'
import { describeTopologyError, toLinkContext } from './linkTopology'
import type { LinkContext, TopologyError } from './linkTopology'

export interface RepairResult<T = SerialisedGraph> {
  hasBadLinks: boolean
  fixed: boolean
  graph: T
  patched: number
  deleted: number
}

/**
 * Thrown when the repair pass detects a divergence between its in-memory
 * patched view and the live graph data — typically because the workflow's
 * topology cannot be reconciled (e.g. links pointing to slots that do not
 * exist on the target node). The attached `TopologyError` carries the
 * `[linkId, src, srcSlot, tgt, tgtSlot]` tuple so callers can report the
 * precise offending link instead of a generic invariant failure.
 */
export class LinkRepairAbortedError extends Error {
  public readonly topologyError: TopologyError
  constructor(topologyError: TopologyError) {
    super(describeTopologyError(topologyError))
    this.topologyError = topologyError
    this.name = 'LinkRepairAbortedError'
  }
}

enum IoDirection {
  INPUT,
  OUTPUT
}

interface LiveGraph extends SerialisedGraph {
  getNodeById(id: string | number): SerialisedNode | undefined
}

function isLiveGraph(graph: SerialisedGraph | LiveGraph): graph is LiveGraph {
  return typeof (graph as LiveGraph).getNodeById === 'function'
}

function getNodeById(
  graph: SerialisedGraph | LiveGraph,
  id: string | number
): SerialisedNode | undefined {
  if (isLiveGraph(graph)) return graph.getNodeById(id)
  return graph.nodes.find((n) => n.id == id)
}

function extendLink(link: SerialisedLinkArray): SerialisedLinkObject & {
  link: SerialisedLinkArray
} {
  return {
    link,
    id: link[0],
    origin_id: link[1],
    origin_slot: link[2],
    target_id: link[3],
    target_slot: link[4],
    type: link[5]
  }
}

interface RepairOptions {
  fix?: boolean
  silent?: boolean
  logger?: { log: (...args: unknown[]) => void }
}

/**
 * Best-effort repair of structurally inconsistent link data on a
 * serialised or live graph. Pass `{ fix: false }` (default) for a dry
 * run that only reports whether bad links exist.
 *
 * Throws `LinkRepairAbortedError` when the graph diverges from the
 * patched view in a way the algorithm cannot reconcile (e.g. links
 * pointing into out-of-bounds slots). The error carries a structured
 * `TopologyError` describing the offending link.
 */
export function repairLinks(
  graph: SerialisedGraph,
  options: RepairOptions = {}
): RepairResult {
  const { fix = false, silent = false, logger: _logger = console } = options
  const logger = {
    log: (...args: unknown[]) => {
      if (!silent) {
        _logger.log(...args)
      }
    }
  }

  const patchedNodeSlots: {
    [nodeId: string]: {
      inputs?: { [slot: number]: number | null }
      outputs?: {
        [slots: number]: {
          links: number[]
          changes: { [linkId: number]: 'ADD' | 'REMOVE' }
        }
      }
    }
  } = {}

  const data: {
    patchedNodes: SerialisedNode[]
    deletedLinks: number[]
  } = {
    patchedNodes: [],
    deletedLinks: []
  }

  function patchNodeSlot(
    node: SerialisedNode,
    ioDir: IoDirection,
    slot: number,
    linkId: number,
    op: 'ADD' | 'REMOVE'
  ) {
    patchedNodeSlots[node.id] = patchedNodeSlots[node.id] || {}
    const patchedNode = patchedNodeSlots[node.id]!
    if (ioDir == IoDirection.INPUT) {
      patchedNode['inputs'] = patchedNode['inputs'] || {}
      if (patchedNode['inputs']![slot] !== undefined) {
        logger.log(
          ` > Already set ${node.id}.inputs[${slot}] to ${patchedNode['inputs']![slot]!} Skipping.`
        )
        return false
      }
      const linkIdToSet = op === 'REMOVE' ? null : linkId
      const inputSlot = node.inputs?.[slot]
      if (fix && !inputSlot) {
        logger.log(
          ` > Cannot patch ${node.id}.inputs[${slot}] because the input slot is missing.`
        )
        return false
      }
      patchedNode['inputs']![slot] = linkIdToSet
      if (fix) {
        inputSlot!.link = linkIdToSet
      }
    } else {
      patchedNode['outputs'] = patchedNode['outputs'] || {}
      patchedNode['outputs']![slot] = patchedNode['outputs']![slot] || {
        links: [...(node.outputs?.[slot]?.links || [])],
        changes: {}
      }
      if (patchedNode['outputs']![slot]!['changes']![linkId] !== undefined) {
        logger.log(
          ` > Already set ${node.id}.outputs[${slot}] to ${
            patchedNode['inputs']![slot]
          }! Skipping.`
        )
        return false
      }
      patchedNode['outputs']![slot]!['changes']![linkId] = op
      if (op === 'ADD') {
        const linkIdIndex =
          patchedNode['outputs']![slot]!['links'].indexOf(linkId)
        if (linkIdIndex !== -1) {
          logger.log(
            ` > Hmmm.. asked to add ${linkId} but it is already in list...`
          )
          return false
        }
        patchedNode['outputs']![slot]!['links'].push(linkId)
        if (fix) {
          node.outputs = node.outputs || []
          node.outputs[slot] =
            node.outputs[slot] || ({} as SerialisedNodeOutput)
          node.outputs[slot]!.links = node.outputs[slot]!.links || []
          node.outputs[slot]!.links!.push(linkId)
        }
      } else {
        const linkIdIndex =
          patchedNode['outputs']![slot]!['links'].indexOf(linkId)
        if (linkIdIndex === -1) {
          logger.log(
            ` > Hmmm.. asked to remove ${linkId} but it doesn't exist...`
          )
          return false
        }
        patchedNode['outputs']![slot]!['links'].splice(linkIdIndex, 1)
        if (fix) {
          node.outputs?.[slot]!.links!.splice(linkIdIndex, 1)
        }
      }
    }
    data.patchedNodes.push(node)
    return true
  }

  function buildLinkContext(
    node: SerialisedNode,
    ioDir: IoDirection,
    slot: number,
    linkId: number
  ): LinkContext {
    if (ioDir === IoDirection.INPUT) {
      return {
        linkId,
        originId: '?',
        originSlot: -1,
        targetId: node.id,
        targetSlot: slot
      }
    }
    return {
      linkId,
      originId: node.id,
      originSlot: slot,
      targetId: '?',
      targetSlot: -1
    }
  }

  function nodeHasLinkId(
    node: SerialisedNode,
    ioDir: IoDirection,
    slot: number,
    linkId: number
  ) {
    let has = false
    if (ioDir === IoDirection.INPUT) {
      const nodeHasIt = node.inputs?.[slot]?.link === linkId
      if (patchedNodeSlots[node.id]?.['inputs']) {
        const patchedHasIt =
          patchedNodeSlots[node.id]!['inputs']![slot] === linkId
        if (fix && nodeHasIt !== patchedHasIt) {
          throw new LinkRepairAbortedError({
            kind: 'target-link-mismatch',
            link: buildLinkContext(node, ioDir, slot, linkId),
            actualLink: node.inputs?.[slot]?.link ?? null
          })
        }
        has = patchedHasIt
      } else {
        has = !!nodeHasIt
      }
    } else {
      const nodeHasIt = node.outputs?.[slot]?.links?.includes(linkId)
      if (patchedNodeSlots[node.id]?.['outputs']?.[slot]?.['changes'][linkId]) {
        const patchedHasIt =
          patchedNodeSlots[node.id]!['outputs']![slot]?.links.includes(linkId)
        if (fix && nodeHasIt !== patchedHasIt) {
          throw new LinkRepairAbortedError({
            kind: 'origin-link-not-listed',
            link: buildLinkContext(node, ioDir, slot, linkId)
          })
        }
        has = !!patchedHasIt
      } else {
        has = !!nodeHasIt
      }
    }
    return has
  }

  function nodeHasAnyLink(
    node: SerialisedNode,
    ioDir: IoDirection,
    slot: number
  ) {
    let hasAny = false
    if (ioDir === IoDirection.INPUT) {
      const nodeHasAny = node.inputs?.[slot]?.link != null
      if (patchedNodeSlots[node.id]?.['inputs']) {
        const patchedHasAny =
          patchedNodeSlots[node.id]!['inputs']![slot] != null
        if (fix && nodeHasAny !== patchedHasAny) {
          throw new LinkRepairAbortedError({
            kind: 'target-slot-out-of-bounds',
            link: buildLinkContext(node, ioDir, slot, -1),
            targetSlotCount: node.inputs?.length ?? 0
          })
        }
        hasAny = patchedHasAny
      } else {
        hasAny = !!nodeHasAny
      }
    } else {
      const nodeHasAny = node.outputs?.[slot]?.links?.length
      if (patchedNodeSlots[node.id]?.['outputs']?.[slot]?.['changes']) {
        const patchedHasAny =
          patchedNodeSlots[node.id]!['outputs']![slot]?.links.length
        if (fix && nodeHasAny !== patchedHasAny) {
          throw new LinkRepairAbortedError({
            kind: 'origin-slot-out-of-bounds',
            link: buildLinkContext(node, ioDir, slot, -1),
            originSlotCount: node.outputs?.length ?? 0
          })
        }
        hasAny = !!patchedHasAny
      } else {
        hasAny = !!nodeHasAny
      }
    }
    return hasAny
  }

  let links: Array<SerialisedLinkArray | SerialisedLinkObject> = []
  if (!Array.isArray(graph.links)) {
    links = Object.values(graph.links).reduce(
      (acc: Array<SerialisedLinkArray | SerialisedLinkObject>, v: unknown) => {
        const link = v as SerialisedLinkObject
        acc[link.id] = link
        return acc
      },
      links
    )
  } else {
    links = graph.links.filter(
      (l): l is SerialisedLinkArray | SerialisedLinkObject => l != null
    )
  }

  const linksReverse = [...links]
  linksReverse.reverse()
  for (const l of linksReverse) {
    if (!l) continue
    const linkObj =
      (l as SerialisedLinkObject).origin_slot != null
        ? (l as SerialisedLinkObject)
        : extendLink(l as SerialisedLinkArray)

    const ctx = toLinkContext(l)
    const originNode = getNodeById(graph, ctx.originId)
    const originHasLink = () =>
      nodeHasLinkId(originNode!, IoDirection.OUTPUT, ctx.originSlot, ctx.linkId)
    const patchOrigin = (op: 'ADD' | 'REMOVE', id = ctx.linkId) =>
      patchNodeSlot(originNode!, IoDirection.OUTPUT, ctx.originSlot, id, op)

    const targetNode = getNodeById(graph, ctx.targetId)
    const targetHasLink = () =>
      nodeHasLinkId(targetNode!, IoDirection.INPUT, ctx.targetSlot, ctx.linkId)
    const targetHasAnyLink = () =>
      nodeHasAnyLink(targetNode!, IoDirection.INPUT, ctx.targetSlot)
    const patchTarget = (op: 'ADD' | 'REMOVE', id = ctx.linkId) =>
      patchNodeSlot(targetNode!, IoDirection.INPUT, ctx.targetSlot, id, op)

    const originLog = `origin(${ctx.originId}).outputs[${ctx.originSlot}].links`
    const targetLog = `target(${ctx.targetId}).inputs[${ctx.targetSlot}].link`

    if (!originNode || !targetNode) {
      if (!originNode && !targetNode) {
        logger.log(
          `Link ${ctx.linkId} is invalid, both origin ${ctx.originId} and target ${ctx.targetId} do not exist`
        )
      } else if (!originNode) {
        logger.log(
          `Link ${ctx.linkId} is funky... origin ${ctx.originId} does not exist, but target ${ctx.targetId} does.`
        )
        if (targetHasLink()) {
          logger.log(
            ` > [PATCH] ${targetLog} does have link, will remove the inputs' link first.`
          )
          patchTarget('REMOVE', -1)
        }
      } else {
        logger.log(
          `Link ${ctx.linkId} is funky... target ${ctx.targetId} does not exist, but origin ${ctx.originId} does.`
        )
        if (originHasLink()) {
          logger.log(
            ` > [PATCH] Origin's links' has ${ctx.linkId}; will remove the link first.`
          )
          patchOrigin('REMOVE')
        }
      }
      continue
    }

    if (targetHasLink() || originHasLink()) {
      if (!originHasLink()) {
        logger.log(
          `${ctx.linkId} is funky... ${originLog} does NOT contain it, but ${targetLog} does.`
        )
        logger.log(
          ` > [PATCH] Attempt a fix by adding this ${ctx.linkId} to ${originLog}.`
        )
        patchOrigin('ADD')
      } else if (!targetHasLink()) {
        logger.log(
          `${ctx.linkId} is funky... ${targetLog} is NOT correct (is ${
            targetNode.inputs?.[ctx.targetSlot]?.link
          }), but ${originLog} contains it`
        )
        if (!targetHasAnyLink()) {
          logger.log(
            ` > [PATCH] ${targetLog} is not defined, will set to ${ctx.linkId}.`
          )
          let patched = patchTarget('ADD')
          if (!patched) {
            logger.log(
              ` > [PATCH] Nvm, ${targetLog} already patched. Removing ${ctx.linkId} from ${originLog}.`
            )
            patched = patchOrigin('REMOVE')
          }
        } else {
          logger.log(
            ` > [PATCH] ${targetLog} is defined, removing ${ctx.linkId} from ${originLog}.`
          )
          patchOrigin('REMOVE')
        }
      }
    }
    void linkObj
  }

  for (const l of linksReverse) {
    if (!l) continue
    const ctx = toLinkContext(l)
    const originNode = getNodeById(graph, ctx.originId)
    const targetNode = getNodeById(graph, ctx.targetId)
    if (
      (!originNode ||
        !nodeHasLinkId(
          originNode,
          IoDirection.OUTPUT,
          ctx.originSlot,
          ctx.linkId
        )) &&
      (!targetNode ||
        !nodeHasLinkId(
          targetNode,
          IoDirection.INPUT,
          ctx.targetSlot,
          ctx.linkId
        ))
    ) {
      logger.log(
        `${ctx.linkId} is def invalid; BOTH origin node ${ctx.originId} ${
          !originNode ? 'is removed' : `doesn't have ${ctx.linkId}`
        } and ${ctx.originId} target node ${
          !targetNode ? 'is removed' : `doesn't have ${ctx.linkId}`
        }.`
      )
      data.deletedLinks.push(ctx.linkId)
      continue
    }
  }

  if (fix) {
    for (let i = data.deletedLinks.length - 1; i >= 0; i--) {
      logger.log(`Deleting link #${data.deletedLinks[i]}.`)
      if (isLiveGraph(graph)) {
        delete (graph.links as Record<number, unknown>)[data.deletedLinks[i]!]
      } else {
        const idx = (
          graph.links as Array<
            SerialisedLinkArray | SerialisedLinkObject | null
          >
        ).findIndex(
          (l) =>
            l &&
            ((l as SerialisedLinkArray)[0] === data.deletedLinks[i] ||
              ('id' in l && l.id === data.deletedLinks[i]))
        )
        if (idx === -1) {
          logger.log(`INDEX NOT FOUND for #${data.deletedLinks[i]}`)
        }
        logger.log(`splicing ${idx} from links`)
        ;(graph.links as Array<unknown>).splice(idx, 1)
      }
    }
    if (!isLiveGraph(graph)) {
      graph.links = (
        graph.links as Array<SerialisedLinkArray | SerialisedLinkObject | null>
      ).filter((l): l is SerialisedLinkArray | SerialisedLinkObject => !!l)
    }
  }
  if (!data.patchedNodes.length && !data.deletedLinks.length) {
    return {
      hasBadLinks: false,
      fixed: false,
      graph,
      patched: data.patchedNodes.length,
      deleted: data.deletedLinks.length
    }
  }

  logger.log(
    `${fix ? 'Made' : 'Would make'} ${data.patchedNodes.length || 'no'} node link patches, and ${
      data.deletedLinks.length || 'no'
    } stale link removals.`
  )

  const hasChanges = !!(data.patchedNodes.length || data.deletedLinks.length)
  let hasBadLinks: boolean = hasChanges
  if (fix) {
    const rerun = repairLinks(graph, { fix: false, silent: true })
    hasBadLinks = rerun.hasBadLinks
  }

  return {
    hasBadLinks,
    fixed: fix && hasChanges && !hasBadLinks,
    graph,
    patched: data.patchedNodes.length,
    deleted: data.deletedLinks.length
  }
}
