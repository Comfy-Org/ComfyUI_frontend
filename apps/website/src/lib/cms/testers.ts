import { createHash, randomBytes } from 'node:crypto'
import { readFile, writeFile, rename } from 'node:fs/promises'
import { z } from 'zod'

const entry = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['review', 'edit', 'publish']),
  codeHash: z.string(),
  expires: z.number(),
  redeemed: z.boolean(),
  revoked: z.boolean(),
  sessionHash: z.string().optional()
})
type Entry = z.infer<typeof entry>
export const TESTER_COOKIE = 'comfy_site_tester'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
let queue: Promise<unknown> = Promise.resolve()

export function testersEnabled() {
  return Boolean(
    import.meta.env.DEV &&
    !process.env.VERCEL_ENV &&
    process.env.SITE_CATALOG_LOCAL_CREDENTIAL_FILE
  )
}

async function transaction<T>(work: (entries: Entry[]) => T): Promise<T> {
  if (!testersEnabled()) throw new Error('Temporary invitations unavailable')
  const path = `${process.env.SITE_CATALOG_LOCAL_CREDENTIAL_FILE}.testers`
  const result = queue.then(async () => {
    let entries: Entry[]
    try {
      entries = entry.array().parse(JSON.parse(await readFile(path, 'utf8')))
    } catch (error) {
      if (
        !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
      )
        throw error
      entries = []
    }
    const value = work(entries)
    await writeFile(`${path}.tmp`, JSON.stringify(entries), { mode: 0o600 })
    await rename(`${path}.tmp`, path)
    return value
  })
  queue = result.catch(() => undefined)
  return result
}

export async function localCredential() {
  if (!testersEnabled()) return undefined
  try {
    const data = z
      .object({
        credential: z.string(),
        expires_at: z.string().datetime({ offset: true })
      })
      .parse(
        JSON.parse(
          await readFile(
            process.env.SITE_CATALOG_LOCAL_CREDENTIAL_FILE!,
            'utf8'
          )
        )
      )
    return Date.parse(data.expires_at) > Date.now() ? data : undefined
  } catch {
    return undefined
  }
}

export async function createInvitation(name: string, role: Entry['role']) {
  const parent = await localCredential()
  if (!parent || !name.trim() || name.length > 100)
    throw new Error('Invalid invitation')
  const code = randomBytes(32).toString('hex')
  await transaction((entries) =>
    entries.push({
      id: randomBytes(16).toString('hex'),
      name: name.trim(),
      role,
      codeHash: hash(code),
      expires: Math.min(
        Date.now() + 7 * 86400000,
        Date.parse(parent.expires_at)
      ),
      redeemed: false,
      revoked: false
    })
  )
  return code
}

export function listInvitations() {
  return transaction((entries) =>
    entries.map(({ id, name, role, expires, redeemed, revoked }) => ({
      id,
      name,
      role,
      expires,
      redeemed,
      revoked
    }))
  )
}

export function revokeInvitation(id: string) {
  return transaction((entries) => {
    const found = entries.find((e) => e.id === id)
    if (found) found.revoked = true
  })
}

export async function redeemInvitation(code: string) {
  if (!/^[a-f0-9]{64}$/.test(code)) return undefined
  return transaction((entries) => {
    const found = entries.find(
      (e) =>
        e.codeHash === hash(code) &&
        !e.redeemed &&
        !e.revoked &&
        e.expires > Date.now()
    )
    if (!found) return undefined
    const token = randomBytes(32).toString('hex')
    found.redeemed = true
    found.sessionHash = hash(token)
    return token
  })
}

export function verifyTester(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return Promise.resolve(undefined)
  return transaction((entries) => {
    const found = entries.find(
      (e) =>
        e.sessionHash === hash(token) &&
        e.redeemed &&
        !e.revoked &&
        e.expires > Date.now()
    )
    return found ? { name: found.name, role: found.role } : undefined
  })
}
