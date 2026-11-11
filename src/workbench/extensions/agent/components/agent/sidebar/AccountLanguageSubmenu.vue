<script setup lang="ts">
import { DropdownMenuItemIndicator, DropdownMenuRadioGroup } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import MenuRadioItem from '@comfyorg/design-system/menu/MenuRadioItem'
import MenuSub from '@comfyorg/design-system/menu/MenuSub'
import MenuSubContent from '@comfyorg/design-system/menu/MenuSubContent'
import MenuSubTrigger from '@comfyorg/design-system/menu/MenuSubTrigger'
import { SUPPORTED_LOCALE_OPTIONS } from '@/locales/localeConfig'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@comfyorg/telemetry/reportError'

import { trackAccountMenu } from './trackAccountMenu'

const { t } = useI18n()
const settingStore = useSettingStore()

const currentLocale = computed(() => settingStore.get('Comfy.Locale'))

function onSelectLocale(locale: string): void {
  if (locale === currentLocale.value) return
  trackAccountMenu('agent_account_menu_language_changed')
  void settingStore.set('Comfy.Locale', locale).catch((error: unknown) => {
    reportError(error, {
      surface: 'agent',
      errorType: 'error_saving_agent_account_language'
    })
  })
}
</script>

<template>
  <MenuSub>
    <MenuSubTrigger class="data-[state=open]:bg-accent">
      <i aria-hidden="true" class="icon-[lucide--languages]" />
      <span class="min-w-0 flex-1 truncate">
        {{ t('agent.account.language') }}
      </span>
      <i
        aria-hidden="true"
        class="icon-[lucide--chevron-right] text-muted-foreground"
      />
    </MenuSubTrigger>
    <MenuSubContent :side-offset="4" class="agent-scope max-h-80 min-w-44">
      <DropdownMenuRadioGroup
        :model-value="currentLocale"
        :aria-label="t('agent.account.language')"
        @update:model-value="
          typeof $event === 'string' && onSelectLocale($event)
        "
      >
        <MenuRadioItem
          v-for="option in SUPPORTED_LOCALE_OPTIONS"
          :key="option.value"
          :value="option.value"
          :lang="option.value"
        >
          <span class="min-w-0 flex-1 truncate">{{ option.text }}</span>
          <DropdownMenuItemIndicator class="flex shrink-0">
            <i aria-hidden="true" class="icon-[lucide--check]" />
          </DropdownMenuItemIndicator>
        </MenuRadioItem>
      </DropdownMenuRadioGroup>
    </MenuSubContent>
  </MenuSub>
</template>
