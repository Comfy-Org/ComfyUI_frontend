import { createHash } from 'node:crypto'
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import metadata from '../../src/platform/community/fixtures/cloud-reference-v1/import.json'
import original from '../../src/platform/community/fixtures/cloud-reference-v1/workflow.json?raw'
import { mergeCorpora, readCorpus } from './corpusAssets'

const digest = (raw: string) => createHash('sha256').update(raw).digest('hex')

async function writeCorpus(
  directory: string,
  records: { raw: string; name: string; review: string }[]
) {
  await mkdir(directory)
  const entries = []
  for (const record of records) {
    const hash = digest(record.raw)
    const imported = {
      ...metadata,
      workflow_sha256: hash,
      name: record.name,
      classification: { status: record.review },
      cloud_adaptation: undefined
    }
    const source = JSON.stringify(imported) + '\r\n'
    const summary = {
      workflow_sha256: hash,
      metadata_sha256: digest(source),
      name: record.name,
      description: imported.description,
      tags: [],
      tasks: [],
      structural_cluster: imported.structural_cluster,
      node_count: 1,
      unresolved_pack_count: 1,
      verified: false
    }
    entries.push({
      ...summary,
      packs: [],
      models: ['legacy.safetensors'],
      node_types: imported.node_types
    })
    const folder = join(directory, hash)
    await mkdir(folder)
    await writeFile(join(folder, 'workflow.json'), record.raw)
    await writeFile(
      join(folder, 'detail.json'),
      JSON.stringify(
        {
          summary,
          metadata: imported,
          source_metadata_json: source,
          source_metadata_sha256: digest(source)
        },
        null,
        2
      ) + '\n'
    )
  }
  await writeFile(
    join(directory, 'index.json'),
    JSON.stringify({
      archive_sha256: 'a'.repeat(64),
      manifest_sha256: 'b'.repeat(64),
      entries
    })
  )
}

it('preserves preferred graph/detail/source bytes for overlapping identities and adds only new originals', async () => {
  const root = await mkdtemp(join(tmpdir(), 'community-snapshot-'))
  try {
    const preferred = join(root, 'preferred')
    const expanded = join(root, 'expanded')
    const output = join(root, 'output')
    await writeCorpus(preferred, [
      { raw: original, name: 'Reviewed original', review: 'reviewed' }
    ])
    await writeCorpus(expanded, [
      { raw: original, name: 'New AI metadata', review: 'unreviewed' },
      { raw: original + ' ', name: 'New workflow', review: 'unreviewed' }
    ])
    expect(await mergeCorpora(preferred, expanded, output)).toEqual({
      count: 2,
      preservedOverlap: 1
    })
    const hash = digest(original)
    for (const name of ['detail.json', 'workflow.json'])
      expect(await readFile(join(output, hash, name))).toEqual(
        await readFile(join(preferred, hash, name))
      )
    const { index } = await readCorpus(output)
    expect(index.entries.map(({ name }) => name)).toEqual([
      'Reviewed original',
      'New workflow'
    ])
    expect(index.preferred_metadata_overlap).toBe(1)
    expect(index.sources).toHaveLength(2)
    await expect(
      mergeCorpora(preferred, expanded, output)
    ).rejects.toMatchObject({ code: 'EEXIST' })
  } finally {
    await rm(root, { recursive: true })
  }
})

it('rejects a damaged input before creating the merged snapshot', async () => {
  const root = await mkdtemp(join(tmpdir(), 'community-snapshot-'))
  try {
    const preferred = join(root, 'preferred')
    const expanded = join(root, 'expanded')
    const output = join(root, 'output')
    await writeCorpus(preferred, [
      { raw: original, name: 'Reviewed original', review: 'reviewed' }
    ])
    await writeCorpus(expanded, [
      { raw: original + ' ', name: 'New workflow', review: 'unreviewed' }
    ])
    await writeFile(
      join(expanded, digest(original + ' '), 'workflow.json'),
      original
    )
    await expect(mergeCorpora(preferred, expanded, output)).rejects.toThrow(
      'Workflow identity mismatch'
    )
    await expect(access(output)).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await rm(root, { recursive: true })
  }
})
