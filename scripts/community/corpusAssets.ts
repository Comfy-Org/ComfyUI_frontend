import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import {
  zTestWorkflowDetail,
  zTestWorkflowSummary
} from '@comfyorg/ingest-types/test-workflows/zod'
import {
  getCloudAdaptation,
  verifyCloudWorkflow
} from '../../src/platform/workflow/library/utils/cloudWorkflowAdaptation'

const zIndex = z
  .object({
    entries: z.array(
      zTestWorkflowSummary.extend({
        packs: z.array(z.string()),
        models: z.array(z.string()),
        node_types: z.array(z.string())
      })
    )
  })
  .passthrough()

export async function readCorpus(directory: string) {
  const index = zIndex.parse(
    JSON.parse(await readFile(resolve(directory, 'index.json'), 'utf8'))
  )
  const hashes = new Set<string>()
  const adapted = new Set<string>()
  for (const entry of index.entries) {
    const hash = entry.workflow_sha256
    if (!/^[a-f0-9]{64}$/.test(hash) || hashes.has(hash))
      throw new Error(`Invalid or duplicate workflow identity: ${hash}`)
    hashes.add(hash)
    const detail = zTestWorkflowDetail.parse(
      JSON.parse(
        await readFile(resolve(directory, hash, 'detail.json'), 'utf8')
      )
    )
    const raw = await readFile(resolve(directory, hash, 'workflow.json'))
    if (
      digest(raw) !== hash ||
      detail.summary.workflow_sha256 !== hash ||
      detail.metadata.workflow_sha256 !== hash ||
      detail.summary.metadata_sha256 !== entry.metadata_sha256
    )
      throw new Error(`Workflow identity mismatch: ${hash}`)
    if (
      !detail.source_metadata_json ||
      digest(detail.source_metadata_json) !== detail.source_metadata_sha256
    )
      throw new Error(`Source metadata identity mismatch: ${hash}`)
    if (getCloudAdaptation(detail)) {
      const cloud = await readFile(
        resolve(directory, hash, 'workflow.cloud.json'),
        'utf8'
      )
      if (!(await verifyCloudWorkflow(detail, raw.toString('utf8'), cloud)))
        throw new Error(`Adapted graph or change ledger mismatch: ${hash}`)
      adapted.add(hash)
    } else if (
      detail.metadata.cloud_adaptation &&
      typeof detail.metadata.cloud_adaptation === 'object' &&
      'workflow_file' in detail.metadata.cloud_adaptation
    )
      throw new Error(`Invalid adaptation ledger: ${hash}`)
  }
  return { index, adapted }
}

export async function mergeCorpora(
  preferredDirectory: string,
  additionalDirectory: string,
  outputDirectory: string
) {
  const preferred = await readCorpus(preferredDirectory)
  const additional = await readCorpus(additionalDirectory)
  const selected = new Map(
    preferred.index.entries.map((entry) => [
      entry.workflow_sha256,
      { entry, directory: preferredDirectory, adapted: preferred.adapted }
    ])
  )
  let overlap = 0
  for (const entry of additional.index.entries) {
    if (selected.has(entry.workflow_sha256)) {
      overlap += 1
      continue
    }
    selected.set(entry.workflow_sha256, {
      entry,
      directory: additionalDirectory,
      adapted: additional.adapted
    })
  }
  await mkdir(outputDirectory)
  for (const [hash, asset] of selected) {
    const destination = resolve(outputDirectory, hash)
    await mkdir(destination)
    const names = [
      'detail.json',
      'workflow.json',
      ...(asset.adapted.has(hash) ? ['workflow.cloud.json'] : [])
    ]
    for (const name of names)
      await copyFile(
        resolve(asset.directory, hash, name),
        resolve(destination, name),
        constants.COPYFILE_EXCL
      )
  }
  const entries = [...selected.values()].map(({ entry }) => entry)
  await writeFile(
    resolve(outputDirectory, 'index.json'),
    JSON.stringify({
      sources: [preferred, additional].map(({ index }) => {
        const { entries: sourceEntries, ...provenance } = index
        return { ...provenance, count: sourceEntries.length }
      }),
      preferred_metadata_overlap: overlap,
      entries
    }),
    { flag: 'wx' }
  )
  await readCorpus(outputDirectory)
  return { count: entries.length, preservedOverlap: overlap }
}

function digest(raw: string | Uint8Array) {
  return createHash('sha256').update(raw).digest('hex')
}
