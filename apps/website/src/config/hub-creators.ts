import snapshot from '@/data/hub-creators.snapshot.json' with { type: 'json' }
import { hubCreators, hubCreatorsSnapshotSchema } from '@/lib/hub/creators'

export const creators = hubCreators(hubCreatorsSnapshotSchema.parse(snapshot))

export const creatorPaths = () =>
  creators.map((creator) => ({
    params: { username: creator.username },
    props: { creator }
  }))
