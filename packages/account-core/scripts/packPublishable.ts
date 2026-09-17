/**
 * Turns a workspace package directory into the inputs the publishable rules
 * need: the tarball npm would upload, its file list, and the manifest npm
 * rewrote on the way in.
 */
import { execFileSync } from 'node:child_process'
import { z } from 'zod'

import type { PackedPackage, PublishableViolation } from './publishableTarball'
import {
  findPublishableViolations,
  zPublishedManifest
} from './publishableTarball'

const zPackResult = z.object({
  filename: z.string(),
  files: z.array(z.object({ path: z.string() }))
})

export interface PackedPublishable extends PackedPackage {
  filename: string
  violations: PublishableViolation[]
}

export function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  })
}

export function parseJson<T>(
  schema: z.ZodType<T>,
  text: string,
  origin: string
): T {
  const result = schema.safeParse(JSON.parse(text))
  if (!result.success) throw new Error(`${origin}: ${result.error.message}`)
  return result.data
}

export function packPublishable(
  packageDir: string,
  destination: string
): PackedPublishable {
  const packed = parseJson(
    zPackResult,
    run(
      'pnpm',
      ['pack', '--json', '--pack-destination', destination],
      packageDir
    ),
    `pnpm pack --json in ${packageDir}`
  )
  const manifest = parseJson(
    zPublishedManifest,
    run('tar', ['-xzOf', packed.filename, 'package/package.json'], packageDir),
    `package/package.json in ${packed.filename}`
  )
  const files = packed.files.map((file) => file.path)
  return {
    filename: packed.filename,
    files,
    manifest,
    violations: findPublishableViolations({ files, manifest })
  }
}
