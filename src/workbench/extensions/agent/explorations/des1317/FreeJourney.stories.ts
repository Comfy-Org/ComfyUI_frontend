import type { Meta, StoryObj } from '@storybook/vue3-vite'

import {
  authenticatedRemoteConfigState,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { FREE_USE_NOTICE_DISMISSED_KEY } from '@/workbench/extensions/agent/components/agent/freeUseNoticeDismissal'
import '@/workbench/extensions/agent/agentPanel.css'

import ExplorationAgentDock from './ExplorationAgentDock.vue'
import {
  almostGoneEntries,
  emptyHistory,
  paidEntries,
  panelTabs,
  portraitTab,
  usingFreeEntries
} from './fixtures'

function clearNoticeDismissals() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(FREE_USE_NOTICE_DISMISSED_KEY)) {
      localStorage.removeItem(key)
    }
  }
}

const panelChrome = {
  historyGroups: emptyHistory,
  userName: 'Comfy user',
  activeTab: portraitTab,
  workflowTabs: panelTabs
} as const

const meta: Meta<typeof ExplorationAgentDock> = {
  title: 'Explorations/DES-1317/Free journey',
  component: ExplorationAgentDock,
  parameters: { layout: 'fullscreen' },
  globals: { theme: 'dark' },
  args: {
    ...panelChrome,
    chrome: 'app'
  },
  argTypes: {
    activeLedger: { control: 'select', options: ['free', 'paid'] },
    chrome: { control: 'select', options: ['app', 'dock'] }
  },
  beforeEach() {
    clearNoticeDismissals()
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const ConsentBadge: Story = {
  args: {
    showConsent: true,
    showLedger: false,
    entries: []
  }
}

export const UsingFree: Story = {
  args: {
    entries: usingFreeEntries,
    freeAmount: '1.2 / 2.0',
    paidAmount: '128,400',
    activeLedger: 'free',
    statusKey: 'agent.explorations.des1317.usingFree',
    freeUsePlacement: 'top-banner',
    streaming: true
  }
}

export const AlmostGone: Story = {
  args: {
    entries: almostGoneEntries,
    freeAmount: 'Low / 2.0',
    paidAmount: '128,400',
    activeLedger: 'free',
    freeLow: true,
    statusKey: 'agent.explorations.des1317.almostGoneStatus',
    showAlmostGone: true,
    streaming: true
  }
}

export const Paid: Story = {
  args: {
    entries: paidEntries,
    freeAmount: '0 / 2.0',
    paidAmount: '127,980',
    activeLedger: 'paid',
    statusKey: 'agent.explorations.des1317.usingPaid',
    showCreditTransition: true
  },
  beforeEach() {
    clearNoticeDismissals()
    authenticatedRemoteConfigState.value = 'authenticated'
    remoteConfig.value = {
      ...remoteConfig.value,
      'agent-credit-usage-summary': 'treatment'
    }
  }
}

export const AllStates: Story = {
  render: () => ({
    components: { ExplorationAgentDock },
    setup() {
      return {
        panelChrome,
        usingFreeEntries,
        almostGoneEntries,
        paidEntries
      }
    },
    template: `
      <div class="grid h-auto w-[1440px] grid-cols-2 gap-4 bg-background p-4">
        <div class="h-[720px]">
          <ExplorationAgentDock
            v-bind="panelChrome"
            chrome="dock"
            caption-key="agent.explorations.des1317.journeyConsent"
            show-consent
            :show-ledger="false"
            :entries="[]"
          />
        </div>
        <div class="h-[720px]">
          <ExplorationAgentDock
            v-bind="panelChrome"
            chrome="dock"
            caption-key="agent.explorations.des1317.journeyUsingFree"
            :entries="usingFreeEntries"
            free-amount="1.2 / 2.0"
            paid-amount="128,400"
            active-ledger="free"
            status-key="agent.explorations.des1317.usingFree"
            free-use-placement="top-banner"
            streaming
          />
        </div>
        <div class="h-[720px]">
          <ExplorationAgentDock
            v-bind="panelChrome"
            chrome="dock"
            caption-key="agent.explorations.des1317.journeyAlmostGone"
            :entries="almostGoneEntries"
            free-amount="Low / 2.0"
            paid-amount="128,400"
            active-ledger="free"
            free-low
            status-key="agent.explorations.des1317.almostGoneStatus"
            show-almost-gone
            streaming
          />
        </div>
        <div class="h-[720px]">
          <ExplorationAgentDock
            v-bind="panelChrome"
            chrome="dock"
            caption-key="agent.explorations.des1317.journeyPaid"
            :entries="paidEntries"
            free-amount="0 / 2.0"
            paid-amount="127,980"
            active-ledger="paid"
            status-key="agent.explorations.des1317.usingPaid"
            show-credit-transition
          />
        </div>
      </div>
    `
  }),
  beforeEach() {
    clearNoticeDismissals()
    authenticatedRemoteConfigState.value = 'authenticated'
    remoteConfig.value = {
      ...remoteConfig.value,
      'agent-credit-usage-summary': 'treatment'
    }
  }
}
