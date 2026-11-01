// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  containerServiceFromDockerPs,
  pgContainerExecCommand,
  redisContainerExecCommand
} from './dev-agent-record-mode'

describe('record-mode container commands', () => {
  it("uses each container mapping's non-default internal port", () => {
    const dockerPs = [
      'record-pg postgres:17 127.0.0.1:55431->55432/tcp',
      'record-redis redis@sha256:abc 0.0.0.0:6389->6390/tcp, [::]:6389->6390/tcp'
    ].join('\n')

    const postgres = containerServiceFromDockerPs(
      dockerPs,
      55431,
      'Postgres',
      'postgres'
    )
    const redis = containerServiceFromDockerPs(dockerPs, 6389, 'Redis', 'redis')

    expect(pgContainerExecCommand(postgres)).toBe(
      'docker exec -i record-pg psql -p 55432 -U postgres -d postgres -At -c'
    )
    expect(redisContainerExecCommand(redis)).toBe(
      'docker exec -i record-redis redis-cli -p 6390'
    )
  })
})
