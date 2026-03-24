import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import DropdownMenu from './DropdownMenu.vue'
import DropdownMenuContent from './DropdownMenuContent.vue'
import DropdownMenuItem from './DropdownMenuItem.vue'
import DropdownMenuSeparator from './DropdownMenuSeparator.vue'
import DropdownMenuTrigger from './DropdownMenuTrigger.vue'

const TestDropdownMenu = defineComponent({
  components: {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator
  },
  setup() {
    const open = ref(false)

    return { open }
  },
  template: `
    <DropdownMenu v-model:open="open">
      <DropdownMenuTrigger as-child>
        <button type="button">Trigger</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent close-on-scroll>
        <DropdownMenuItem text-value="First item">First item</DropdownMenuItem>
        <DropdownMenuSeparator />
      </DropdownMenuContent>
    </DropdownMenu>
  `
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DropdownMenu', () => {
  it('closes the content on scroll when close-on-scroll is enabled', async () => {
    const wrapper = mount(TestDropdownMenu, {
      attachTo: document.body
    })

    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(wrapper.vm.open).toBe(true)

    window.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(wrapper.vm.open).toBe(false)
  })
})
