import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import ContextMenu from './ContextMenu.vue'
import ContextMenuContent from './ContextMenuContent.vue'
import ContextMenuItem from './ContextMenuItem.vue'
import ContextMenuSeparator from './ContextMenuSeparator.vue'
import ContextMenuTrigger from './ContextMenuTrigger.vue'

const TestContextMenu = defineComponent({
  components: {
    ContextMenu,
    ContextMenuTrigger,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator
  },
  setup() {
    const open = ref(false)

    return { open }
  },
  template: `
    <ContextMenu v-model:open="open" :modal="false">
      <ContextMenuTrigger as-child>
        <button type="button">Trigger</button>
      </ContextMenuTrigger>
      <ContextMenuContent close-on-scroll>
        <ContextMenuItem text-value="First item">First item</ContextMenuItem>
        <ContextMenuSeparator />
      </ContextMenuContent>
    </ContextMenu>
  `
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ContextMenu', () => {
  it('closes the content on scroll when close-on-scroll is enabled', async () => {
    const wrapper = mount(TestContextMenu, {
      attachTo: document.body
    })

    await wrapper.find('button').trigger('contextmenu')
    await nextTick()

    expect(wrapper.vm.open).toBe(true)

    window.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(wrapper.vm.open).toBe(false)
  })
})
