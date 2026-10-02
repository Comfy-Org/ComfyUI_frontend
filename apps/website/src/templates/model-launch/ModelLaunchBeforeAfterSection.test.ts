import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { ModelLaunchBeforeAfter } from './types'

import ModelLaunchBeforeAfterSection from './ModelLaunchBeforeAfterSection.vue'

function beforeAfterWith(chinese: boolean): ModelLaunchBeforeAfter {
  return {
    headingKey: 'nvidiaRtx.beforeAfter.heading',
    bodyKey: 'nvidiaRtx.beforeAfter.body',
    tabs: [
      {
        id: 'sharpen',
        label: { en: 'Sharpen', 'zh-CN': chinese ? '锐化' : '' },
        caption: {
          en: 'Soft in, sharp out.',
          'zh-CN': chinese ? '输入柔和，输出锐利。' : ''
        },
        beforeSrc: 'https://media.comfy.org/a-before.webm',
        afterSrc: 'https://media.comfy.org/a-after.webm'
      },
      {
        id: 'denoise',
        label: { en: 'Denoise', 'zh-CN': chinese ? '降噪' : '' },
        caption: {
          en: 'Grain in, clean out.',
          'zh-CN': chinese ? '输入噪点，输出干净。' : ''
        },
        beforeSrc: 'https://media.comfy.org/b-before.webm',
        afterSrc: 'https://media.comfy.org/b-after.webm'
      }
    ]
  }
}

const beforeAfter = beforeAfterWith(true)

function videoSources(): (string | null)[] {
  return [
    screen.getByTestId('video-compare-before').getAttribute('src'),
    screen.getByTestId('video-compare-after').getAttribute('src')
  ]
}

describe('ModelLaunchBeforeAfterSection', () => {
  it('opens on the first tab with its clip pair and caption', async () => {
    render(ModelLaunchBeforeAfterSection, { props: { beforeAfter } })

    expect(
      screen.getByRole('tab', { name: 'Sharpen', selected: true })
    ).toBeVisible()
    expect(screen.getByText('Soft in, sharp out.')).toBeVisible()
    expect(
      screen.getByRole('slider', { name: 'Comparison slider' })
    ).toBeVisible()
    await waitFor(() =>
      expect(videoSources()).toEqual([
        'https://media.comfy.org/a-before.webm',
        'https://media.comfy.org/a-after.webm'
      ])
    )
  })

  it('swaps the clip pair and caption when another tab is clicked', async () => {
    const user = userEvent.setup()
    render(ModelLaunchBeforeAfterSection, { props: { beforeAfter } })

    await user.click(screen.getByRole('tab', { name: 'Denoise' }))
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

  it.for([
    {
      copy: 'Chinese copy',
      chinese: true,
      tab: '锐化',
      caption: '输入柔和，输出锐利。'
    },
    {
      copy: 'English fallback',
      chinese: false,
      tab: 'Sharpen',
      caption: 'Soft in, sharp out.'
    }
  ])(
    'renders $copy for the zh-CN locale with translated slider labels',
    ({ chinese, tab, caption }) => {
      render(ModelLaunchBeforeAfterSection, {
        props: { beforeAfter: beforeAfterWith(chinese), locale: 'zh-CN' }
      })

      expect(screen.getByRole('tab', { name: tab })).toBeVisible()
      expect(screen.getByText(caption)).toBeVisible()
      expect(screen.getByText('处理前')).toBeVisible()
      expect(screen.getByText('处理后')).toBeVisible()
      expect(screen.getByRole('slider', { name: '对比滑块' })).toBeVisible()
    }
  )
})
