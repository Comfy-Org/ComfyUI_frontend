import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  AGENT_DISCOVERY_FILE,
  readAgentDiscoveryToken
} from './devAgentDiscovery.ts'

describe('agent discovery token', () => {
  let dataDir: string

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'agent-discovery-'))
  })

  afterEach(async () => {
    await rm(dataDir, { force: true, recursive: true })
  })

  async function publish(contents: string): Promise<void> {
    await writeFile(join(dataDir, AGENT_DISCOVERY_FILE), contents, {
      mode: 0o600
    })
  }

  it('reads the token the agent published', async () => {
    await publish(JSON.stringify({ port: 6286, token: 'abc123', pid: 42 }))
    expect(readAgentDiscoveryToken(dataDir)).toBe('abc123')
  })

  it('accepts a printable ASCII token at the length limit', async () => {
    const token = 'a'.repeat(4096)
    await publish(JSON.stringify({ token }))
    expect(readAgentDiscoveryToken(dataDir)).toBe(token)
  })

  it('returns the newer token after the file is replaced', async () => {
    await publish(JSON.stringify({ port: 6286, token: 'first', pid: 42 }))
    expect(readAgentDiscoveryToken(dataDir)).toBe('first')
    await publish(JSON.stringify({ port: 6286, token: 'second', pid: 43 }))
    expect(readAgentDiscoveryToken(dataDir)).toBe('second')
  })

  it('ignores a discovery path that is not a regular file', async () => {
    await mkdir(join(dataDir, AGENT_DISCOVERY_FILE))
    expect(readAgentDiscoveryToken(dataDir)).toBeUndefined()
  })

  it('ignores an oversized discovery file', async () => {
    await publish(' '.repeat(16 * 1024 + 1))
    expect(readAgentDiscoveryToken(dataDir)).toBeUndefined()
  })

  it.for([
    ['an absent file', null],
    ['a half-written file', '{"port":6286,"tok'],
    ['a file with no token', '{"port":6286,"pid":42}'],
    ['a file with an empty token', '{"port":6286,"token":"","pid":42}'],
    ['a file with a non-string token', '{"port":6286,"token":7,"pid":42}'],
    ['a token with a control character', '{"token":"line\\nbreak"}'],
    ['a token with non-ASCII text', '{"token":"café"}'],
    ['an oversized token', JSON.stringify({ token: 'a'.repeat(4097) })],
    ['a JSON null', 'null']
  ] as const)('publishes no usable token from %s', async ([, contents]) => {
    if (contents !== null) await publish(contents)
    expect(readAgentDiscoveryToken(dataDir)).toBeUndefined()
  })

  it('does not throw a parse error that would quote the credential', async () => {
    await publish('{"port":6286,"token":"sensitive-value"')
    expect(() => readAgentDiscoveryToken(dataDir)).not.toThrow()
  })
})
