import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { OutputLocale } from './config'
import { discoverDocuments } from './document'
import { hashSource } from './manifest'
import { collectPending } from './update-content-translations'

const locales: OutputLocale[] = [
  { code: 'zh-CN', name: 'Simplified Chinese' },
  { code: 'ja', name: 'Japanese' }
]

const faqFixture = `---
question: "What are Partner Nodes?"
order: 14
---

Partner Nodes let you run proprietary models.
`

function sourceHashOf(question: string, body: string): string {
  return hashSource(`${question}\n${body}`)
}

describe('collectPending', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'i18n-content-pending-'))
    mkdirSync(join(dir, 'faq', 'pricing', 'en'), { recursive: true })
    writeFileSync(
      join(dir, 'faq', 'pricing', 'en', 'partner-nodes.mdx'),
      faqFixture
    )
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('flags a document with no locale file at all', () => {
    const refs = discoverDocuments(dir)

    const { pending } = collectPending(
      refs,
      { version: 1, entries: {} },
      locales
    )

    expect(pending).toEqual([
      {
        ref: refs[0],
        locale: locales[0],
        fields: [{ path: 'question', value: 'What are Partner Nodes?' }],
        body: '\nPartner Nodes let you run proprietary models.\n',
        sourceHash: sourceHashOf(
          'What are Partner Nodes?',
          '\nPartner Nodes let you run proprietary models.\n'
        )
      },
      {
        ref: refs[0],
        locale: locales[1],
        fields: [{ path: 'question', value: 'What are Partner Nodes?' }],
        body: '\nPartner Nodes let you run proprietary models.\n',
        sourceHash: sourceHashOf(
          'What are Partner Nodes?',
          '\nPartner Nodes let you run proprietary models.\n'
        )
      }
    ])
  })

  it('bootstraps a baseline hash for a locale file the manifest has never seen', () => {
    mkdirSync(join(dir, 'faq', 'pricing', 'zh-CN'), { recursive: true })
    writeFileSync(
      join(dir, 'faq', 'pricing', 'zh-CN', 'partner-nodes.mdx'),
      faqFixture
    )
    const refs = discoverDocuments(dir)

    const { pending, manifestUpdates } = collectPending(
      refs,
      { version: 1, entries: {} },
      locales
    )

    expect(pending).toEqual([expect.objectContaining({ locale: locales[1] })])
    expect(manifestUpdates.get('faq/pricing/partner-nodes')?.get('zh-CN')).toBe(
      sourceHashOf(
        'What are Partner Nodes?',
        '\nPartner Nodes let you run proprietary models.\n'
      )
    )
  })

  it('leaves a document alone once its hash is recorded and unchanged', () => {
    mkdirSync(join(dir, 'faq', 'pricing', 'ja'), { recursive: true })
    writeFileSync(
      join(dir, 'faq', 'pricing', 'ja', 'partner-nodes.mdx'),
      faqFixture
    )
    const refs = discoverDocuments(dir)
    const manifest = {
      version: 1 as const,
      entries: {
        'faq/pricing/partner-nodes': {
          ja: sourceHashOf(
            'What are Partner Nodes?',
            '\nPartner Nodes let you run proprietary models.\n'
          )
        }
      }
    }

    const { pending } = collectPending(refs, manifest, [locales[1]])

    expect(pending).toEqual([])
  })
})
