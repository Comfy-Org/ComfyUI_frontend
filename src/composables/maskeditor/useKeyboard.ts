import { ref } from 'vue'

import { t } from '@/i18n'
import { useKeybinding } from '@/platform/keybindings/useKeybinding'

export function useKeyboard() {
  const isPanning = ref(false)
  useKeybinding({
    id: 'Comfy.MaskEditor.Pan',
    label: () => t('keybindings.maskEditorPan'),
    binding: { combo: { key: ' ' }, dialogKey: 'global-mask-editor' },
    enabled: () => true,
    run: () => {
      isPanning.value = true
    },
    release: () => {
      isPanning.value = false
    }
  })
  return { isPanning }
}
