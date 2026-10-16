import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { PROTOTYPE_CHECK_MS } from '@/platform/openOnCloud/cloudWorkflowCheck'
import { openDeploySetupDialog } from '@/platform/openOnCloud/openDeploySetupDialog'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import { defaultGraph } from '@/scripts/defaultGraph'

import LocalEngineMenu from './LocalEngineMenu.vue'

const distribution = vi.hoisted(() => ({ isCloud: false }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  },
  isDesktop: false,
  isNightly: false
}))

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/composables/useErrorHandling'))
vi.mock(import('@/platform/openOnCloud/openWorkflowOnCloud'), () => ({
  openWorkflowOnCloud: vi.fn(async () => {})
}))
vi.mock(import('@/platform/openOnCloud/openDeploySetupDialog'), () => ({
  openDeploySetupDialog: vi.fn(async () => {})
}))
vi.mock(import('@/platform/openOnCloud/serializeRootGraph'), () => ({
  serializeRootGraph: vi.fn(() => defaultGraph)
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderMenu() {
  const user = userEvent.setup({
    advanceTimers: vi.advanceTimersByTime,
    pointerEventsCheck: 0
  })
  render(LocalEngineMenu, { global: { plugins: [i18n] } })
  return user
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('button', { name: 'Runs on Local. Choose where it runs' })
  )
  return screen.findByRole('menu')
}

async function pickPrototype(
  user: ReturnType<typeof userEvent.setup>,
  name: string
) {
  const prototypeSwitch = screen.getByRole('group', {
    name: 'Comfy Cloud check (prototype)'
  })
  await user.click(within(prototypeSwitch).getByRole('button', { name }))
}

describe('LocalEngineMenu', () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlags().flags).openOnCloudEnabled = true
  })

  it.for([
    { name: 'on Comfy Cloud', isCloud: true, flag: true },
    { name: 'while the flag is off', isCloud: false, flag: false }
  ])('is not offered $name', ({ isCloud, flag }) => {
    distribution.isCloud = isCloud
    onTestFinished(() => {
      distribution.isCloud = false
    })
    vi.mocked(useFeatureFlags().flags).openOnCloudEnabled = flag

    renderMenu()

    expect(
      screen.queryByRole('button', {
        name: 'Runs on Local. Choose where it runs'
      })
    ).not.toBeInTheDocument()
  })

  it('keeps Local checked and checks Comfy Cloud each time it opens', async () => {
    const user = renderMenu()

    const menu = await openMenu(user)

    expect(
      within(menu).getByRole('menuitemradio', { name: 'Local' })
    ).toHaveAttribute('aria-checked', 'true')
    const cloud = within(menu).getByTestId('engine-row-cloud')
    expect(cloud).toHaveAttribute('aria-disabled', 'true')
    expect(cloud).toHaveTextContent('Checking…')

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)
    expect(cloud).not.toHaveTextContent('Checking…')
    await user.keyboard('{Escape}')
    const reopened = await openMenu(user)

    expect(within(reopened).getByTestId('engine-row-cloud')).toHaveTextContent(
      'Checking…'
    )
  })

  it('offers Open once Comfy Cloud has everything', async () => {
    const user = renderMenu()
    const menu = await openMenu(user)

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)
    const open = within(menu).getByRole('menuitem', {
      name: 'Open this workflow on Comfy Cloud in a new browser tab'
    })
    expect(open).not.toHaveAttribute('aria-disabled')
    expect(within(menu).queryByText('Deploy your setup to Comfy Cloud')).toBe(
      null
    )

    await user.click(open)

    expect(openWorkflowOnCloud).toHaveBeenCalledOnce()
  })

  it('disables Comfy Cloud and offers the deploy when a node is missing', async () => {
    const user = renderMenu()
    await pickPrototype(user, "Can't open")
    const menu = await openMenu(user)

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)
    const cloud = within(menu).getByTestId('engine-row-cloud')
    expect(cloud).toHaveAttribute('aria-disabled', 'true')
    expect(cloud).toHaveTextContent('1 node missing')

    await user.click(
      within(menu).getByRole('menuitem', {
        name: /Deploy your setup to Comfy Cloud/
      })
    )

    expect(openDeploySetupDialog).toHaveBeenCalledOnce()
  })

  it('stays on Checking… while the switch says so', async () => {
    const user = renderMenu()
    await pickPrototype(user, 'Checking')
    const menu = await openMenu(user)

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS * 5)

    expect(within(menu).getByTestId('engine-row-cloud')).toHaveTextContent(
      'Checking…'
    )
  })
})
