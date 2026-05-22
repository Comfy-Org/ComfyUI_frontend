<template>
  <NotificationPopup
    v-if="appModeStore.showVueNodeSwitchPopup"
    data-testid="linear-vue-node-switch-popup"
    :title="$t('appBuilder.vueNodeSwitch.title')"
    show-close
    position="bottom-left"
    @close="dismiss"
  >
    {{ $t('appBuilder.vueNodeSwitch.content') }}

    <template #footer-start>
      <label
        class="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"
      >
        <input
          v-model="dontShowAgain"
          type="checkbox"
          data-testid="linear-vue-node-switch-dont-show-again"
          class="accent-primary-background"
        />
        {{ $t('appBuilder.vueNodeSwitch.dontShowAgain') }}
      </label>
    </template>

    <template #footer-end>
      <Button
        variant="secondary"
        size="lg"
        data-testid="linear-vue-node-switch-dismiss"
        class="font-normal"
        @click="dismiss"
      >
        {{ $t('appBuilder.vueNodeSwitch.dismiss') }}
      </Button>
    </template>
  </NotificationPopup>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import NotificationPopup from '@/components/common/NotificationPopup.vue'
import Button from '@/components/ui/button/Button.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useAppModeStore } from '@/stores/appModeStore'

const appModeStore = useAppModeStore()
const settingStore = useSettingStore()
const dontShowAgain = ref(false)

function dismiss() {
  if (dontShowAgain.value) {
    void settingStore.set('Comfy.AppBuilder.VueNodeSwitchDismissed', true)
  }
  appModeStore.showVueNodeSwitchPopup = false
}
</script>
