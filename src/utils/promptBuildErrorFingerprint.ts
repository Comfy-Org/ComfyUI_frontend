import { toError } from '@comfyorg/shared-frontend-utils/errorUtil'

/**
 * Positions where a prompt build thrower interpolates a node id, node title,
 * subgraph name or subgraph instance path into its message without bracketing
 * it. Node ids are branded strings, so stripping digits does not reach them:
 * each position gets a placeholder that keeps the failure kind and drops the
 * identity. Every entry names its thrower, so a new message shape is added
 * next to the one it belongs with. Applied in order.
 */
const IDENTITY_POSITIONS: readonly (readonly [RegExp, string])[] = [
  // ExecutableNodeDTO.resolveInput / .resolveOutput RecursionError:
  // `... of node <id> (<title>) at path <a:b>. ... UniqueID: [<id>]`
  [/ of node [\s\S]*$/, ' of node N'],
  // SubgraphNode.getInnerNodes RecursionError:
  // `... in node <id> (<title>) of subgraph '<name>'. ...`
  [/ in node [\s\S]*? of subgraph [\s\S]*$/, ' in node N of subgraph N'],
  // ExecutableNodeDTO.resolveInput and SubgraphNode.rootGraph NullGraphError:
  // `SubgraphNode <id> has no graph[ during input resolution]`
  [/\b(Subgraph)?Node \S+ has no graph/, '$1Node N has no graph'],
  // Bracketed ids, execution ids and slot indexes: `id [12:7] slot [0]`.
  [/\[[^\]]*\]/g, '[]'],
  // ExecutableNodeDTO.resolveSubgraphOutput TypeError:
  // `Node is not a subgraph node: <id>`
  [/: \S+$/, ': N'],
  // Remaining bare numbers: slot indexes, recursion depths, numeric ids.
  [/\d+/g, 'N']
]

/** Sentry fingerprint for a prompt build failure, with node ids, titles, subgraph names, paths and slot indexes removed. */
export function promptBuildErrorFingerprint(error: unknown): string[] {
  const { name, message } = toError(error)
  const shape = IDENTITY_POSITIONS.reduce(
    (text, [position, placeholder]) => text.replace(position, placeholder),
    message
  )
  return ['error_building_prompt', name, shape]
}
