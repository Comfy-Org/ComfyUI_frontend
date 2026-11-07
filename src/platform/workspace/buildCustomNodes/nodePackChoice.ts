import type {
  BuildCustomNode,
  NodePack
} from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'

/** Which code of a node pack the Build installs. */
export type NodePackVersionChoice =
  | { kind: 'latest'; version: string }
  | { kind: 'version'; version: string }
  | { kind: 'defaultBranch'; repository: string }
  | { kind: 'commit'; hash: string; repository: string }

export interface PickedNodePack {
  pack: NodePack
  choice: NodePackVersionChoice
}

/** How a version reads in the picker: a version or hash, or a named code line. */
export type NodePackVersionLabel =
  | { kind: 'text'; text: string }
  | { kind: 'defaultBranch' }
  | { kind: 'uploaded' }

const COMMIT_HASH = /^[0-9a-f]{7,40}$/i
const SHORT_HASH_LENGTH = 7

/** The choice a pack starts with; null when the Build cannot install it. */
export function defaultVersionChoice(
  pack: NodePack
): NodePackVersionChoice | null {
  if (pack.latestVersion) return { kind: 'latest', version: pack.latestVersion }
  if (pack.repository)
    return { kind: 'defaultBranch', repository: pack.repository }
  return null
}

export function isPinnedChoice(choice: NodePackVersionChoice): boolean {
  return choice.kind === 'version' || choice.kind === 'commit'
}

export function isCommitHash(value: string): boolean {
  return COMMIT_HASH.test(value)
}

export function choiceLabel(
  choice: NodePackVersionChoice
): NodePackVersionLabel {
  switch (choice.kind) {
    case 'latest':
    case 'version':
      return { kind: 'text', text: choice.version }
    case 'commit':
      return { kind: 'text', text: choice.hash.slice(0, SHORT_HASH_LENGTH) }
    case 'defaultBranch':
      return { kind: 'defaultBranch' }
  }
}

export function buildNodeLabel(entry: BuildCustomNode): NodePackVersionLabel {
  if ('registryVersion' in entry)
    return { kind: 'text', text: entry.registryVersion }
  if ('blobId' in entry) return { kind: 'uploaded' }
  if (entry.gitRef) return { kind: 'text', text: entry.gitRef }
  if (entry.commit)
    return { kind: 'text', text: entry.commit.slice(0, SHORT_HASH_LENGTH) }
  return { kind: 'defaultBranch' }
}

function normalizedRepository(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
}

/** The Build's entry for this registry pack, matched on id, then repository. */
export function buildEntryFor(
  pack: NodePack,
  entries: readonly BuildCustomNode[]
): BuildCustomNode | undefined {
  const byId = entries.find((entry) => 'id' in entry && entry.id === pack.id)
  if (byId || !pack.repository) return byId
  const repository = normalizedRepository(pack.repository)
  return entries.find(
    (entry) =>
      'repository' in entry &&
      normalizedRepository(entry.repository) === repository
  )
}

export function registryIdOf(entry: BuildCustomNode): string | undefined {
  return 'id' in entry ? entry.id : undefined
}

/** The Build definition entry that installs `pack` at `choice`. */
export function toBuildCustomNode({
  pack,
  choice
}: PickedNodePack): BuildCustomNode {
  switch (choice.kind) {
    case 'latest':
    case 'version':
      return { name: pack.name, id: pack.id, registryVersion: choice.version }
    case 'commit':
      return {
        name: pack.name,
        id: pack.id,
        repository: choice.repository,
        commit: choice.hash
      }
    case 'defaultBranch':
      return { name: pack.name, id: pack.id, repository: choice.repository }
  }
}
