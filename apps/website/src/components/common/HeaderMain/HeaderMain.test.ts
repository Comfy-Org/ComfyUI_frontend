import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, readonly, ref } from 'vue'

import { requestWorkshopBuyCredits } from '@/config/workshop-buy-credits'
import type { HubApp } from '@/data/mainNavigation'
import {
  useWorkshopAppsEnabled,
  useWorkshopAuthFlag,
  useWorkshopEnabled,
  useWorkshopFlag,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'
import HeaderMain from './HeaderMain.vue'

vi.mock(import('@/scripts/posthog'))
vi.mock(import('@/config/workshop-account-source'), () => ({
  resolveWorkshopAccountSource: () => Promise.resolve('firebase'),
  peekWorkshopAccountSource: () => 'firebase'
}))

let flag = ref(false)
let visibility = ref(false)

const RESHOOT_FLAG = 'workshop-reshoot-app-enabled'
const HUB_APPS: HubApp[] = [
  { appId: 'studio' },
  { appId: 'reshoot', flag: RESHOOT_FLAG }
]

function renderHeader(workshopInBuild = false, hubApps: HubApp[] = []) {
  return render(HeaderMain, {
    props: { workshopInBuild, hubApps },
    global: {
      stubs: {
        HeaderAccount: defineComponent({
          render: () => h('div', { 'data-testid': 'header-account' })
        }),
        BuyCreditsDialog: defineComponent({
          props: { open: { type: Boolean, required: true } },
          setup: (props) => () =>
            props.open
              ? h('div', { 'data-testid': 'buy-credits-dialog' })
              : null
        })
      }
    }
  })
}

beforeEach(() => {
  flag = ref(false)
  visibility = ref(false)
  vi.mocked(useWorkshopAuthFlag).mockReturnValue(readonly(flag))
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(visibility))
})

