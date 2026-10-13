import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createInvitation,
  redeemInvitation,
  verifyTester,
  revokeInvitation,
  listInvitations
} from './testers'

let directory: string
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'cms-invite-test-'))
  const path = join(directory, 'credential.json')
  vi.stubEnv('DEV', true)
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('SITE_CATALOG_LOCAL_CREDENTIAL_FILE', path)
  await writeFile(
    path,
    JSON.stringify({
      credential: 'unit-test-only',
      expires_at: new Date(Date.now() + 86400000).toISOString()
    })
  )
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('temporary tester invitations', () => {
  it.for(['review', 'edit', 'publish'] as const)(
    'preserves %s role and revokes active access',
    async (role) => {
      const code = await createInvitation('Tester', role)
      const token = await redeemInvitation(code)
      expect(token).toBeDefined()
      expect(await verifyTester(token!)).toEqual({ name: 'Tester', role })
      expect(await redeemInvitation(code)).toBeUndefined()
      const [invitation] = await listInvitations()
      expect(invitation).not.toHaveProperty('codeHash')
      await revokeInvitation(invitation.id)
      expect(await verifyTester(token!)).toBeUndefined()
    }
  )
  it('allows only one concurrent redemption', async () => {
    const code = await createInvitation('Tester', 'review')
    const results = await Promise.all([
      redeemInvitation(code),
      redeemInvitation(code)
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
  })
  it('rejects forged and expired access', async () => {
    const code = await createInvitation('Tester', 'review')
    expect(await redeemInvitation('0'.repeat(64))).toBeUndefined()
    expect(await verifyTester('0'.repeat(64))).toBeUndefined()
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * 86400000)
    expect(await redeemInvitation(code)).toBeUndefined()
  })
  it('is unavailable on Vercel', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    await expect(createInvitation('Tester', 'review')).rejects.toThrow()
  })
})
