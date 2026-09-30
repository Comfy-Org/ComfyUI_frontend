import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { ModelLaunchCompare } from './types'

import ModelLaunchCompareSection from './ModelLaunchCompareSection.vue'

const compare: ModelLaunchCompare = {
  headingKey: 'nvidiaRtx.compare.heading',
  bodyKey: 'nvidiaRtx.compare.body',
  tabs: [
    {
      id: 'sharpen',
      label: { en: 'Sharpen', 'zh-CN': '锐化' },
      caption: { en: 'Soft in, sharp out.', 'zh-CN': '输入柔和，输出锐利。' },
      beforeSrc: 'https://media.comfy.org/a-before.webm',
      afterSrc: 'https://media.comfy.org/a-after.webm'
    },
    {
      id: 'denoise',
      label: { en: 'Denoise', 'zh-CN': '降噪' },
      caption: { en: 'Grain in, clean out.', 'zh-CN': '输入噪点，输出干净。' },
      beforeSrc: 'https://media.comfy.org/b-before.webm',
      afterSrc: 'https://media.comfy.org/b-after.webm'
    }
  ]
}

function videoSources(): string[] {
  return [...document.querySelectorAll('video')].map(
    (video) => video.getAttribute('src') ?? ''
  )
}

describe('ModelLaunchCompareSection', () => {
  it('opens on the first tab with its clip pair and caption', () => {
    render(ModelLaunchCompareSection, { props: { compare } })

    expect(
      screen.getByRole('tab', { name: 'Sharpen', selected: true })
    ).toBeVisible()
    expect(screen.getByText('Soft in, sharp out.')).toBeVisible()
    expect(videoSources()).toEqual([
      'https://media.comfy.org/a-before.webm',
      'https://media.comfy.org/a-after.webm'
    ])
    expect(
      screen.getByRole('slider', { name: 'Comparison slider' })
    ).toBeVisible()
  })

  it('swaps the clip pair and caption when another tab is chosen', async () => {
    render(ModelLaunchCompareSection, { props: { compare } })

    screen.getByRole('tab', { name: 'Denoise' }).focus()
    await screen.findByText('Grain in, clean out.')

    expect(screen.getByRole('tab', { name: 'Denoise' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.queryByText('Soft in, sharp out.')).toBeNull()
    await waitFor(() =>
      expect(videoSources()).toEqual([
        'https://media.comfy.org/b-before.webm',
        'https://media.comfy.org/b-after.webm'
      ])
    )
  })

  it('renders localized tab labels, captions, and slider labels', () => {
    render(ModelLaunchCompareSection, {
      props: { compare, locale: 'zh-CN' }
    })

    expect(screen.getByRole('tab', { name: '锐化' })).toBeVisible()
    expect(screen.getByText('输入柔和，输出锐利。')).toBeVisible()
    expect(screen.getByText('处理前')).toBeVisible()
    expect(screen.getByText('处理后')).toBeVisible()
  })
})
