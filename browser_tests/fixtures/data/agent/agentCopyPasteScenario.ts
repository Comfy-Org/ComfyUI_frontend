// Selection collapse and clipboard gating never depend on the node type, and
// the recording holds core types only, so EmptyLatentImage stands in for the
// reported Seedance node and the seed's SaveImage for SaveVideo.
export const COPY_PASTE_SCENARIO = {
  conversation: 'agent-rec-three-sequential-adds',
  agentAddedType: 'EmptyLatentImage',
  earlierNode: { id: '9', type: 'SaveImage' }
} as const
