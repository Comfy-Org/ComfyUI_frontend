import { describe, expect, it } from 'vitest'

import { applyEdits, planJapanese, verifyWrite } from './data'

/**
 * The check that stands between a translation run and 18 hand-written source
 * files. Its value is entirely in what it refuses, so every case here feeds it
 * a write that is wrong in a different way and expects it to say so.
 */
describe('verifyWrite', () => {
  const FILE = 'events.ts'
  const SOURCE = `export const events = [
  {
    id: 'live',
    title: {
      en: 'ComfyUI Live',
      'zh-CN': 'ComfyUI 直播'
    },
    description: {
      en: 'A weekly stream',
      'zh-CN': '每周直播'
    }
  }
]
`
  const JAPANESE = {
    'events.events.live.title': 'ComfyUI ライブ',
    'events.events.live.description': '毎週の配信'
  }

  const good = () => {
    const edits = planJapanese(FILE, SOURCE, JAPANESE)
    return { edits, written: applyEdits(SOURCE, edits) }
  }

  it('passes a write that only added Japanese', () => {
    const { edits, written } = good()

    expect(verifyWrite(FILE, SOURCE, written, edits)).toEqual([])
  })

  it('catches a byte changed outside the edits', () => {
    const { edits, written } = good()
    const tampered = written.replace('A weekly stream', 'A monthly stream')

    expect(verifyWrite(FILE, SOURCE, tampered, edits)).not.toEqual([])
  })

  it('catches Chinese being disturbed', () => {
    const { edits, written } = good()
    const tampered = written.replace('每周直播', '每月直播')

    expect(verifyWrite(FILE, SOURCE, tampered, edits).join(' ')).toContain(
      'Chinese'
    )
  })

  it('catches an entry going missing', () => {
    const { edits, written } = good()
    const tampered = written.replace(
      / {4}description: \{[\s\S]*?\n {4}\}\n/,
      ''
    )

    expect(verifyWrite(FILE, SOURCE, tampered, edits).join(' ')).toContain(
      'entries'
    )
  })

  it('catches Japanese that reads back as approved', () => {
    // A value written without the marker would be treated as human-approved and
    // never refreshed again. That is the bug the marker exists to prevent, so
    // the verifier has to notice it rather than trust the writer.
    const edits = planJapanese(FILE, SOURCE, JAPANESE)
    const unmarked = applyEdits(SOURCE, edits).replaceAll(' /* machine */', '')

    expect(verifyWrite(FILE, SOURCE, unmarked, edits).join(' ')).toContain(
      'approved'
    )
  })
})
