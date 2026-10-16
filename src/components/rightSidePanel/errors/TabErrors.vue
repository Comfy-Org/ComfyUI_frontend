<template>
  <div class="flex h-full min-w-0 flex-col">
    <ErrorGroupList class="min-h-0 flex-1" />

    <ErrorPanelSurveyCta v-if="ErrorPanelSurveyCta" />

    <!-- Fixed Footer: bulk Ask agent + Help Links -->
    <div
      class="min-w-0 shrink-0 border-t border-interface-stroke bg-interface-panel-surface p-4"
    >
      <Button
        v-if="canAskAgent && allErrorGroups.length > 0"
        variant="secondary"
        size="sm"
        class="mb-3 w-full"
        data-testid="errors-footer-ask-agent"
        @click="askAgentAboutAll"
      >
        {{ t('rightSidePanel.askAgentAboutAll') }}
      </Button>
      <i18n-t
        keypath="rightSidePanel.errorHelp"
        tag="p"
        class="m-0 text-sm/tight wrap-break-word text-muted-foreground"
      >
        <template #github>
          <Button
            variant="textonly"
            size="unset"
            class="inline text-sm whitespace-nowrap text-inherit underline"
            @click="openGitHubIssues"
          >
            {{ t('rightSidePanel.errorHelpGithub') }}
          </Button>
        </template>
        <template #support>
          <Button
            variant="textonly"
            size="unset"
            class="inline text-sm whitespace-nowrap text-inherit underline"
            @click="contactSupport"
          >
            {{ t('rightSidePanel.errorHelpSupport') }}
          </Button>
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { isCloud, isDesktop, isNightly } from '@/platform/distribution/types'
import { useAskAgentAboutIssues } from '@/workbench/extensions/agent/composables/agent/useAskAgentAboutIssues'

import ErrorGroupList from './ErrorGroupList.vue'
import { buildAllErrorContext } from './buildAgentErrorContext'
import { useErrorActions } from './useErrorActions'
import { useErrorGroups } from './useErrorGroups'

const ErrorPanelSurveyCta =
  isNightly && !isCloud && !isDesktop
    ? defineAsyncComponent(
        () => import('@/platform/surveys/ErrorPanelSurveyCta.vue')
      )
    : undefined

const { t } = useI18n()
const { openGitHubIssues, contactSupport } = useErrorActions()

const { canAskAgent, askAgentAboutIssues } = useAskAgentAboutIssues()
const {
  allErrorGroups,
  missingPackGroups,
  swapNodeGroups,
  missingModelGroups,
  missingMediaGroups
} = useErrorGroups('')

function askAgentAboutAll() {
  askAgentAboutIssues(
    buildAllErrorContext(
      allErrorGroups.value,
      {
        missingPackGroups: missingPackGroups.value,
        swapNodeGroups: swapNodeGroups.value,
        missingModelGroups: missingModelGroups.value,
        missingMediaGroups: missingMediaGroups.value
      },
      { label: t('agent.errorContext.allLabel') }
    )
  )
}
</script>
