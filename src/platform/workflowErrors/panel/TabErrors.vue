<template>
  <div class="flex h-full min-w-0 flex-col">
    <ErrorGroupList
      :selected-items
      class="min-h-0 flex-1"
      @locate-node="(nodeId, nodeMap) => emit('locateNode', nodeId, nodeMap)"
    />

    <ErrorPanelSurveyCta v-if="ErrorPanelSurveyCta" />

    <!-- Fixed Footer: Help Links -->
    <div class="min-w-0 shrink-0 border-t bg-background p-4">
      <i18n-t
        keypath="rightSidePanel.errorHelp"
        tag="p"
        class="m-0 text-sm/tight wrap-break-word text-muted-foreground"
      >
        <template #github>
          <Button
            variant="textonly"
            size="unset"
            class="inline text-inherit underline"
            @click="openGitHubIssues"
          >
            {{ t('rightSidePanel.errorHelpGithub') }}
          </Button>
        </template>
        <template #support>
          <Button
            variant="textonly"
            size="unset"
            class="inline text-inherit underline"
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
import type { Positionable } from '@comfyorg/graph-model/interfaces'

import Button from '@comfyorg/design-system/button/Button'
import { isCloud, isDesktop, isNightly } from '@/platform/distribution/types'
import type { LGraphNode } from '@comfyorg/litegraph/litegraph'

import ErrorGroupList from './ErrorGroupList.vue'
import { useErrorActions } from './useErrorActions'

const { selectedItems = [] } = defineProps<{
  selectedItems?: readonly Positionable[]
}>()

const emit = defineEmits<{
  locateNode: [nodeId: string, executionIdMap?: Map<string, LGraphNode>]
}>()

const ErrorPanelSurveyCta =
  isNightly && !isCloud && !isDesktop
    ? defineAsyncComponent(
        () => import('@/platform/surveys/ErrorPanelSurveyCta.vue')
      )
    : undefined

const { t } = useI18n()
const { openGitHubIssues, contactSupport } = useErrorActions()
</script>