describe('HeaderMain workshop gating', () => {
  it.for([
    { workshopInBuild: false, enabled: true },
    { workshopInBuild: true, enabled: false },
    { workshopInBuild: true, enabled: true }
  ])(
    'keeps Hub in the top navigation when workshopInBuild is $workshopInBuild',
    async ({ workshopInBuild, enabled }) => {
      visibility.value = enabled
      renderHeader(workshopInBuild)
      await nextTick()

      expect(
        within(screen.getByTestId('desktop-nav-links')).getByRole('button', {
          name: /^Hub\b/i
        })
      ).toBeTruthy()
      expect(screen.queryByRole('button', { name: /^Models\b/i })).toBeNull()
    }
  )

  async function openHubMenu() {
    await userEvent.click(
      within(screen.getByTestId('desktop-nav-links')).getByRole('button', {
        name: /^Hub\b/i
      })
    )
    return screen.findByTestId('nav-dropdown')
  }

  function setHubFlags(workflows: boolean, apps: boolean) {
    vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(
      readonly(ref(workflows))
    )
    vi.mocked(useWorkshopAppsEnabled).mockReturnValue(readonly(ref(apps)))
  }

  it.for([
    { enabled: true, workflows: false, apps: false, headers: ['Models'] },
    {
      enabled: true,
      workflows: true,
      apps: false,
      headers: ['Models', 'Workflows']
    },
    {
      enabled: true,
      workflows: true,
      apps: true,
      headers: ['Models', 'Workflows', 'Apps']
    },
    { enabled: false, workflows: true, apps: true, headers: ['Models'] }
  ])(
    'shows the Hub columns whose flags are on (workshop $enabled): $headers',
    async ({ enabled, workflows, apps, headers }) => {
      visibility.value = enabled
      setHubFlags(workflows, apps)
      renderHeader(true)
      const menu = within(await openHubMenu())

      expect(
        ['Models', 'Workflows', 'Apps'].filter((header) =>
          menu.queryByText(header, { exact: true })
        )
      ).toEqual(headers)
    }
  )

  it.for([
    { reshootFlag: true, apps: ['Cinematic Studio', 'Re-shoot'] },
    { reshootFlag: false, apps: ['Cinematic Studio'] }
  ])(
    'lists Re-shoot under Apps only when its own flag is on: $reshootFlag',
    async ({ reshootFlag, apps }) => {
      visibility.value = true
      setHubFlags(false, true)
      vi.mocked(useWorkshopFlag).mockImplementation((name) =>
        readonly(ref(name === RESHOOT_FLAG && reshootFlag))
      )
      renderHeader(true, HUB_APPS)
      const menu = within(await openHubMenu())

      const appLinks = within(menu.getByRole('list', { name: 'Apps' }))

      expect(
        ['Cinematic Studio', 'Re-shoot'].filter((app) =>
          appLinks.queryByRole('link', { name: new RegExp(`^${app}`) })
        )
      ).toEqual(apps)
    }
  )

  it('mounts no account island while the flag is off', () => {
    renderHeader()

    expect(screen.queryByTestId('header-account')).toBeNull()
  })

  it('mounts the account island when the flag turns on after mount', async () => {
    visibility.value = true
    renderHeader(true)
    expect(screen.queryByTestId('header-account')).toBeNull()

    flag.value = true

    await waitFor(() => {
      expect(
        screen.getAllByTestId('header-account').length,
        'a one-shot flag read at the header layer would strand every flag-on visitor signed out'
      ).toBeGreaterThan(0)
    })
  })

  it('mounts the account island in the mobile row as well as the desktop row', async () => {
    flag.value = true
    visibility.value = true
    renderHeader(true)

    await waitFor(() => {
      expect(
        within(screen.getByTestId('mobile-nav-cta')).getByTestId(
          'header-account'
        ),
        'the desktop row is hidden below lg, so a phone would have no sign-in, account, or sign-out'
      ).toBeTruthy()
    })
    expect(
      within(screen.getByTestId('desktop-nav-cta')).getByTestId(
        'header-account'
      )
    ).toBeTruthy()
  })

  it('owns one credits dialog for both account placements and page requests', async () => {
    flag.value = true
    visibility.value = true
    renderHeader(true)
    await waitFor(() =>
      expect(screen.getAllByTestId('header-account')).toHaveLength(2)
    )

    requestWorkshopBuyCredits()

    await waitFor(() =>
      expect(screen.getAllByTestId('buy-credits-dialog')).toHaveLength(1)
    )
  })

  it('replays a request made before the header island mounts', async () => {
    flag.value = true
    visibility.value = true
    requestWorkshopBuyCredits()

    renderHeader(true)

    expect(await screen.findByTestId('buy-credits-dialog')).toBeTruthy()
  })

  it('does not latch requests while auth is disabled', async () => {
    visibility.value = true
    renderHeader(true)

    requestWorkshopBuyCredits()
    flag.value = true

    await waitFor(() =>
      expect(screen.getAllByTestId('header-account')).toHaveLength(2)
    )
    expect(screen.queryByTestId('buy-credits-dialog')).toBeNull()
  })

  it('keeps an active checkout mounted through a flag refresh', async () => {
    flag.value = true
    visibility.value = true
    renderHeader(true)
    requestWorkshopBuyCredits()
    expect(await screen.findByTestId('buy-credits-dialog')).toBeTruthy()

    flag.value = false
    await waitFor(() =>
      expect(screen.queryByTestId('header-account')).toBeNull()
    )
    expect(screen.getByTestId('buy-credits-dialog')).toBeTruthy()
    flag.value = true
    await waitFor(() =>
      expect(screen.getAllByTestId('header-account')).toHaveLength(2)
    )

    expect(screen.getByTestId('buy-credits-dialog')).toBeTruthy()
  })

  it('ignores credits requests while workshop access is hidden', async () => {
    flag.value = true
    renderHeader(true)
    await nextTick()

    requestWorkshopBuyCredits()
    await nextTick()
    expect(screen.queryByTestId('buy-credits-dialog')).toBeNull()

    visibility.value = true
    await waitFor(() =>
      expect(screen.getAllByTestId('header-account')).toHaveLength(2)
    )
    expect(screen.queryByTestId('buy-credits-dialog')).toBeNull()

    requestWorkshopBuyCredits()
    expect(await screen.findByTestId('buy-credits-dialog')).toBeTruthy()
  })

  it('removes the account controls when access is revoked', async () => {
    flag.value = true
    renderHeader(true)
    expect(screen.queryByTestId('header-account')).toBeNull()

    visibility.value = true
    expect(await screen.findAllByTestId('header-account')).not.toHaveLength(0)
    visibility.value = false
    await nextTick()
    expect(screen.queryByTestId('header-account')).toBeNull()
  })
})
