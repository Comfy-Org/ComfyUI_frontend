type RecordedHit = {
  objectID: string
  id: string
  name: string
  description: string
  total_install: number
  publisher_id: string
  latest_version: string
  comfy_nodes: string[]
}

export type RecordedResponse = {
  nbHits: number
  hits: RecordedHit[]
}

export type NodesIndexFixture = {
  _README: string
  _recordedFor: string[]
  responses: Record<string, RecordedResponse>
}
