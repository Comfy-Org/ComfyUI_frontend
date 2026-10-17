import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Disable animations', { tag: '@ui' }, () => {
  test('stops repeated element and pseudo-element animations', async ({
    comfyPage
  }) => {
    const iterations = await comfyPage.page.evaluate(() => {
      const style = document.createElement('style')
      style.textContent = `
        @keyframes reduced-motion-test {
          from { opacity: 1; }
          to { opacity: 0.5; }
        }
        .reduced-motion-test {
          animation: reduced-motion-test 2s linear infinite;
        }
        .reduced-motion-test::before,
        .reduced-motion-test::after {
          content: '';
          animation: reduced-motion-test 2s linear infinite;
        }
      `

      const target = document.createElement('div')
      target.className = 'reduced-motion-test'
      const wasDisabled = document.body.classList.contains('disable-animations')
      document.head.appendChild(style)
      document.body.appendChild(target)

      try {
        document.body.classList.remove('disable-animations')
        const enabled = [
          getComputedStyle(target).animationIterationCount,
          getComputedStyle(target, '::before').animationIterationCount,
          getComputedStyle(target, '::after').animationIterationCount
        ]

        document.body.classList.add('disable-animations')
        const disabled = [
          getComputedStyle(target).animationIterationCount,
          getComputedStyle(target, '::before').animationIterationCount,
          getComputedStyle(target, '::after').animationIterationCount
        ]

        return { enabled, disabled }
      } finally {
        document.body.classList.toggle('disable-animations', wasDisabled)
        target.remove()
        style.remove()
      }
    })

    expect(iterations).toEqual({
      enabled: ['infinite', 'infinite', 'infinite'],
      disabled: ['1', '1', '1']
    })
  })
})
