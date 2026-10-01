import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { collectRouterSchemaDocuments } from './refresh-workshop-router-snapshot'

const roots: string[] = []

async function treeWith(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'router-schemas-'))
  roots.push(root)
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), contents)
  }
  return root
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true }))
  )
})

describe('collectRouterSchemaDocuments', () => {
  it('reads one document per provider/model file, sorted by id', async () => {
    const root = await treeWith({
      'README.md': '# generated',
      'openai/gpt-image-2.json': '{"model":"gpt-image-2"}',
      'anthropic/claude-sonnet-5-5.json': '{"model":"sonnet"}',
      'anthropic/claude-opus-5-5.json': '{"model":"opus"}'
    })

    expect(await collectRouterSchemaDocuments(root)).toEqual([
      { id: 'anthropic/claude-opus-5-5', document: { model: 'opus' } },
      { id: 'anthropic/claude-sonnet-5-5', document: { model: 'sonnet' } },
      { id: 'openai/gpt-image-2', document: { model: 'gpt-image-2' } }
    ])
  })

  it.for([
    ['a three-level path', { 'openai/images/gpt-image-2.json': '{}' }],
    ['a top-level document', { 'gpt-image-2.json': '{}' }],
    ['a non-JSON model file', { 'openai/notes.md': '' }]
  ] as const)('rejects %s', async ([, files]) => {
    const root = await treeWith({ 'openai/gpt-image-2.json': '{}', ...files })

    await expect(collectRouterSchemaDocuments(root)).rejects.toThrow(
      'Unexpected Router schema entry'
    )
  })

  it('rejects a tree with no documents', async () => {
    const root = await treeWith({ 'README.md': '# generated' })

    await expect(collectRouterSchemaDocuments(root)).rejects.toThrow(
      'No Router schema documents'
    )
  })
})
