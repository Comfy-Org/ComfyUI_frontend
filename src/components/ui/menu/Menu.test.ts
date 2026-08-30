import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import Menu from './Menu.vue'
import ContextMenu from './ContextMenu.vue'

describe('Menu', () => {
  it('opens, runs a command, and dismisses with Escape', async () => {
    const command = vi.fn()
    render(
      defineComponent({
        components: { Menu },
        setup() {
          const menu = ref<InstanceType<typeof Menu>>()
          return { command, menu }
        },
        template:
          '<button @click="menu?.show($event)">Open</button><Menu ref="menu" :model="[{ label: \'Run\', command }]" />'
      })
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Run' }))
    expect(command).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Open' }))
    await screen.findByRole('menu')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens a context menu at the pointer and dismisses outside', async () => {
    render(
      defineComponent({
        components: { ContextMenu },
        setup() {
          const menu = ref<InstanceType<typeof ContextMenu>>()
          return { menu }
        },
        template:
          '<button @contextmenu.prevent="menu?.show($event)">Target</button><button>Outside</button><ContextMenu ref="menu" :model="[{ label: \'Inspect\' }]" />'
      })
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Target' })
    })
    expect(
      await screen.findByRole('menuitem', { name: 'Inspect' })
    ).toBeVisible()

    await user.pointer({
      keys: '[MouseLeft>]',
      target: screen.getByRole('button', { name: 'Outside', hidden: true })
    })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
