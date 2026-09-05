// @vitest-environment node
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { PROJECT_ROOT, parseOptions } from './dev-agent-options'

describe('parseOptions', () => {
  it('returns safe defaults with derived companion ports', () => {
    expect(parseOptions([])).toEqual({
      agentPort: 6286,
      airBin: process.env.AIR_BIN ?? resolve(homedir(), 'go/bin/air'),
      catalog: '',
      cloudRepo: resolve(PROJECT_ROOT, '../cloud'),
      comfyUrl: 'http://127.0.0.1:8188',
      docHostPort: 8096,
      engine: 'inline',
      frontendPort: 6207,
      healthPort: 6287,
      help: false,
      pgExec: '',
      record: false,
      temporalPort: 7234,
      temporalUiPort: 8234
    })
  })

  it('parses a temporal record invocation and resolves file paths', () => {
    expect(
      parseOptions([
        '--record',
        '--catalog',
        'fixtures/conversation.json',
        '--cloud-repo',
        '../cloud-dev',
        '--air-bin',
        'bin/air',
        '--comfy-url',
        'http://127.0.0.1:9000',
        '--agent-port',
        '7100',
        '--frontend-port',
        '7200',
        '--doc-host-port',
        '7300',
        '--engine',
        'temporal',
        '--temporal-port',
        '7400',
        '--pg-exec',
        'psql -At -c'
      ])
    ).toMatchObject({
      record: true,
      catalog: resolve('fixtures/conversation.json'),
      cloudRepo: resolve('../cloud-dev'),
      airBin: resolve('bin/air'),
      comfyUrl: 'http://127.0.0.1:9000',
      agentPort: 7100,
      healthPort: 7101,
      frontendPort: 7200,
      docHostPort: 7300,
      engine: 'temporal',
      temporalPort: 7400,
      temporalUiPort: 8400,
      pgExec: 'psql -At -c'
    })
  })

  it.for([
    { args: ['--record'], message: '--record requires --catalog' },
    {
      args: ['--engine', 'temporal'],
      message: '--engine temporal applies to --record only'
    },
    {
      args: ['--engine', 'remote'],
      message: '--engine must be inline or temporal'
    },
    {
      args: ['--frontend-port', '0'],
      message: '--frontend-port must be an integer'
    },
    {
      args: ['--agent-port', '6207'],
      message: 'Agent and frontend ports must be different'
    },
    { args: ['--agent-port', '6206'], message: 'agent port + 1' },
    {
      args: ['--temporal-port', '65000'],
      message: 'must leave room for the Temporal UI port'
    },
    { args: ['--cloud-repo'], message: '--cloud-repo requires a value' },
    { args: ['--unknown'], message: 'Unknown option: --unknown' }
  ])('rejects an invalid launcher contract: $message', ({ args, message }) => {
    expect(() => parseOptions(args)).toThrow(message)
  })
})
