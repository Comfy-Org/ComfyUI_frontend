import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  collectRouterSchemaDocuments,
  idsOf,
  resolveSourceCommit
} from './refresh-workshop-router-snapshot'

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

describe('collectRouterSchemaDocuments in a working checkout', () => {
  it('skips dotfiles such as .DS_Store at either level', async () => {
    const root = await treeWith({
      '.DS_Store': '',
      'openai/.DS_Store': '',
      'openai/gpt-image-2.json': '{}'
    })

    expect(await collectRouterSchemaDocuments(root)).toEqual([
      { id: 'openai/gpt-image-2', document: {} }
    ])
  })

  it('names the document that is not valid JSON', async () => {
    const root = await treeWith({ 'openai/gpt-image-2.json': '{' })

    await expect(collectRouterSchemaDocuments(root)).rejects.toThrow(
      'Router schema openai/gpt-image-2 is not valid JSON'
    )
  })
})

describe('idsOf', () => {
  it('rejects a snapshot that is not an array of records', () => {
    expect(() => idsOf('', 'The committed snapshot')).toThrow(
      'The committed snapshot is not valid JSON'
    )
    expect(() => idsOf('{"id":"a"}', 'The committed snapshot')).toThrow()
    expect(idsOf('[{"id":"a/b"}]', 'x')).toEqual(new Set(['a/b']))
  })
})

describe('resolveSourceCommit', () => {
  const schemas = 'services/comfy-api/docs/router-schemas'

  async function checkout() {
    const root = await treeWith({
      [`${schemas}/openai/gpt-image-2.json`]: '{}'
    })
    const git = (...args: string[]) =>
      execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim()
    git('init', '-q')
    git('add', '.')
    git(
      '-c',
      'user.name=test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-qm',
      'init'
    )
    return { root, head: git('rev-parse', 'HEAD') }
  }

  it('stamps the checked-out commit', async () => {
    const { root, head } = await checkout()

    expect(resolveSourceCommit(root)).toBe(head)
    expect(resolveSourceCommit(root, head)).toBe(head)
  })

  it('refuses a commit that is not the checked-out tree', async () => {
    const { root } = await checkout()

    expect(() => resolveSourceCommit(root, 'a'.repeat(40))).toThrow()
  })

  it('refuses uncommitted Router schema edits', async () => {
    const { root } = await checkout()
    await writeFile(join(root, schemas, 'openai/gpt-image-2.json'), '{"x":1}')

    expect(() => resolveSourceCommit(root)).toThrow('Uncommitted changes')
  })
})
