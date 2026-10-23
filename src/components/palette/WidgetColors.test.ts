/* oxlint-disable testing-library/no-node-access, testing-library/no-container, testing-library/prefer-user-event */
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { toNodeId } from '@/types/nodeId'
import { createNodeLocatorId } from '@/types/nodeIdentification'

import WidgetColors from './WidgetColors.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      palette: { swatchTitle: 'Edit', addColor: 'Add' },
      widgetHistory: { undo: 'Undo', redo: 'Redo' }
    }
  }
})

vi.mock(import('@/scripts/app'))

function renderWidget(modelValue: string[], widget?: { name: string }) {
  return render(WidgetColors, {
    props: { modelValue, widget },
    global: { plugins: [i18n] }
  })
}

const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.()
})

describe('WidgetColors', () => {
  it('renders the palette swatch row for each color', () => {
    renderWidget(['#ff0000', '#00ff00'])
    const root = screen.getByTestId('colors')
    expect(root.querySelectorAll('[data-index]')).toHaveLength(2)
  })

  it('shows the widget name as an inline label', () => {
    renderWidget(['#ff0000'], { name: 'color_palette' })
    expect(screen.getByText('color_palette')).toBeInTheDocument()
  })

  it('emits an updated palette when a color is added', async () => {
    const { emitted } = renderWidget([])
    await userEvent.click(screen.getByTitle('Add'))
    const calls = emitted()['update:modelValue'] as unknown[][]
    expect(calls[calls.length - 1][0]).toEqual(['#ffffff'])
  })

  it('does not stop swatch pointer moves from reaching document drag handlers', async () => {
    const { container } = renderWidget(['#ff0000'])
    const onDocMove = vi.fn()
    document.addEventListener('pointermove', onDocMove)
    cleanups.push(() => document.removeEventListener('pointermove', onDocMove))
    await fireEvent.pointerMove(container.querySelector('[data-index="0"]')!)
    expect(onDocMove).toHaveBeenCalled()
  })
})

const SwatchRowStub = defineComponent({
  name: 'PaletteSwatchRow',
  props: { modelValue: { type: Array, default: () => [] } },
  emits: ['update:modelValue', 'editEnd'],
  setup(props, { emit }) {
    const colors = () => props.modelValue as string[]
    const recolorFirst = (hex: string) => {
      emit('update:modelValue', [hex, ...colors().slice(1)])
      emit('editEnd', 'color:0')
    }
    const add = () => {
      emit('update:modelValue', [...colors(), '#ffffff'])
      emit('editEnd')
    }
    return { recolorFirst, add }
  },
  template: `
    <div>
      <button data-testid="recolor-dark" @click="recolorFirst('#111111')" />
      <button data-testid="recolor-darker" @click="recolorFirst('#000000')" />
      <button data-testid="add-swatch" @click="add" />
    </div>
  `
})

function renderWithHistory(initial: string[]) {
  const value = ref(initial)
  const widget = {
    name: 'palette',
    nodeLocatorId: createNodeLocatorId(null, toNodeId('1'))
  }
  const Harness = defineComponent({
    components: { WidgetColors },
    setup: () => ({ value, widget }),
    template: '<WidgetColors v-model="value" :widget="widget" />'
  })
  render(Harness, {
    global: { plugins: [i18n], stubs: { PaletteSwatchRow: SwatchRowStub } }
  })
  return { value, user: userEvent.setup() }
}

describe('WidgetColors node history', () => {
  it('undoes and redoes adding a color', async () => {
    const { value, user } = renderWithHistory(['#ff0000'])
    await user.click(screen.getByTestId('add-swatch'))

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(value.value).toEqual(['#ff0000'])

    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(value.value).toEqual(['#ff0000', '#ffffff'])
  })

  it('undoes consecutive recolors of one swatch as a single step', async () => {
    const { value, user } = renderWithHistory(['#ff0000'])
    await user.click(screen.getByTestId('recolor-dark'))
    await user.click(screen.getByTestId('recolor-darker'))

    await user.click(screen.getByRole('button', { name: 'Undo' }))

    expect(value.value).toEqual(['#ff0000'])
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
  })
})
