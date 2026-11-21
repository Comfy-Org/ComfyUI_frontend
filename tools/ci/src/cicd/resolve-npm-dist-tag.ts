import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { lt, maxSatisfying, prerelease, valid, validRange } from 'semver'
import { z } from 'zod'

import { setOutput } from './actions-output'

const versionSchema = z.string().refine((value) => valid(value) !== null)
const inputsSchema = z.object({
  NAME: z.string().min(1),
  VERSION: versionSchema,
  DIST_TAG: z
    .string()
    .min(1)
    .refine(
      (tag) => encodeURIComponent(tag) === tag && validRange(tag) === null
    )
})

export function resolveNpmDistTag({
  version,
  requestedTag,
  versions
}: {
  version: string
  requestedTag: string
  versions: string[]
}): string {
  if (requestedTag !== 'latest') return requestedTag
  if (prerelease(version)) return 'next'
  const newest = maxSatisfying(versions, '*')
  return newest && lt(version, newest) ? 'backport' : 'latest'
}

function main() {
  const { NAME, VERSION, DIST_TAG } = inputsSchema.parse(process.env)
  const result = spawnSync('npm', ['view', NAME, 'versions', '--json'], {
    encoding: 'utf8'
  })
  if (result.error) throw result.error
  const response: unknown = result.stdout.trim()
    ? JSON.parse(result.stdout)
    : null
  const missing = z.object({ error: z.object({ code: z.literal('E404') }) })
  if (result.status !== 0 && !missing.safeParse(response).success) {
    throw new Error(`Registry lookup failed: ${result.stderr || result.stdout}`)
  }
  const versions =
    result.status === 0 ? z.array(versionSchema).parse(response) : []
  const tag = resolveNpmDistTag({
    version: VERSION,
    requestedTag: DIST_TAG,
    versions
  })
  setOutput('tag', tag)
  process.stdout.write(`Publishing ${NAME}@${VERSION} with dist-tag ${tag}\n`)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
}
