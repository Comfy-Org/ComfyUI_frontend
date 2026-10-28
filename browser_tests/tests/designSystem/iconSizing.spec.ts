import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test(
  'Icon dimensions honor explicit utilities',
  { tag: '@ui' },
  async ({ comfyPage }) => {
    const sizes = await comfyPage.page.evaluate(() =>
      ['', 'size-3', 'size-6 shrink', 'w-8 h-5'].map((utilities) => {
        const icon = document.createElement('i')
        icon.className = `icon-[lucide--check] ${utilities}`
        document.body.append(icon)
        const style = getComputedStyle(icon)
        const dimensions = [style.width, style.height, style.flexShrink]
        icon.remove()
        return dimensions
      })
    )

    expect(sizes).toEqual([
      ['16px', '16px', '0'],
      ['12px', '12px', '0'],
      ['24px', '24px', '1'],
      ['32px', '20px', '0']
    ])
  }
)
