// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  containerServiceFromDockerPs,
  pgContainerExecCommand,
  recordServiceExecCommands,
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

  it('wires runRecord service ports through container lookup and command builders', async () => {
    const requests: Array<[number, string, string]> = []
    const commands = await recordServiceExecCommands(
      { pgExec: '', pgPort: 55431, redisExec: '', redisPort: 6389 },
      async (port, service, image) => {
        requests.push([port, service, image])
        return {
          name: service === 'Postgres' ? 'record-pg' : 'record-redis',
          port: service === 'Postgres' ? 55432 : 6390
        }
      }
    )

    expect(requests).toEqual([
      [55431, 'Postgres', 'postgres'],
      [6389, 'Redis', 'redis']
    ])
    expect(commands).toEqual({
      pgExec:
        'docker exec -i record-pg psql -p 55432 -U postgres -d postgres -At -c',
      redisExec: 'docker exec -i record-redis redis-cli -p 6390'
    })
  })

  it('ignores non-TCP mappings, deduplicates one container, and expands ranges', () => {
    const dockerPs = [
      'record-redis redis:7 0.0.0.0:6389->6399/udp, 0.0.0.0:6389-6390->6390-6391/tcp, [::]:6389->6390/tcp'
    ].join('\n')

    expect(
      containerServiceFromDockerPs(dockerPs, 6389, 'Redis', 'redis')
    ).toEqual({ name: 'record-redis', port: 6390 })
    expect(
      containerServiceFromDockerPs(dockerPs, 6390, 'Redis', 'redis')
    ).toEqual({ name: 'record-redis', port: 6391 })
  })
})
