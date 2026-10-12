import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import InputSettings from './InputSettings.vue'

const property = {
  type: 'number',
  minimum: 0,
  maximum: 10,
  default: 0,
  'x-preserve': { values: ['a', false, 5] }
}
const presentation = {
  control: 'number',
  label: 'Width',
  hidden: false,
  help: 'Keep help',
  advanced: false,
  'x-preserve': { untouched: true }
}
describe('controlled input-settings form', () => {
  it('shows no inherited labels and creates only an explicitly edited label', async () => {
    const definition = {
      control: 'dropdown',
      optionLabels: { unrelated: 'Keep this' }
    }
    const result = render(InputSettings, {
      props: {
        schemaProperty: { enum: ['__proto__', 'constructor'] },
        presentation: definition
      }
    })
    const labels = screen.getAllByRole('textbox', {
      name: 'Display label (optional)'
    })
    expect(labels).toEqual([expect.toHaveValue(''), expect.toHaveValue('')])
    await fireEvent.update(labels[0], 'Explicit label')
    expect(result.emitted().update.at(-1)).toEqual([
      {
        property: { enum: ['__proto__', 'constructor'] },
        presentation: {
          control: 'dropdown',
          optionLabels: Object.fromEntries([
            ['unrelated', 'Keep this'],
            ['__proto__', 'Explicit label']
          ])
        }
      }
    ])
  })
  it('preserves literal special-key option labels instead of sanitizing them away during a copy', async () => {
    const definition = {
      control: 'dropdown',
      optionLabels: Object.fromEntries([
        ['__proto__', 'Special text'],
        ['normal', 'Normal text']
      ])
    }
    const result = render(InputSettings, {
      props: {
        schemaProperty: { enum: ['__proto__', 'normal'] },
        presentation: definition
      }
    })
    expect(
      screen.getAllByRole('textbox', { name: 'Display label (optional)' })[0]
    ).toHaveValue('Special text')
    await fireEvent.update(
      screen.getAllByRole('textbox', { name: 'Display label (optional)' })[1],
      'Changed normal'
    )
    expect(result.emitted().update.at(-1)).toEqual([
      {
        property: { enum: ['__proto__', 'normal'] },
        presentation: {
          control: 'dropdown',
          optionLabels: Object.fromEntries([
            ['__proto__', 'Special text'],
            ['normal', 'Changed normal']
          ])
        }
      }
    ])
  })
  it('retains an invalid option on its row during reorder and freezes it on incompatible external refresh', async () => {
    const definition = { control: 'dropdown' }
    const result = render(InputSettings, {
      props: {
        schemaProperty: { enum: ['low', 'high'] },
        presentation: definition
      }
    })
    await fireEvent.update(
      screen.getAllByRole('textbox', { name: 'Option value' })[0],
      'high'
    )
    expect(result.emitted().update).toBeUndefined()
    await fireEvent.click(
      screen.getAllByRole('button', { name: 'Move option down' })[0]
    )
    expect(
      screen.getAllByRole('textbox', { name: 'Option value' })[1]
    ).toHaveValue('high')
    expect(result.emitted().validity.at(-1)).toEqual([false])
    await result.rerender({ schemaProperty: { enum: ['new'], default: 'new' } })
    expect(
      screen.getAllByRole('textbox', { name: 'Option value' })
    ).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Add option' })).toBeDisabled()
    expect(result.emitted().update).toBeUndefined()
    await fireEvent.click(
      screen.getByRole('button', {
        name: 'Discard buffer and load current settings'
      })
    )
    expect(screen.getByRole('textbox', { name: 'Option value' })).toHaveValue(
      'new'
    )
    expect(screen.getByRole('combobox', { name: 'Default' })).toHaveValue('0')
    expect(result.emitted().update).toBeUndefined()
  })
  it('guards every option mutation while disabled', async () => {
    const result = render(InputSettings, {
      props: {
        schemaProperty: { enum: ['low', 'high'] },
        presentation: { control: 'dropdown' },
        disabled: true
      }
    })
    const add = screen.getByRole('button', { name: 'Add option' })
    const remove = screen.getAllByRole('button', { name: 'Remove option' })[0]
    expect(add).toBeDisabled()
    expect(remove).toBeDisabled()
    await fireEvent.click(add)
    await fireEvent.click(remove)
    await fireEvent.update(
      screen.getAllByRole('textbox', { name: 'Option value' })[0],
      'changed'
    )
    expect(result.emitted().update).toBeUndefined()
  })
  it('edits numeric values with whole-document preservation without mutating props', async () => {
    const result = render(InputSettings, {
      props: { schemaProperty: property, presentation }
    })
    expect(result.emitted().update).toBeUndefined()
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Maximum' }),
      '20'
    )
    expect(result.emitted().update).toEqual([
      [{ property: { ...property, maximum: 20 }, presentation }]
    ])
    expect(property.maximum).toBe(10)
    expect(screen.getByRole('textbox', { name: 'Default' })).toHaveValue('0')
  })
  it('retains incomplete numeric input and exposes invalidity until repaired', async () => {
    const result = render(InputSettings, {
      props: { schemaProperty: property, presentation }
    })
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Maximum' }),
      '1e'
    )
    expect(screen.getByRole('textbox', { name: 'Maximum' })).toHaveValue('1e')
    expect(screen.getByRole('alert')).toBeVisible()
    expect(result.emitted().update).toBeUndefined()
    expect(result.emitted().validity.at(-1)).toEqual([false])
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Maximum' }),
      '20'
    )
    expect(result.emitted().validity.at(-1)).toEqual([true])
    expect(result.emitted().update).toHaveLength(1)
  })
  it('retains invalid buffers on concurrent refresh and requires explicit discard before emitting newer settings', async () => {
    const result = render(InputSettings, {
      props: { schemaProperty: property, presentation }
    })
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Maximum' }),
      '-'
    )
    await result.rerender({
      schemaProperty: { ...property, maximum: 50, 'x-new': { keep: true } }
    })
    expect(screen.getByRole('textbox', { name: 'Maximum' })).toHaveValue('-')
    expect(screen.getByRole('textbox', { name: 'Minimum' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'These settings changed'
    )
    expect(result.emitted().update).toBeUndefined()
    await fireEvent.click(
      screen.getByRole('button', {
        name: 'Discard buffer and load current settings'
      })
    )
    expect(screen.getByRole('textbox', { name: 'Maximum' })).toHaveValue('50')
    expect(screen.getByRole('textbox', { name: 'Minimum' })).toBeEnabled()
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Minimum' }),
      '-1'
    )
    expect(result.emitted().update).toEqual([
      [
        {
          property: {
            ...property,
            maximum: 50,
            minimum: -1,
            'x-new': { keep: true }
          },
          presentation
        }
      ]
    ])
  })
  it('accepts confirmation of its earlier update while retaining a newer invalid buffer', async () => {
    const result = render(InputSettings, {
      props: { schemaProperty: property, presentation }
    })
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Maximum' }),
      '20'
    )
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Minimum' }),
      '-'
    )
    await result.rerender({ schemaProperty: { ...property, maximum: 20 } })
    expect(screen.getByRole('textbox', { name: 'Minimum' })).toHaveValue('-')
    expect(
      screen.queryByRole('button', {
        name: 'Discard buffer and load current settings'
      })
    ).not.toBeInTheDocument()
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Minimum' }),
      '-1'
    )
    expect(result.emitted().update.at(-1)).toEqual([
      { property: { ...property, maximum: 20, minimum: -1 }, presentation }
    ])
  })
  it('never emits structured modifications for unsupported composed schemas', () => {
    const result = render(InputSettings, {
      props: {
        schemaProperty: { ...property, allOf: [{ maximum: 5 }] },
        presentation
      }
    })
    expect(screen.getByText(/these controls cannot safely edit/)).toBeVisible()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(result.emitted().update).toBeUndefined()
  })
  it('keeps disabled controls and event guards effective', async () => {
    const result = render(InputSettings, {
      props: { schemaProperty: property, presentation, disabled: true }
    })
    expect(screen.getByRole('textbox', { name: 'Maximum' })).toBeDisabled()
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Maximum' }),
      '20'
    )
    expect(result.emitted().update).toBeUndefined()
  })
  it('reorders typed options, updates labels and preserves exact defaults and unknown fields', async () => {
    const options = {
      enum: [false, 0, 'high'],
      default: false,
      'x-schema': { keep: true }
    }
    const definition = {
      ...presentation,
      control: 'dropdown',
      optionLabels: { false: 'Off', '0': 'Zero', high: 'High' }
    }
    const result = render(InputSettings, {
      props: { schemaProperty: options, presentation: definition }
    })
    await fireEvent.click(
      screen.getAllByRole('button', { name: 'Move option down' })[0]
    )
    expect(result.emitted().update.at(-1)).toEqual([
      {
        property: { ...options, enum: [0, false, 'high'] },
        presentation: definition
      }
    ])
    await fireEvent.update(
      screen.getAllByRole('textbox', { name: 'Display label (optional)' })[0],
      'Exactly zero'
    )
    expect(result.emitted().update.at(-1)).toEqual([
      {
        property: { ...options, enum: [0, false, 'high'] },
        presentation: {
          ...definition,
          optionLabels: { false: 'Off', '0': 'Exactly zero', high: 'High' }
        }
      }
    ])
    await fireEvent.update(
      screen.getByRole('combobox', { name: 'Default' }),
      '2'
    )
    expect(result.emitted().update.at(-1)).toEqual([
      {
        property: { ...options, enum: [0, false, 'high'], default: 'high' },
        presentation: {
          ...definition,
          optionLabels: { false: 'Off', '0': 'Exactly zero', high: 'High' }
        }
      }
    ])
  })
  it('does not silently delete a default when removing its dropdown option', async () => {
    const result = render(InputSettings, {
      props: {
        schemaProperty: { enum: ['low', 'high'], default: 'high' },
        presentation: { control: 'dropdown' }
      }
    })
    await fireEvent.click(
      screen.getAllByRole('button', { name: 'Remove option' })[1]
    )
    expect(result.emitted().update).toBeUndefined()
    expect(result.emitted().validity.at(-1)).toEqual([false])
    await fireEvent.update(
      screen.getByRole('combobox', { name: 'Default' }),
      ''
    )
    expect(result.emitted().update.at(-1)).toEqual([
      { property: { enum: ['low'] }, presentation: { control: 'dropdown' } }
    ])
  })
  it('localizes structured labels without changing the underlying JSON fields', async () => {
    const result = render(InputSettings, {
      props: { schemaProperty: property, presentation, locale: 'zh-CN' }
    })
    await fireEvent.update(
      screen.getByRole('textbox', { name: '最大值' }),
      '20'
    )
    expect(result.emitted().update).toEqual([
      [{ property: { ...property, maximum: 20 }, presentation }]
    ])
  })
})
