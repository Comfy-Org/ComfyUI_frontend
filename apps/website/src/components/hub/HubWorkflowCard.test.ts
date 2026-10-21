import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { HubTemplate } from '@/lib/hub/types'
import HubWorkflowCard from './HubWorkflowCard.vue'

const template: HubTemplate = {
  name: 'comparison-workflow',
  title: 'Comparison workflow',
  mediaType: 'image',
  tags: [],
  models: [],
  logos: [],
  usage: 1,
  date: '2026-09-10',
  thumbnails: ['/after.webp', '/before.webp'],
  username: 'ComfyUI',
  isApp: false,
  thumbnailVariant: 'compareSlider'
}

describe('HubWorkflowCard', () => {
  it('lets keyboard users operate the image comparison slider', async () => {
    const user = userEvent.setup()
    render(HubWorkflowCard, {
      props: {
        template,
        href: '/workflows/comparison-workflow',
        tryNowLabel: 'Try now'
      }
    })

    const slider = screen.getByRole('slider', {
      name: 'Comparison workflow image comparison'
    })
    expect(slider.getAttribute('aria-valuemin')).toBe('0')
    expect(slider.getAttribute('aria-valuemax')).toBe('100')
    expect(slider.getAttribute('aria-valuenow')).toBe('50')

    await user.tab()
    await user.keyboard('{ArrowRight}{ArrowUp}')
    expect(slider.getAttribute('aria-valuenow')).toBe('54')
    expect(slider.getAttribute('aria-valuetext')).toBe('54%')

    await user.keyboard('{End}')
    expect(slider.getAttribute('aria-valuenow')).toBe('100')
    await user.keyboard('{Home}{ArrowLeft}')
    expect(slider.getAttribute('aria-valuenow')).toBe('0')
  })

  it.for(['compareSlider', 'hoverDissolve'] as const)(
    'shows one still for a %s template with one thumbnail',
    (thumbnailVariant) => {
      render(HubWorkflowCard, {
        props: {
          template: {
            ...template,
            thumbnailVariant,
            thumbnails: ['/after.webp']
          },
          href: '/workflows/comparison-workflow',
          tryNowLabel: 'Try now'
        }
      })
      expect(screen.queryByRole('slider')).toBeNull()
      expect(
        screen.getAllByRole('img', { name: 'Comparison workflow' })
      ).toHaveLength(1)
    }
  )

  it('names the compare stills in the page language', () => {
    render(HubWorkflowCard, {
      props: {
        template,
        href: '/zh-CN/workflows/comparison-workflow',
        tryNowLabel: '立即试用',
        locale: 'zh-CN'
      }
    })
    expect(
      screen.getByRole('img', { name: 'Comparison workflow - 处理后' })
    ).toBeTruthy()
    expect(
      screen.getByRole('img', { name: 'Comparison workflow - 处理前' })
    ).toBeTruthy()
  })
})
