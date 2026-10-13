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
    description: { en: `${id} description`, 'zh-CN': `${id} 描述` },
    href: `https://cloud.comfy.org/?template=${id}`,
    ...overrides
  }
}

function list(
  items: ModelLaunchListItem[],
  ctaKey?: ModelLaunchList['ctaKey']
): ModelLaunchList {
  return { headingKey: 'minimaxLicense.steps.heading', ctaKey, items }
}

function mockMedia(duration: number) {
  vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(
    duration
  )
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  return vi
    .spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(() => {})
}

describe('ModelLaunchListSection', () => {
  it('links each row title and CTA to the item href', () => {
    render(ModelLaunchListSection, {
      props: { list: list([item('a'), item('b')], 'modelLaunch.copyLink') }
    })

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    const hrefs = within(rows[1])
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(hrefs).toHaveLength(4)
    expect(new Set(hrefs)).toEqual(
      new Set(['https://cloud.comfy.org/?template=b'])
    )
  })

  it('offers a play button only on rows that carry audio', () => {
    mockMedia(0)
    render(ModelLaunchListSection, {
      props: {
        list: list([item('audio', { audioSources: [clip] }), item('plain')])
      }
    })

    const [audioRow, plainRow] = screen.getAllByRole('listitem')
    expect(within(audioRow).getByRole('button', { name: 'Play' })).toBeTruthy()
    expect(within(plainRow).queryByRole('button', { name: 'Play' })).toBeNull()
  })

  it.for([
    { duration: 65, label: '01:05' },
    { duration: Number.POSITIVE_INFINITY, label: null }
  ])(
    'shows the clip length $label for a reported duration of $duration',
    async ({ duration, label }) => {
      mockMedia(duration)
      render(ModelLaunchListSection, {
        props: { list: list([item('audio', { audioSources: [clip] })]) }
      })
      await nextTick()

      const row = screen.getByRole('listitem')
      if (label === null) {
        expect(within(row).queryByText(/\d\d:\d\d/)).toBeNull()
      } else {
        expect(within(row).getAllByText(label)).not.toHaveLength(0)
      }
    }
  )

  it('pauses every other row when one starts playing', async () => {
    const pause = mockMedia(9)
    render(ModelLaunchListSection, {
      props: {
        list: list([
          item('first', { audioSources: [clip] }),
          item('second', { audioSources: [clip] })
        ])
      }
    })

    await nextTick()
    const first = screen.getByLabelText('first title')
    const second = screen.getByLabelText('second title')
    await fireEvent(first, new Event('play'))

    expect(pause.mock.instances).toContain(second)
    expect(pause.mock.instances).not.toContain(first)
  })
})
