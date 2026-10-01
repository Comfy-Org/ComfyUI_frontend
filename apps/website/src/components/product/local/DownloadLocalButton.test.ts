import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { captureDownloadClick } from '../../../scripts/posthog'
import DownloadLocalButton from './DownloadLocalButton.vue'

vi.mock(import('../../../scripts/posthog'))

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  freeBsd:
    'Mozilla/5.0 (X11; FreeBSD amd64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
}

function visitWith(userAgent: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(0)
}

async function openMenu() {
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: 'All installers' })
  )
  return user
}

describe('DownloadLocalButton', () => {
  it.for([
    { label: 'a recognized desktop', userAgent: UA.linux },
    { label: 'an unrecognized desktop', userAgent: UA.freeBsd }
  ])('lists every installer on $label', async ({ userAgent }) => {
    visitWith(userAgent)
    render(DownloadLocalButton, { props: { showInstallerMenu: true } })

    await openMenu()

    expect(
      screen
        .getAllByRole('menuitem')
        .map((item) => [item.textContent.trim(), item.getAttribute('href')])
    ).toEqual([
      [
        'Windows x64 (including Snapdragon)',
        'https://comfy.org/download/windows/nsis/x64'
      ],
      [
        'Windows ARM64 (NVIDIA only)',
        'https://comfy.org/download/windows/nsis/arm64'
      ],
      ['macOS (Apple Silicon)', 'https://download.comfy.org/mac/dmg/arm64'],
      ['Linux x64 (AppImage)', 'https://download.comfy.org/linux/appimage/x64']
    ])
  })

  it('attaches the installer menu to the Windows fallback button', async () => {
    visitWith(UA.freeBsd)
    render(DownloadLocalButton, { props: { showInstallerMenu: true } })
    const user = userEvent.setup()
    await screen.findByRole('link', { name: /Windows/ })

    await user.tab()
    expect(screen.getByRole('link', { name: /Windows/ })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'All installers' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: /macOS/ })).toHaveFocus()
  })

  it('offers no installers on a phone', async () => {
    visitWith(UA.iphone)

    render(DownloadLocalButton, { props: { showInstallerMenu: true } })
    expect(screen.queryByRole('button')).toBeNull()
    await nextTick()

    expect(screen.queryByRole('button')).toBeNull()
  })

  it.for([
    { installer: 'Windows x64 (including Snapdragon)', platform: 'windows' },
    { installer: 'Windows ARM64 (NVIDIA only)', platform: 'windows' },
    { installer: 'macOS (Apple Silicon)', platform: 'mac' },
    { installer: 'Linux x64 (AppImage)', platform: 'linux' }
  ])(
    'reports a $installer download as $platform',
    async ({ installer, platform }) => {
      visitWith(UA.mac)
      render(DownloadLocalButton, { props: { showInstallerMenu: true } })
      const user = await openMenu()
      const selectedInstaller = screen.getByRole('menuitem', {
        name: installer
      })
      selectedInstaller.addEventListener(
        'click',
        (event) => event.preventDefault(),
        { once: true }
      )

      await user.click(selectedInstaller)

      expect(captureDownloadClick).toHaveBeenCalledExactlyOnceWith(platform)
    }
  )

  it('keeps the plain download button outside the hero', async () => {
    visitWith(UA.mac)
    render(DownloadLocalButton)

    expect(
      await screen.findByRole('link', { name: 'DOWNLOAD DESKTOP' })
    ).toHaveAttribute('href', 'https://download.comfy.org/mac/dmg/arm64')
    expect(screen.queryByRole('button', { name: 'All installers' })).toBeNull()
  })

  it('labels the dropdown and installers in Chinese', async () => {
    visitWith(UA.linux)
    render(DownloadLocalButton, {
      props: { showInstallerMenu: true, locale: 'zh-CN' }
    })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '全部安装包' }))

    expect(
      screen.getByRole('menuitem', { name: 'macOS（Apple 芯片）' })
    ).toHaveAttribute('href', 'https://download.comfy.org/mac/dmg/arm64')
  })
})
