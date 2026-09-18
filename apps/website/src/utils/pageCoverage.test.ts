import { describe, expect, it } from 'vitest'

import { comparePage, contentTags, visibleText } from './pageCoverage'

const page = (body: string) =>
  `<html><head><title>T</title></head><body>${body}</body></html>`

describe('contentTags', () => {
  it('ignores script and style bodies', () => {
    const html = page(
      '<div><script>const a = "<p>"</script><span>hi</span></div>'
    )
    expect(contentTags(html)).toEqual([
      'html',
      'head',
      'title',
      'body',
      'div',
      'span'
    ])
  })

  /**
   * A page held back in its own locale emits no hreflang cluster, so English
   * carries alternates it does not. That is correct behaviour and showed up as
   * a constant four-tag difference on 146 Japanese pages; counting it would put
   * a permanent offset under every comparison.
   */
  it('ignores the hreflang cluster, which only one side carries', () => {
    const withCluster = `<html><head><title>T</title><link rel="alternate" hreflang="ja" href="/ja/"><meta property="og:locale:alternate" content="ja_JP"></head><body><p>x</p></body></html>`
    const without = page('<p>x</p>')
    expect(contentTags(withCluster)).toEqual(contentTags(without))
  })
})

describe('visibleText', () => {
  it('returns text nodes in document order', () => {
    expect(visibleText(page('<h1>Title</h1><p>Body copy</p>'))).toEqual([
      'T',
      'Title',
      'Body copy'
    ])
  })

  it('decodes entities so a translation compares against what is rendered', () => {
    expect(visibleText(page('<p>Tom&#39;s &amp; Co</p>'))).toContain(
      "Tom's & Co"
    )
  })
})

describe('comparePage', () => {
  const preserve = ['ComfyUI']

  it('scores a fully translated page at 1', () => {
    const result = comparePage({
      english: page('<h1>Build anything</h1><p>Run it locally</p>'),
      localized: page('<h1>构建一切</h1><p>本地运行</p>'),
      preserveTerms: preserve
    })
    expect(result.translated).toBe(1)
    expect(result.tagRatio).toBe(1)
  })

  it('scores an untranslated page at 0 and reports what is still English', () => {
    const html = page('<h1>Build anything</h1><p>Run it locally</p>')
    const result = comparePage({
      english: html,
      localized: html,
      preserveTerms: preserve
    })
    expect(result.translated).toBe(0)
    expect(result.stillEnglish).toContain('Build anything')
  })

  /**
   * Brand names are identical in every language by design, so counting them as
   * untranslated would cap a finished page below 100% and make the number
   * useless for deciding whether to publish.
   */
  it('does not count a preserved term as untranslated', () => {
    const result = comparePage({
      english: page('<h1>ComfyUI</h1><p>Run it locally</p>'),
      localized: page('<h1>ComfyUI</h1><p>本地运行</p>'),
      preserveTerms: preserve
    })
    expect(result.translated).toBe(1)
  })

  /**
   * The defect this exists for: `/ja/pricing` rendered its FAQ heading and none
   * of the 21 questions, because the content collection has no `ja` entries and
   * returned an empty array. Missing copy is worse than English copy — a reader
   * cannot tell it was ever there.
   */
  it('reports a section that is present in English and absent in the locale', () => {
    const result = comparePage({
      english: page(
        '<h2>FAQ</h2><details>a</details><details>b</details><details>c</details>'
      ),
      localized: page('<h2>FAQ</h2>'),
      preserveTerms: preserve
    })
    expect(result.tagRatio).toBeLessThan(0.9)
  })

  /**
   * Equal node counts do not mean equal order. A positional comparison would
   * line the moved English string up against a different node, see a
   * difference, and score it as translated.
   */
  it('still sees English that moved to another position', () => {
    const result = comparePage({
      english: page('<p>Run it locally</p><p>Build anything</p>'),
      localized: page('<p>本地运行</p><p>Run it locally</p>'),
      preserveTerms: preserve
    })
    expect(result.translated).toBe(0.5)
    expect(result.stillEnglish).toContain('Run it locally')
  })

  it('tolerates markup reordered inside a translated string', () => {
    const result = comparePage({
      english: page(
        '<p>See <strong>the</strong> <a href="/x">docs</a> now</p>'
      ),
      localized: page('<p><a href="/x">文档</a>在<strong>这里</strong></p>'),
      preserveTerms: preserve
    })
    expect(result.tagRatio).toBe(1)
  })
})
