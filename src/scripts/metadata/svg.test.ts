import { describe, expect, it } from 'vitest'

import { getSvgMetadata } from './svg'

function svgFile(content: string): File {
  return new File([content], 'test.svg', { type: 'image/svg+xml' })
}

describe('getSvgMetadata', () => {
  it('extracts workflow and prompt from CDATA in <metadata>', async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <metadata><![CDATA[${JSON.stringify({
        workflow: { nodes: [] },
        prompt: { '1': {} }
      })}]]></metadata>
      <rect width="1" height="1"/>
    </svg>`

    const result = await getSvgMetadata(svgFile(svg))

    expect(result).toEqual({
      workflow: { nodes: [] },
      prompt: { '1': {} }
    })
  })

  it('returns empty when SVG has no metadata element', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'

    const result = await getSvgMetadata(svgFile(svg))

    expect(result).toEqual({})
  })

  it('returns empty when CDATA contains invalid JSON', async () => {
    const svg = `<svg><metadata><![CDATA[not valid json]]></metadata></svg>`

    const result = await getSvgMetadata(svgFile(svg))

    expect(result).toEqual({})
  })
})
