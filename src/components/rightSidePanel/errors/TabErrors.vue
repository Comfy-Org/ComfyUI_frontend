<template>
  <div class="flex h-full min-w-0 flex-col">
    <ErrorGroupList class="min-h-0 flex-1" />

    <ErrorPanelSurveyCta v-if="ErrorPanelSurveyCta" />

    <!-- Fixed Footer: Help Links -->
    <div
      class="min-w-0 shrink-0 border-t border-interface-stroke bg-interface-panel-surface p-4"
    >
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

import ErrorGroupList from './ErrorGroupList.vue'
import { useErrorActions } from './useErrorActions'

const ErrorPanelSurveyCta =
  isNightly && !isCloud && !isDesktop
    ? defineAsyncComponent(
        () => import('@/platform/surveys/ErrorPanelSurveyCta.vue')
      )
    : undefined

const { t } = useI18n()
const { openGitHubIssues, contactSupport } = useErrorActions()
</script>
