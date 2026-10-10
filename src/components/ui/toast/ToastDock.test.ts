import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'
import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'

import ToastDock from './ToastDock.vue'

const DockedPopover = defineComponent({
  setup() {
    return { lifted: useModalLiftedZIndex(ref(true)) }
  },
  template: '<div data-testid="popover" :style="lifted" />'
})

describe('ToastDock', () => {
  it('stays above dialogs opened later and lifts its popovers above itself', async () => {
    render({
      components: { DockedPopover, ToastDock },
      template: '<ToastDock data-testid="dock"><DockedPopover /></ToastDock>'
    })
    render({
      directives: { rekaZIndex: vRekaZIndex },
      template: '<div v-reka-z-index data-testid="dialog" />'
    })
    await nextTick()

    const dockZ = Number(screen.getByTestId('dock').style.zIndex)
    expect(dockZ).toBeGreaterThan(
      Number(screen.getByTestId('dialog').style.zIndex)
    )
    expect(Number(screen.getByTestId('popover').style.zIndex)).toBeGreaterThan(
      dockZ
    )
  })
})
