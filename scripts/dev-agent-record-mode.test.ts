import { describe, expect, it } from 'vitest'

import { containerNamesPublishing } from './dev-agent-record-mode'

describe('containerNamesPublishing', () => {
  const dockerPs = `cloud-postgres-1 postgres:16 0.0.0.0:54331->5432/tcp
cloud-redis-1 redis:7 0.0.0.0:6379->6379/tcp
`

  it('names the container publishing the requested port', () => {
    expect(containerNamesPublishing(dockerPs, 'postgres', 54331)).toEqual([
      'cloud-postgres-1'
    ])
  })

  it('tolerates the trailing blank row docker ps always emits', () => {
    expect(containerNamesPublishing(dockerPs, 'mysql', 3306)).toEqual([])
    expect(containerNamesPublishing('', 'postgres', 54331)).toEqual([])
  })
})
