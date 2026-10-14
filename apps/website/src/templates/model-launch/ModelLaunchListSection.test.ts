import { fireEvent, render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { ModelLaunchList, ModelLaunchListItem } from './types'

import ModelLaunchListSection from './ModelLaunchListSection.vue'

const clip = { src: 'https://media.comfy.org/clip.mp3', type: 'audio/mpeg' }

function item(
  id: string,
  overrides: Partial<ModelLaunchListItem> = {}
): ModelLaunchListItem {
  return {
    id,
    title: { en: `${id} title`, 'zh-CN': `${id} 标题` },
    prompt: `[whisper] ${id} prompt`,
    durationSeconds: 8,
    voices: [{ name: `${id} voice` }],
    href: `https://cloud.comfy.org/?template=${id}`,
    audioSources: [clip],
    ...overrides
  }
}

function list(
  items: ModelLaunchListItem[],
  ctaKey?: ModelLaunchList['ctaKey']
): ModelLaunchList {
  return { headingKey: 'fishAudio.samples.heading', ctaKey, items }
}

function mockMedia() {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  return vi
    .spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(() => {})
}

describe('ModelLaunchListSection', () => {
  it('links each row title and CTA to the item href', () => {
    mockMedia()
    render(ModelLaunchListSection, {
      props: { list: list([item('a'), item('b')], 'fishAudio.samples.cta') }
    })

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    const hrefs = within(rows[1])
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(hrefs).toHaveLength(3)
    expect(new Set(hrefs)).toEqual(
      new Set(['https://cloud.comfy.org/?template=b'])
    )
  })

  it.for([
    {
      voices: [{ name: 'Narrator (en)' }],
      meta: '(44s) · voice: Narrator (en)'
    },
    {
      voices: [
        { name: 'Sarah (en)', alias: '@Voice1' },
        { name: 'Adrian (en)', alias: '@Voice2' }
      ],
      meta: '(44s) · voices: @Voice1 Sarah (en), @Voice2 Adrian (en)'
    }
  ])('shows the clip length and voices as "$meta"', ({ voices, meta }) => {
    mockMedia()
    render(ModelLaunchListSection, {
      props: { list: list([item('scene', { voices, durationSeconds: 44 })]) }
    })

    const row = screen.getByRole('listitem')
    expect(within(row).getByText(meta)).toBeTruthy()
    expect(within(row).getByText('[whisper] scene prompt')).toBeTruthy()
    expect(
      within(row).getByRole('button', { name: 'Copy prompt' })
    ).toBeTruthy()
  })

  it('pauses every other row when one starts playing', async () => {
    const pause = mockMedia()
    render(ModelLaunchListSection, {
      props: { list: list([item('first'), item('second')]) }
    })

    await nextTick()
    const first = screen.getByLabelText('first title')
    const second = screen.getByLabelText('second title')
    await fireEvent(first, new Event('play'))

    expect(pause.mock.instances).toContain(second)
    expect(pause.mock.instances).not.toContain(first)
  })
})
