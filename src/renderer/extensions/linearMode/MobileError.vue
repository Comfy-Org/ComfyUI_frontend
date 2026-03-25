<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Dialogue from '@/components/common/Dialogue.vue'
import { useErrorGroups } from '@/components/rightSidePanel/errors/useErrorGroups'
import Button from '@/components/ui/button/Button.vue'
import { useAppMode } from '@/composables/useAppMode'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useExternalLink } from '@/composables/useExternalLink'
import { buildSupportUrl } from '@/platform/support/config'
import { useAppModeStore } from '@/stores/appModeStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

defineEmits<{ navigateControls: [] }>()

const { t } = useI18n()
const appModeStore = useAppModeStore()
const { setMode } = useAppMode()
const executionErrorStore = useExecutionErrorStore()
const { buildDocsUrl, staticUrls } = useExternalLink()
const { allErrorGroups } = useErrorGroups('', t)
const { copyToClipboard } = useCopyToClipboard()

const guideUrl = buildDocsUrl('troubleshooting/overview', {
  includeLocale: true
})
const supportUrl = buildSupportUrl()

const inputNodeIds = computed(() => {
  const ids = new Set()
  for (const [id] of appModeStore.selectedInputs) ids.add(String(id))
  return ids
})

const accessibleNodeErrors = computed(() =>
  Object.keys(executionErrorStore.lastNodeErrors ?? {}).filter((k) =>
    inputNodeIds.value.has(k)
  )
)
const accessibleErrors = computed(() =>
  accessibleNodeErrors.value.flatMap((k) =>
    executionErrorStore.lastNodeErrors![k].errors.flatMap((error) => {
      const { extra_info } = error
      if (!extra_info) return []

      const selectedInput = appModeStore.selectedInputs.find(
        ([id, name]) => id == k && extra_info.input_name === name
      )
      if (!selectedInput) return []

      return [`${selectedInput[1]}: ${error.message}`]
    })
  )
)
const allErrors = computed(() =>
  allErrorGroups.value.flatMap((group) => {
    if (group.type !== 'execution') return [group.title]

    return group.cards.flatMap((c) =>
      c.errors.map((e) =>
        e.details
          ? `${c.title} (${e.details}): ${e.message}`
          : `${c.title}: ${e.message}`
      )
    )
  })
)

function copy(obj: unknown) {
  copyToClipboard(JSON.stringify(obj))
}
</script>
<template>
  <section class="flex h-full flex-col items-center justify-center gap-2 px-4">
    <i class="icon-[lucide--circle-alert] size-6 bg-error" />
    {{ t('linearMode.error.header') }}
    <div class="p-1 text-muted-foreground">
      <i18n-t
        v-if="accessibleErrors.length"
        keypath="linearMode.error.mobileFixable"
      >
        <Button @click="$emit('navigateControls')">
          {{ t('linearMode.mobileControls') }}
        </Button>
      </i18n-t>
      <div v-else class="text-center">
        <p v-text="t('linearMode.error.requiresGraph')" />
        <p v-text="t('linearMode.error.promptVisitGraph')" />
        <p class="*:text-muted-foreground">
          <i18n-t keypath="linearMode.error.getHelp">
            <a
              :href="guideUrl"
              target="_blank"
              v-text="t('linearMode.error.guide')"
            />
            <a
              :href="staticUrls.githubIssues"
              target="_blank"
              v-text="t('linearMode.error.github')"
            />
            <a
              :href="supportUrl"
              target="_blank"
              v-text="t('linearMode.error.support')"
            />
          </i18n-t>
        </p>
        <Dialogue :title="t('linearMode.error.log')">
          <template #button>
            <Button variant="textonly">
              {{ t('linearMode.error.promptShow') }}
              <i class="icon-[lucide--chevron-right] size-5" />
            </Button>
          </template>
          <template #default="{ close }">
            <article class="flex flex-col gap-2 p-4">
              <section class="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
                <div
                  v-for="error in allErrors"
                  :key="error"
                  class="w-full rounded-lg bg-secondary-background p-2 text-muted-foreground"
                  v-text="error"
                />
              </section>
              <div class="flex items-center justify-end gap-4">
                <Button variant="muted-textonly" size="lg" @click="close">
                  {{ t('g.close') }}
                </Button>
                <Button size="lg" @click="copy(allErrors)">
                  {{ t('importFailed.copyError') }}
                  <i class="icon-[lucide--copy]" />
                </Button>
              </div>
            </article>
          </template>
        </Dialogue>
      </div>
    </div>
    <div
      v-if="accessibleErrors.length"
      class="my-8 w-full rounded-lg bg-secondary-background text-muted-foreground"
    >
      <ul>
        <li
          v-for="error in accessibleErrors"
          :key="error"
          class="before:content"
          v-text="error"
        />
      </ul>
    </div>
    <div class="flex gap-2">
      <Button
        variant="textonly"
        size="lg"
        @click="executionErrorStore.dismissErrorOverlay()"
      >
        {{ t('g.dismiss') }}
      </Button>
      <Button variant="textonly" size="lg" @click="setMode('graph')">
        {{ t('linearMode.viewGraph') }}
      </Button>
      <Button
        v-if="accessibleErrors.length"
        size="lg"
        @click="copy(accessibleErrors)"
      >
        {{ t('importFailed.copyError') }}
        <i class="icon-[lucide--copy]" />
      </Button>
    </div>
  </section>
</template>
