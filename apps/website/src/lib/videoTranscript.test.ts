import { describe, expect, it, vi } from 'vitest'

import { fetchTranscript, parseVttToTranscript } from './videoTranscript'

describe('parseVttToTranscript', () => {
  it('drops the header, cue numbers, and timestamp lines', () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:02.000
Hello there.

2
00:00:02.000 --> 00:00:04.000
This is a caption.`
    expect(parseVttToTranscript(vtt)).toEqual([
      'Hello there. This is a caption.'
    ])
  })

  it('strips inline VTT markup tags from cue text', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
<v Speaker>Hello</v> there.`
    expect(parseVttToTranscript(vtt)).toEqual(['Hello there.'])
  })

  it('skips NOTE and STYLE blocks', () => {
    const vtt = `WEBVTT

NOTE this is a comment

00:00:00.000 --> 00:00:02.000
Real caption text.`
    expect(parseVttToTranscript(vtt)).toEqual(['Real caption text.'])
  })

  it('returns an empty array for a header-only file', () => {
    expect(parseVttToTranscript('WEBVTT\n')).toEqual([])
  })

  it('splits into multiple paragraphs once merged text passes the length threshold', () => {
    const longCue = 'word '.repeat(60).trim()
    const vtt = `WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n${longCue}\n\n00:00:02.000 --> 00:00:04.000\n${longCue}`
    const paragraphs = parseVttToTranscript(vtt)
    expect(paragraphs.length).toBeGreaterThan(1)
  })
})

describe('fetchTranscript', () => {
  it('parses the response body into transcript paragraphs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello there.'
          )
      })
    )
    expect(await fetchTranscript('https://example.com/video.vtt')).toEqual([
      'Hello there.'
    ])
  })

  it('returns an empty array instead of throwing on a failed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(await fetchTranscript('https://example.com/video.vtt')).toEqual([])
  })

  it('returns an empty array instead of throwing when the fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect(await fetchTranscript('https://example.com/video.vtt')).toEqual([])
  })
})
