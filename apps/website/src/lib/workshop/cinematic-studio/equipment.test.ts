import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, h, ref } from 'vue'
import { expect, it } from 'vitest'
import CinematicEquipmentPicker from '../../../components/workshop/cinematic-studio/CinematicEquipmentPicker.vue'
import CinematicPicker from '../../../components/workshop/cinematic-studio/CinematicPicker.vue'
import { AUTO_DIRECTION, cameraGroups } from './catalog'
import { tc } from './copy'

it.for(cameraGroups)(
  'browses every $part choice with arrows, direct selection and keyboard',
  async (group) => {
    const user = userEvent.setup()
    const selected = ref('auto')
    render(
      defineComponent({
        setup: () => () =>
          h(CinematicEquipmentPicker, {
            group,
            selected: selected.value,
            onChoose: (id: string) => {
              selected.value = id
            }
          })
      })
    )
    const title = tc(group.title, 'en')
    const radios = within(screen.getByRole('radiogroup', { name: title }))
    const previous = screen.getByRole('button', { name: `Previous ${title}` })
    const next = screen.getByRole('button', { name: `Next ${title}` })
    expect(previous).toBeDisabled()
    await user.click(next)
    expect(selected.value).toBe(group.options[1].id)
    await user.click(previous)
    expect(selected.value).toBe('auto')
    const last = group.options.at(-1)!
    await user.click(radios.getByRole('radio', { name: tc(last.label, 'en') }))
    expect(next).toBeDisabled()
    await user.keyboard('{Home}')
    expect(radios.getByRole('radio', { name: 'Auto' })).toHaveFocus()
    expect(selected.value).toBe('auto')
    await user.keyboard('{ArrowRight}')
    expect(selected.value).toBe(group.options[1].id)
    expect(
      radios.getByRole('radio', { name: tc(group.options[1].label, 'en') })
    ).toHaveFocus()
    await user.keyboard('{End}{ArrowRight}')
    expect(selected.value).toBe(last.id)
    expect(
      radios.getAllByRole('radio').filter((radio) => radio.tabIndex === 0)
    ).toHaveLength(1)
  }
)

it('keeps the picker open for independent equipment choices until Done', async () => {
  const user = userEvent.setup()
  const view = render(CinematicPicker, {
    props: { groups: cameraGroups, direction: AUTO_DIRECTION, title: 'Camera' }
  })
  const lens = within(
    screen.getByRole('radiogroup', { name: tc('cinematic.camera.lens', 'en') })
  )
  const choice = cameraGroups[1].options[2]
  await user.click(lens.getByRole('radio', { name: tc(choice.label, 'en') }))
  expect(view.emitted('choose')[0]).toEqual(['lens', choice.id])
  expect(view.emitted('close')).toBeUndefined()
  await user.click(screen.getByRole('button', { name: 'Done' }))
  expect(view.emitted('close')).toHaveLength(1)
})
