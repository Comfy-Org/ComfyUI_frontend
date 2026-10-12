// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDemoInvitation,
  demoEnabled,
  listDemoInvitations,
  redeemDemoInvitation,
  resolveDemoSession,
  revokeDemoInvitation
} from './catalog-demo'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ccc-demo-test-'))
  const credential = `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 1800 })).toString('base64url')}.not-a-real-signature`
  await writeFile(join(dir, 'fixture.jwt'), credential, { mode: 0o600 })
  vi.stubEnv('SITE_CATALOG_API_URL', 'http://127.0.0.1:8109')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv(
    'SITE_CATALOG_LOCAL_AUTHORING_CREDENTIAL_FILE',
    join(dir, 'fixture.jwt')
  )
  vi.stubEnv(
    'SITE_CATALOG_DEMO_INVITATIONS_FILE',
    join(dir, 'invitations.json')
  )
})
afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  await rm(dir, { recursive: true, force: true })
})
describe('explicit local-demo invitations', () => {
  it('extends only explicit invitations; retains default, revocation and absolute expiry', async () => {
    const now = Date.now()
    const parentExpiry = Math.floor(now / 1000) + 6 * 24 * 60 * 60
    await writeFile(
      join(dir, 'fixture.jwt'),
      `fixture.${Buffer.from(JSON.stringify({ exp: parentExpiry })).toString('base64url')}.not-a-real-signature`,
      { mode: 0o600 }
    )
    const expires = now + 3 * 24 * 60 * 60 * 1000
    const long = await createDemoInvitation('Monday', 'publish', expires)
    const normal = await createDemoInvitation('ordinary', 'edit')
    expect(long.expires).toBe(expires)
    expect(normal.expires).toBeLessThanOrEqual(Date.now() + 60 * 60 * 1000)
    const session = await redeemDemoInvitation(long.code)
    expect(await redeemDemoInvitation(long.code)).toEqual(session)
    expect((await resolveDemoSession(session!.token))?.name).toBe('Monday')
    await revokeDemoInvitation(
      (await listDemoInvitations()).find((item) => item.name === 'Monday')!.id
    )
    expect(await resolveDemoSession(session!.token)).toBeUndefined()
    const expiring = await createDemoInvitation('expires', 'edit', expires)
    const active = await redeemDemoInvitation(expiring.code)
    vi.useFakeTimers()
    vi.setSystemTime(expires + 1)
    expect(await resolveDemoSession(active!.token)).toBeUndefined()
    expect(await redeemDemoInvitation(expiring.code)).toBeUndefined()
  })
  it('rejects explicit expired, malformed, over-seven-day or beyond-parent expiry without creating entries', async () => {
    for (const expiry of [
      NaN,
      Date.now() - 1,
      Date.now() + 8 * 24 * 60 * 60 * 1000,
      Date.now() + 60 * 60 * 1000
    ])
      await expect(
        createDemoInvitation('invalid', 'publish', expiry)
      ).rejects.toThrow()
    expect(await listDemoInvitations()).toEqual([])
  })
  it('supports repeated and concurrent sign-ins without invalidating sessions or storing secrets', async () => {
    const invite = await createDemoInvitation('tester', 'publish')
    const results = await Promise.all([
      redeemDemoInvitation(invite.code),
      redeemDemoInvitation(invite.code)
    ])
    expect(results.filter(Boolean)).toHaveLength(2)
    expect(results[0]).toEqual(results[1])
    const session = results.find(Boolean)!
    expect((await resolveDemoSession(session.token))?.role).toBe('publish')
    const stored = await readFile(join(dir, 'invitations.json'), 'utf8')
    expect(stored).not.toContain(invite.code)
    expect(stored).not.toContain(session.token)
    expect(stored).not.toContain('not-a-real-signature')
  })
  it('preserves older random-token sessions while making the same invitation reusable', async () => {
    const invite = await createDemoInvitation('existing tester', 'publish')
    const legacyToken = 'b'.repeat(64)
    const file = join(dir, 'invitations.json')
    const entries = JSON.parse(await readFile(file, 'utf8'))
    entries[0].sessionHash = createHash('sha256').update(legacyToken).digest('hex')
    await writeFile(file, JSON.stringify(entries), { mode: 0o600 })
    const next = await redeemDemoInvitation(invite.code)
    expect(next).toBeDefined()
    expect(await redeemDemoInvitation(invite.code)).toEqual(next)
    expect((await resolveDemoSession(legacyToken))?.role).toBe('publish')
    expect((await resolveDemoSession(next!.token))?.role).toBe('publish')
    await revokeDemoInvitation((await listDemoInvitations())[0].id)
    expect(await redeemDemoInvitation(invite.code)).toBeUndefined()
    expect(await resolveDemoSession(legacyToken)).toBeUndefined()
    expect(await resolveDemoSession(next!.token)).toBeUndefined()
  })
  it('revokes a redeemed session and leaves unrelated invitations valid', async () => {
    const first = await createDemoInvitation('first', 'edit')
    const second = await createDemoInvitation('second', 'publish')
    const session = await redeemDemoInvitation(first.code)
    await revokeDemoInvitation(
      (await listDemoInvitations()).find((item) => item.name === 'first')!.id
    )
    expect(await resolveDemoSession(session!.token)).toBeUndefined()
    expect(await redeemDemoInvitation(second.code)).toBeDefined()
  })
  it('caps expiry at the parent token lifetime and expires both code and session', async () => {
    const invite = await createDemoInvitation('expiry', 'edit')
    expect(invite.expires).toBeLessThanOrEqual(Date.now() + 1800000)
    const session = await redeemDemoInvitation(invite.code)
    vi.useFakeTimers()
    vi.setSystemTime(invite.expires + 1)
    expect(await resolveDemoSession(session!.token)).toBeUndefined()
    expect(await redeemDemoInvitation(invite.code)).toBeUndefined()
  })
  it('fails closed outside explicit dev fixture configuration', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(demoEnabled()).toBe(false)
    await expect(createDemoInvitation('test', 'edit')).rejects.toThrow()
  })
  it('rejects malformed code and world-readable credential files', async () => {
    expect(await redeemDemoInvitation('bad')).toBeUndefined()
    await writeFile(join(dir, 'unsafe.jwt'), 'fixture', { mode: 0o644 })
    vi.stubEnv(
      'SITE_CATALOG_LOCAL_AUTHORING_CREDENTIAL_FILE',
      join(dir, 'unsafe.jwt')
    )
    await expect(createDemoInvitation('test', 'edit')).rejects.toThrow()
  })
})
