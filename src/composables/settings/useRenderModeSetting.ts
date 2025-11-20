import type { ComputedRef } from 'vue'
import { ref, watch } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/schemas/apiSchema'

interface RenderModeSettingConfig<TSettingKey extends keyof Settings> {
  setting: TSettingKey
  vue: Settings[TSettingKey]
  litegraph: Settings[TSettingKey]
}

export function useRenderModeSetting<TSettingKey extends keyof Settings>(
  config: RenderModeSettingConfig<TSettingKey>,
  isVueMode: ComputedRef<boolean>
) {
  const settingStore = useSettingStore()
  const vueValue = ref(config.vue)
  const litegraphValue = ref(config.litegraph)
  const lastWasVue = ref<boolean | null>(null)

  const load = async (vue: boolean) => {
    if (lastWasVue.value === vue) return

    if (lastWasVue.value !== null) {
      const currentValue = settingStore.get(config.setting)
      if (lastWasVue.value) {
        vueValue.value = currentValue
      } else {
        litegraphValue.value = currentValue
      }
    }

    await settingStore.set(
      config.setting,
      vue ? vueValue.value : litegraphValue.value
    )
    lastWasVue.value = vue
  }

  watch(isVueMode, load, { immediate: true })
}
