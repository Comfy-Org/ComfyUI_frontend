<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AppModeWidgetList from '@/components/builder/AppModeWidgetList.vue'
import Loader from '@/components/loader/Loader.vue'
import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import SubscribeToRunButton from '@/platform/cloud/subscription/components/SubscribeToRun.vue'
import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import { useAppModeStore } from '@/stores/appModeStore'
import { useCommandStore } from '@/stores/commandStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const { isActiveSubscription } = useBillingContext()
const { selectedInputs } = storeToRefs(useAppModeStore())
const { outputs, isWorkflowActive } = useOutputHistory()

const isQueueing = ref(false)
const latestAsset = computed(() => outputs.media.value[0])

async function run() {
  isQueueing.value = true
  try {
    await commandStore.execute('Comfy.QueuePrompt', {
      metadata: { subscribe_to_run: false, trigger_source: 'api_builder' }
    })
  } finally {
    isQueueing.value = false
  }
}
</script>

<template>
  <aside
    class="flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-base-background"
    :aria-label="t('apiBuilder.testTitle')"
  >
    <div class="border-b border-border-subtle p-4">
      <h2 class="m-0 text-base font-semibold">
        {{ t('apiBuilder.testTitle') }}
      </h2>
      <p class="mt-1 mb-0 text-xs text-muted-foreground">
        {{ t('apiBuilder.testDescription') }}
      </p>
    </div>
    <div class="max-h-96 overflow-y-auto p-2">
      <AppModeWidgetList />
      <p
        v-if="!selectedInputs.length"
        class="m-0 p-4 text-center text-sm text-muted-foreground"
      >
        {{ t('apiBuilder.testNoInputs') }}
      </p>
    </div>
    <div class="border-t border-border-subtle p-4">
      <SubscribeToRunButton v-if="!isActiveSubscription" class="w-full" />
      <Button
        v-else
        variant="primary"
        size="lg"
        class="w-full"
        :disabled="isQueueing"
        @click="run"
      >
        <i class="icon-[lucide--play]" aria-hidden="true" />
        {{ t('menu.run') }}
      </Button>
      <div class="mt-4">
        <h3 class="m-0 text-xs font-medium text-muted-foreground uppercase">
          {{ t('apiBuilder.latestResult') }}
        </h3>
        <div
          class="mt-2 flex min-h-40 items-center justify-center overflow-hidden rounded-lg bg-secondary-background"
        >
          <Loader v-if="isWorkflowActive" size="sm" />
          <img
            v-else-if="latestAsset?.preview_url"
            :src="latestAsset.preview_url"
            :alt="latestAsset.name"
            class="max-h-64 w-full object-contain"
          />
          <span
            v-else
            class="p-4 text-center text-xs text-muted-foreground"
            v-text="t('apiBuilder.noResults')"
          />
        </div>
      </div>
    </div>
  </aside>
</template>
