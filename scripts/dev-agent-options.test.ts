import { describe, expect, it } from 'vitest'

import { parseOptions } from './dev-agent-options'
import { parseExecCommand } from './dev-agent-record-mode'

describe('dev agent options', () => {
  it.for([
    ['6286', 'Temporal port 6286 collides with the agent port'],
    ['6287', 'Temporal port 6287 collides with the agent health port'],
    ['5207', 'Temporal UI port 6207 collides with the frontend port'],
    ['7096', 'Temporal UI port 8096 collides with the doc host port']
  ])('rejects Temporal port collisions at %s', ([port, message]) => {
    expect(() =>
      parseOptions([
        '--record',
        '--catalog',
        'fixture.json',
        '--engine',
        'temporal',
        '--temporal-port',
        port
      ])
    ).toThrow(message)
  })

  it('preserves quoted pg-exec arguments', () => {
    expect(
      parseExecCommand(`"/tmp/Postgres Tools/psql" -U postgres -c`)
    ).toEqual(['/tmp/Postgres Tools/psql', '-U', 'postgres', '-c'])
  })

  it('rejects an empty pg-exec command', () => {
    expect(() => parseExecCommand('   ')).toThrow(
      '--pg-exec must contain a command'
    )
  })
})
