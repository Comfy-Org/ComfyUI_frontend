<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Badge from '@comfyorg/design-system/badge/Badge'
import CreditBadge from '@comfyorg/design-system/badge/CreditBadge'
import Message from '@comfyorg/design-system/message/Message'
import { cn } from '@comfyorg/tailwind-utils'

import { AGENT_DOCS_URL } from '@/workbench/extensions/agent/agentDocs'
import AgentConsentCard from '@/workbench/extensions/agent/components/agent/AgentConsentCard.vue'
import AgentCreditTransitionNotice from '@/workbench/extensions/agent/components/agent/AgentCreditTransitionNotice.vue'
import AgentPanel from '@/workbench/extensions/agent/components/agent/AgentPanel.vue'
import type { FreeUseVariant } from '@/workbench/extensions/agent/experiments/freeUsePlacement'
import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import type { ConversationEntry } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import type { ActiveTab } from '@/workbench/extensions/agent/types/activeTab'

import DualLedgerChip from './DualLedgerChip.vue'
import { CONSENT_POSTER_SRC, CONSENT_VIDEO_SOURCES } from './consentMedia'

type StatusKey =
  | 'agent.explorations.des1317.usingFree'
  | 'agent.explorations.des1317.almostGoneStatus'
  | 'agent.explorations.des1317.usingPaid'

type CaptionKey =
  | 'agent.explorations.des1317.journeyConsent'
  | 'agent.explorations.des1317.journeyUsingFree'
  | 'agent.explorations.des1317.journeyAlmostGone'
  | 'agent.explorations.des1317.journeyPaid'

const {
  entries = [],
  historyGroups,
  userName = 'Comfy user',
  activeTab = null,
  workflowTabs = [],
  freeAmount = '1.4 / 2.0',
  paidAmount = '128,400',
  activeLedger = 'free',
  freeLow = false,
  ledgerOpen = false,
  showLedger = true,
  statusKey,
  freeUsePlacement = 'control',
  showCreditTransition = false,
  showAlmostGone = false,
  showConsent = false,
  chrome = 'app',
  captionKey,
  streaming = false
} = defineProps<{
  entries?: ConversationEntry[]
  historyGroups: HistoryGroups
  userName?: string
  activeTab?: ActiveTab | null
  workflowTabs?: ActiveTab[]
  freeAmount?: string
  paidAmount?: string
  activeLedger?: 'free' | 'paid'
  freeLow?: boolean
  ledgerOpen?: boolean
  showLedger?: boolean
  statusKey?: StatusKey
  freeUsePlacement?: FreeUseVariant
  showCreditTransition?: boolean
  showAlmostGone?: boolean
  showConsent?: boolean
  chrome?: 'app' | 'dock'
  captionKey?: CaptionKey
  streaming?: boolean
}>()

const { t } = useI18n()
const consentParagraphs = [t('agent.consent.body1'), t('agent.consent.body2')]
</script>

<template>
  <div
    :class="
      cn(
        'relative',
        chrome === 'app'
          ? 'flex h-screen w-[1440px] bg-background'
          : 'flex h-full w-[420px] flex-col bg-background'
      )
    "
  >
    <div v-if="chrome === 'app'" class="min-w-0 flex-1 bg-secondary" />
    <div
      data-testid="des1317-panel-dock"
      :class="
        cn(
          'flex h-full shrink-0 flex-col',
          chrome === 'app' && 'w-[420px] border-l border-border'
        )
      "
    >
      <p
        v-if="captionKey"
        class="shrink-0 px-2 py-1 text-xs text-muted-foreground"
      >
        {{ t(captionKey) }}
      </p>
      <div class="relative min-h-0 flex-1 p-2">
        <div
          class="relative size-full overflow-hidden rounded-lg border bg-background"
        >
          <div class="agent-scope size-full">
            <AgentPanel
              :entries
              :history-groups="historyGroups"
              :user-name="userName"
              :active-tab="activeTab"
              :workflow-tabs="workflowTabs"
              :free-use-placement="freeUsePlacement"
              :streaming
            >
              <template v-if="showLedger" #panelNotice>
                <div
                  class="flex flex-wrap items-center gap-2 border-b px-4 py-2"
                >
                  <DualLedgerChip
                    :free-amount="freeAmount"
                    :paid-amount="paidAmount"
                    :active-ledger="activeLedger"
                    :free-low="freeLow"
                    :initially-open="ledgerOpen"
                  />
                  <Badge
                    v-if="statusKey"
                    variant="pill"
                    class="border bg-transparent text-xs text-muted-foreground"
                  >
                    {{ t(statusKey) }}
                  </Badge>
                </div>
              </template>
              <template
                v-if="showAlmostGone || showCreditTransition"
                #composerNotice
              >
                <Message
                  v-if="showAlmostGone"
                  severity="warning"
                  closable
                  :close-label="t('agent.dismiss')"
                >
                  <template #icon>
                    <i
                      aria-hidden="true"
                      class="icon-[heroicons--information-circle-20-solid] size-5 text-warning"
                    />
                  </template>
                  <div class="flex min-w-0 flex-col gap-0.5">
                    <p class="my-0 font-medium">
                      {{ t('agent.explorations.des1317.almostGoneTitle') }}
                    </p>
                    <p class="my-0 text-muted-foreground">
                      {{ t('agent.explorations.des1317.almostGoneBody') }}
                    </p>
                  </div>
                </Message>
                <AgentCreditTransitionNotice v-if="showCreditTransition" />
              </template>
            </AgentPanel>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="showConsent"
      :class="
        cn(
          'z-20 overflow-y-auto bg-background/80',
          chrome === 'app' ? 'absolute inset-0' : 'absolute inset-2 rounded-lg'
        )
      "
    >
      <div class="flex min-h-full items-center justify-center p-4">
        <div class="flex w-full max-w-[600px] flex-col items-center gap-3">
          <Message severity="info" class="w-full whitespace-normal">
            <template #icon>
              <CreditBadge
                :text="t('agent.explorations.des1317.consentBadgeAmount')"
              />
            </template>
            {{ t('agent.explorations.des1317.consentBadgeBody') }}
          </Message>
          <AgentConsentCard
            :title="t('agent.consent.title')"
            :paragraphs="consentParagraphs"
            :video-sources="CONSENT_VIDEO_SOURCES"
            :poster-src="CONSENT_POSTER_SRC"
            :docs-url="AGENT_DOCS_URL"
          />
        </div>
      </div>
    </div>
  </div>
</template>
