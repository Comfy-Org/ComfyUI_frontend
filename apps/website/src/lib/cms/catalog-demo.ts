import { createHash, createHmac, randomBytes } from 'node:crypto'
import { lstat, readFile, rename, writeFile } from 'node:fs/promises'
import { z } from 'astro/zod'

export const DEMO_COOKIE = 'comfy_catalog_demo'
export const DEMO_LOGIN_CSRF = 'comfy_catalog_demo_login_csrf'
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex')
const entry = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100),
  role: z.enum(['edit', 'publish']),
  codeHash: z.string().regex(/^[a-f0-9]{64}$/),
  expires: z.number().int().positive(),
  revoked: z.boolean(),
  sessionHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  reusableSessionHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional()
})
let queue: Promise<unknown> = Promise.resolve()
export function demoEnabled() {
  return Boolean(
    import.meta.env.DEV &&
    !process.env.VERCEL_ENV &&
    process.env.SITE_CATALOG_API_URL === 'http://127.0.0.1:8109' &&
    process.env.SITE_CATALOG_DEMO_INVITATIONS_FILE &&
    process.env.SITE_CATALOG_LOCAL_AUTHORING_CREDENTIAL_FILE
  )
}
async function privateRead(path: string) {
  const info = await lstat(path)
  if (!info.isFile() || info.mode & 0o077 || info.size > 128 * 1024)
    throw new Error('Private demo file required')
  return readFile(path, 'utf8')
}
export async function demoParent() {
  if (!demoEnabled()) throw new Error('Demo unavailable')
  const credential = (
    await privateRead(process.env.SITE_CATALOG_LOCAL_AUTHORING_CREDENTIAL_FILE!)
  ).trim()
  // This only bounds invitation lifetime. Actual signature/grants are verified
  // by authoring-context on redemption AND every subsequent request.
  const claims: unknown = JSON.parse(
    Buffer.from(credential.split('.')[1], 'base64url').toString('utf8')
  )
  const parsed = z.object({ exp: z.number().int().positive() }).parse(claims)
  if (parsed.exp * 1000 <= Date.now()) throw new Error('Demo expired')
  return { credential, expires: parsed.exp * 1000 }
}
async function transaction<T>(
  work: (entries: z.infer<typeof entry>[]) => T
): Promise<T> {
  if (!demoEnabled()) throw new Error('Demo unavailable')
  const path = process.env.SITE_CATALOG_DEMO_INVITATIONS_FILE!
  const result = queue.then(async () => {
    let entries: z.infer<typeof entry>[]
    try {
      entries = entry
        .array()
        .max(200)
        .parse(JSON.parse(await privateRead(path)))
    } catch (error) {
      if (
        !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
      )
        throw error
      entries = []
    }
    const value = work(entries)
    await writeFile(path + '.tmp', JSON.stringify(entries), {
      mode: 0o600,
      flag: 'wx'
    })
    await rename(path + '.tmp', path)
    return value
  })
  queue = result.catch(() => undefined)
  return result
}
export async function createDemoInvitation(
  name: string,
  role: 'edit' | 'publish',
  requestedExpiry?: number
) {
  const parent = await demoParent()
  const now = Date.now()
  if (
    requestedExpiry !== undefined &&
    (!Number.isSafeInteger(requestedExpiry) ||
      requestedExpiry <= now ||
      requestedExpiry > now + 7 * 24 * 60 * 60 * 1000 ||
      requestedExpiry > parent.expires)
  )
    throw new Error(
      'Explicit expiry must be future, within seven days and parent lifetime'
    )
  const code = randomBytes(32).toString('hex')
  const item = entry.parse({
    id: crypto.randomUUID(),
    name: name.trim(),
    role,
    codeHash: digest(code),
    expires: requestedExpiry ?? Math.min(now + 60 * 60 * 1000, parent.expires),
    revoked: false
  })
  await transaction((entries) => {
    if (entries.length >= 200) throw new Error('Invitation limit')
    entries.push(item)
  })
  return { code, expires: item.expires }
}
export const listDemoInvitations = () =>
  transaction((entries) =>
    entries.map(({ id, name, role, expires, revoked, sessionHash }) => ({
      id,
      name,
      role,
      expires,
      revoked,
      redeemed: Boolean(sessionHash)
    }))
  )
export const revokeDemoInvitation = (id: string) =>
  transaction((entries) => {
    const item = entries.find((item) => item.id === id)
    if (item) item.revoked = true
  })
export async function redeemDemoInvitation(code: string) {
  if (!/^[a-f0-9]{64}$/.test(code)) return undefined
  return transaction((entries) => {
    const item = entries.find(
      (item) =>
        item.codeHash === digest(code) &&
        !item.revoked &&
        item.expires > Date.now()
    )
    if (!item) return undefined
    // DEV-only reusable invitation. A stable domain-separated session token
    // lets repeated sign-ins coexist without growing an unbounded session list.
    // Retain any previous random-token session, so existing tabs keep working.
    const token = createHmac('sha256', code)
      .update('comfy-ccc-local-demo-session-v1')
      .digest('hex')
    if (!item.sessionHash) item.sessionHash = digest(token)
    item.reusableSessionHash = digest(token)
    return { token, expires: item.expires }
  })
}
export async function resolveDemoSession(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return undefined
  const item = await transaction((entries) =>
    entries.find(
      (item) =>
        (item.sessionHash === digest(token) || item.reusableSessionHash === digest(token)) &&
        !item.revoked &&
        item.expires > Date.now()
    )
  )
  return item
    ? { ...(await demoParent()), role: item.role, name: item.name }
    : undefined
}
