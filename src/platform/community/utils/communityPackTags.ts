import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'

import type { CommunityWorkflowIndex } from '../services/communityWorkflowProvider'

function packKey(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/^(registry:|github:)/, '')
      .replace(/^https?:\/\/(www\.)?github\.com\//, '')
      .replace(/\.git$/, '')
      .split('/')
      .at(-1)
      ?.replace(/[\s_-]/g, '') ?? ''
  )
}

export function communityPackTags(
  revisions: CloudNodeRegistryRevision[],
  index: CommunityWorkflowIndex
): ReadonlyMap<string, readonly string[]> {
  return new Map(
    revisions.map((revision) => {
      const keys = [revision.name, revision.pack_id]
        .map(packKey)
        .filter(Boolean)
      const workflows = index.entries.filter((entry) =>
        entry.packs.some((pack) => keys.includes(packKey(pack)))
      )
      const tags = [
        ...new Set(
          workflows.flatMap((entry) => [
            ...entry.tags,
            ...entry.tasks,
            ...entry.models
          ])
        )
      ]
        .filter(Boolean)
        .sort()
      return [revision.revision_id, tags]
    })
  )
}
