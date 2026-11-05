import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import EssentialsPanel from '@/platform/keybindings/components/shortcuts/EssentialsPanel.vue'
import ViewControlsPanel from '@/platform/keybindings/components/shortcuts/ViewControlsPanel.vue'
import { useShortcutsTab } from '@/platform/keybindings/composables/useShortcutsTab'

describe('useShortcutsTab', () => {
  it('contributes the essentials and view-controls tabs to the shortcuts panel', () => {
    let tabs: ReturnType<typeof useShortcutsTab> = []
    const Wrapper = defineComponent({
      setup() {
        tabs = useShortcutsTab()
        return () => null
      }
    })
    render(Wrapper, {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: enMessages }
          })
        ]
      }
    })

    expect(tabs).toEqual([
      expect.objectContaining({
        id: 'shortcuts-essentials',
        title: 'Essential',
        titleKey: 'shortcuts.essentials',
        component: EssentialsPanel,
        type: 'vue',
        targetPanel: 'shortcuts'
      }),
      expect.objectContaining({
        id: 'shortcuts-view-controls',
        title: 'View Controls',
        titleKey: 'shortcuts.viewControls',
        component: ViewControlsPanel,
        type: 'vue',
        targetPanel: 'shortcuts'
      })
    ])
  })
})
