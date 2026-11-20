import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { SettingDef } from '@/platform/nodeApi/v4/types'
import { useSettingStore } from '@/platform/settings/settingStore'

function settingsApi() {
  return createComfyApi({ getGraph: () => null }).comfy.settings
}

const sizeSetting: SettingDef = {
  id: 'MyPack.size',
  name: 'Size',
  type: 'slider',
  defaultValue: 4,
  tooltip: 'How big',
  category: ['MyPack', 'Look'],
  attrs: { min: 1, max: 9, step: 0.5 }
}

const INHERITED_IDS = ['__proto__', 'constructor', 'toString', 'hasOwnProperty']

function savedRequests() {
  return vi
    .mocked(fetch)
    .mock.calls.map(([input, init]) => [String(input), init?.body])
}

beforeEach(() => {
  vi.mocked(fetch).mockImplementation(async () => new Response('{}'))
})

describe('declaring a setting', () => {
  it('adds it to the settings panel in the host shape', () => {
    settingsApi().declare({
      id: 'MyPack.mode',
      name: 'Mode',
      type: 'combo',
      defaultValue: 1,
      options: ['plain', { value: 1, label: 'Fancy' }]
    })
    settingsApi().declare(sizeSetting)

    const { settingsById } = useSettingStore()
    expect(settingsById['MyPack.mode']).toMatchObject({
      name: 'Mode',
      type: 'combo',
      defaultValue: 1,
      options: ['plain', { value: 1, text: 'Fancy' }]
    })
    expect(settingsById['MyPack.size']).toMatchObject({
      tooltip: 'How big',
      category: ['MyPack', 'Look'],
      attrs: { min: 1, max: 9, step: 0.5 }
    })
    expect(settingsApi().get('MyPack.size')).toBe(4)
  })

  it('passes on only the range bounds a pack gave', () => {
    settingsApi().declare({ ...sizeSetting, attrs: { max: 3 } })

    expect(useSettingStore().settingsById['MyPack.size'].attrs).toEqual({
      max: 3
    })
  })

  it('takes a boolean default for a boolean setting, and refuses text', () => {
    const settings = settingsApi()
    const toggle: SettingDef = {
      id: 'MyPack.on',
      name: 'On',
      type: 'boolean',
      defaultValue: true
    }

    settings.declare(toggle)

    expect(settings.get('MyPack.on')).toBe(true)
    expect(() =>
      settings.declare({ ...toggle, id: 'MyPack.off', defaultValue: 'yes' })
    ).toThrow(
      new TypeError(
        "settings.declare needs defaultValue as a value a boolean setting holds, not 'yes'."
      )
    )
  })

  it('refuses a category list with a hole in it', () => {
    const holed = ['MyPack']
    holed.length = 2
    const settings = settingsApi()

    expect(() => settings.declare({ ...sizeSetting, category: holed })).toThrow(
      expect.objectContaining({
        message: expect.stringContaining(
          'settings.declare needs category as a list of strings, not '
        )
      })
    )
  })

  it('keeps the value the user stored under its id', async () => {
    await settingsApi().set('MyPack.size', 7)

    settingsApi().declare(sizeSetting)

    expect(settingsApi().get('MyPack.size')).toBe(7)
  })

  it.for(['constructor', 'toString', '__proto__'])(
    'refuses the id %s, which every object inherits',
    (id) => {
      expect(() => settingsApi().declare({ ...sizeSetting, id })).toThrow(
        new TypeError(
          `settings.declare needs id as a non-empty string no object inherits, not '${id}'.`
        )
      )
      expect(Object.hasOwn(useSettingStore().settingsById, id)).toBe(false)
    }
  )

  it('refuses an id another setting has, and keeps the first', () => {
    const settings = settingsApi()
    settings.declare(sizeSetting)

    expect(() =>
      settings.declare({ ...sizeSetting, name: 'Second', defaultValue: 2 })
    ).toThrow(
      new TypeError(
        "settings.declare needs an id no other setting has, not 'MyPack.size'."
      )
    )
    expect(useSettingStore().settingsById['MyPack.size'].name).toBe('Size')
  })

  it.for([
    {
      name: 'no definition',
      setting: undefined,
      needs: 'a setting definition as a plain object'
    },
    {
      name: 'a definition that inherits its fields',
      setting: Object.create(sizeSetting),
      needs: 'a setting definition as a plain object'
    },
    {
      name: 'a field a setting does not have',
      setting: { ...sizeSetting, defaultvalue: 4 },
      needs:
        'a setting definition of id, name, type, defaultValue, tooltip, category, options, attrs, onChange only'
    },
    {
      name: 'an empty id',
      setting: { ...sizeSetting, id: ' ' },
      needs: 'id as a non-empty string no object inherits'
    },
    {
      name: 'a numeric name',
      setting: { ...sizeSetting, name: 3 },
      needs: 'name as a string'
    },
    {
      name: 'a type the panel lacks',
      setting: { ...sizeSetting, type: 'knob' },
      needs: 'type as one of boolean, number, slider, combo, text, color'
    },
    {
      name: 'a type named like a prototype key',
      setting: { ...sizeSetting, type: 'toString' },
      needs: 'type as one of boolean, number, slider, combo, text, color'
    },
    {
      name: 'a default of another type',
      setting: { ...sizeSetting, defaultValue: '4' },
      needs: 'defaultValue as a value a slider setting holds'
    },
    {
      name: 'a default that is not finite',
      setting: { ...sizeSetting, defaultValue: Number.NaN },
      needs: 'defaultValue as a value a slider setting holds'
    },
    {
      name: 'a boolean default for a combo',
      setting: { ...sizeSetting, type: 'combo', defaultValue: true },
      needs: 'defaultValue as a value a combo setting holds'
    },
    {
      name: 'a numeric tooltip',
      setting: { ...sizeSetting, tooltip: 1 },
      needs: 'tooltip as a string'
    },
    {
      name: 'a category of numbers',
      setting: { ...sizeSetting, category: [1] },
      needs: 'category as a list of strings'
    },
    {
      name: 'options that are not a list',
      setting: { ...sizeSetting, options: 'a,b' },
      needs: 'options as a list'
    },
    {
      name: 'an option without a label',
      setting: { ...sizeSetting, options: ['a', { value: 1 }] },
      needs: 'options[1].label as a string'
    },
    {
      name: 'an option of the wrong kind',
      setting: { ...sizeSetting, options: [5] },
      needs: 'options[0] as a plain object'
    },
    {
      name: 'an option with the host spelling of its label',
      setting: { ...sizeSetting, options: [{ value: 1, text: 'One' }] },
      needs: 'options[0] of value, label only'
    },
    {
      name: 'an option value that is not finite',
      setting: { ...sizeSetting, options: [{ value: Infinity, label: 'x' }] },
      needs: 'options[0].value as a string or finite number'
    },
    {
      name: 'attrs that are not an object',
      setting: { ...sizeSetting, attrs: 5 },
      needs: 'attrs as an object'
    },
    {
      name: 'a range bound that is not finite',
      setting: { ...sizeSetting, attrs: { min: -Infinity } },
      needs: 'attrs.min as a finite number'
    },
    {
      name: 'a step given as text',
      setting: { ...sizeSetting, attrs: { step: '1' } },
      needs: 'attrs.step as a finite number'
    },
    {
      name: 'a range field attrs do not have',
      setting: { ...sizeSetting, attrs: { min: 0, maximum: 9 } },
      needs: 'attrs of min, max, step only'
    },
    {
      name: 'attrs made by a class',
      setting: { ...sizeSetting, attrs: new Map([['min', 0]]) },
      needs: 'attrs as a plain object'
    },
    {
      name: 'an onChange that is not a function',
      setting: { ...sizeSetting, onChange: 'reload' },
      needs: 'onChange as a function'
    }
  ])('refuses $name, and adds nothing', ({ setting, needs }) => {
    const settings = settingsApi()

    expect(() => Reflect.apply(settings.declare, settings, [setting])).toThrow(
      expect.objectContaining({
        name: 'TypeError',
        message: expect.stringContaining(
          `settings.declare needs ${needs}, not `
        )
      })
    )
    expect(Object.keys(useSettingStore().settingsById)).toEqual([])
  })

  it('calls its onChange with frozen copies when declared and after each change', async () => {
    const onChange = vi.fn()
    const settings = settingsApi()
    settings.declare({
      id: 'MyPack.tags',
      name: 'Tags',
      type: 'text',
      defaultValue: 'a',
      onChange
    })

    await settings.set('MyPack.tags', ['b', 'c'])

    expect(onChange.mock.calls).toEqual([
      ['a', undefined],
      [['b', 'c'], 'a']
    ])
    const [delivered] = onChange.mock.calls[1]
    expect(Object.isFrozen(delivered)).toBe(true)
    expect(settings.get('MyPack.tags')).toEqual(['b', 'c'])
  })

  it('reports an onChange that throws, and still saves the value', async () => {
    const broken = new Error('pack onChange failed')
    const settings = settingsApi()
    settings.declare({
      ...sizeSetting,
      onChange: (value) => {
        if (value === 5) throw broken
      }
    })

    await settings.set('MyPack.size', 5)

    expect(settings.get('MyPack.size')).toBe(5)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      broken,
      expect.objectContaining({ tags: { event: 'settings.declare' } })
    )
    expect(savedRequests()).toEqual([
      [expect.stringContaining('/settings/MyPack.size'), '5']
    ])
  })
})

describe('reading a setting', () => {
  it('reads a core setting, and gives undefined for an id nobody declared', () => {
    useSettingStore().settingValues = { 'Comfy.Locale': 'fr' }

    expect(settingsApi().get('Comfy.Locale')).toBe('fr')
    expect(settingsApi().get('MyPack.unknown')).toBeUndefined()
  })

  it('gives a frozen copy that cannot change the stored value', async () => {
    await settingsApi().set('MyPack.history', { recent: ['a'] })

    const read = settingsApi().get('MyPack.history')

    expect(Object.isFrozen(read)).toBe(true)
    expect(Reflect.set(Object(read), 'recent', ['changed'])).toBe(false)
    expect(settingsApi().get('MyPack.history')).toEqual({ recent: ['a'] })
    expect(settingsApi().get('MyPack.history')).not.toBe(read)
  })

  it('gives undefined for a stored value JSON could not hold', () => {
    Object.assign(useSettingStore().settingValues, {
      'MyPack.odd': { when: new Date(0) }
    })

    expect(settingsApi().get('MyPack.odd')).toBeUndefined()
  })

  it.for([undefined, '', 3])('refuses %j as an id', (id) => {
    const settings = settingsApi()

    expect(() => Reflect.apply(settings.get, settings, [id])).toThrow(TypeError)
  })

  it.for(INHERITED_IDS)('refuses %s, an id every object inherits', (id) => {
    expect(() => settingsApi().get(id)).toThrow(
      new TypeError(
        `settings.get needs a setting id no object inherits, not '${id}'.`
      )
    )
  })
})

describe('changing a setting', () => {
  it('applies the value at once and saves it on the server', async () => {
    const settings = settingsApi()
    settings.declare(sizeSetting)

    const saved = settings.set('MyPack.size', 6)

    expect(settings.get('MyPack.size')).toBe(6)
    await saved
    expect(savedRequests()).toEqual([
      [expect.stringContaining('/settings/MyPack.size'), '6']
    ])
  })

  it('saves nested values', async () => {
    const value = { list: [1, 'two', null, { deep: true }] }

    await settingsApi().set('MyPack.nested', value)

    expect(settingsApi().get('MyPack.nested')).toEqual(value)
  })

  it.for([
    { name: 'a value that is not finite', value: Number.NaN },
    { name: 'a function', value: () => 1 },
    { name: 'undefined', value: undefined },
    { name: 'an object of a class', value: new Date(0) },
    { name: 'a list holding a function', value: [() => 1] },
    { name: 'a value that holds itself', value: cyclicValue() }
  ])('refuses $name, and changes nothing', ({ value }) => {
    const settings = settingsApi()
    settings.declare(sizeSetting)

    expect(() =>
      Reflect.apply(settings.set, settings, ['MyPack.size', value])
    ).toThrow(
      expect.objectContaining({
        message: expect.stringContaining('settings.set needs value')
      })
    )
    expect(settings.get('MyPack.size')).toBe(4)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('accepts a value held twice in one object, which is not a cycle', async () => {
    const shared = ['x']

    await settingsApi().set('MyPack.twice', { a: shared, b: shared })

    expect(settingsApi().get('MyPack.twice')).toEqual({ a: ['x'], b: ['x'] })
  })

  it('refuses an id that is not a string', () => {
    const settings = settingsApi()

    expect(() => Reflect.apply(settings.set, settings, [5, 1])).toThrow(
      new TypeError(
        'settings.set needs a setting id no object inherits, not 5.'
      )
    )
  })

  it.for(INHERITED_IDS)(
    'refuses %s, an id every object inherits, and leaves the store and the server as they were',
    (id) => {
      const settings = settingsApi()
      const values = useSettingStore().settingValues
      const prototype = Object.getPrototypeOf(values)

      expect(() => settings.set(id, { 'MyPack.unset': 'changed' })).toThrow(
        new TypeError(
          `settings.set needs a setting id no object inherits, not '${id}'.`
        )
      )
      expect(Object.getPrototypeOf(values)).toBe(prototype)
      expect(Object.hasOwn(values, id)).toBe(false)
      expect(settings.get('MyPack.unset')).toBeUndefined()
      expect(savedRequests()).toEqual([])
    }
  )
})

describe('watching a setting', () => {
  it('calls the listener with the new and previous value after the setting changes', async () => {
    const settings = settingsApi()
    settings.declare(sizeSetting)
    const listener = vi.fn()
    settings.onChange('MyPack.size', listener)

    await settings.set('MyPack.size', 8)

    expect(listener).toHaveBeenCalledExactlyOnceWith(8, 4)
  })

  it('calls the listener when a watched setting is declared', () => {
    const settings = settingsApi()
    const listener = vi.fn()
    settings.onChange('MyPack.size', listener)

    settings.declare(sizeSetting)

    expect(listener).toHaveBeenCalledExactlyOnceWith(4, undefined)
  })

  it('hears only the setting it watches', async () => {
    const settings = settingsApi()
    settings.declare(sizeSetting)
    settings.declare({ ...sizeSetting, id: 'MyPack.other' })
    const listener = vi.fn()
    settings.onChange('MyPack.size', listener)

    await settings.set('MyPack.other', 2)

    expect(listener).not.toHaveBeenCalled()
  })

  it('gives each listener a frozen copy of a list value', async () => {
    const settings = settingsApi()
    const delivered: unknown[] = []
    settings.declare({
      id: 'MyPack.tags',
      name: 'Tags',
      type: 'text',
      defaultValue: ''
    })
    settings.onChange('MyPack.tags', (value) => delivered.push(value))
    settings.onChange('MyPack.tags', (value) => delivered.push(value))

    await settings.set('MyPack.tags', ['a'])

    expect(delivered).toEqual([['a'], ['a']])
    expect(delivered[0]).not.toBe(delivered[1])
    expect(delivered.every((value) => Object.isFrozen(value))).toBe(true)
  })

  it('stops calling the listener once its disposer runs, and keeps the others', async () => {
    const settings = settingsApi()
    settings.declare(sizeSetting)
    const listener = vi.fn()
    const stop = settings.onChange('MyPack.size', listener)
    const stayed = settings.onChange('MyPack.size', listener)

    stop()
    stop()
    await settings.set('MyPack.size', 5)

    expect(listener).toHaveBeenCalledOnce()
    stayed()
    await settings.set('MyPack.size', 6)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('follows the settings store once for all listeners, and stops when the last one leaves', async () => {
    const subscribe = vi.mocked(useSettingStore().onSettingChanged)
    const follow = subscribe.getMockImplementation()
    assert(follow, 'the testing store wraps onSettingChanged')
    const stops: Array<() => void> = []
    subscribe.mockImplementation((listener) => {
      const stop = vi.fn(follow(listener).off)
      stops.push(stop)
      return { off: stop }
    })
    const settings = settingsApi()
    settings.declare(sizeSetting)
    const listener = vi.fn()
    const stopFirst = settings.onChange('MyPack.size', listener)
    const stopSecond = settings.onChange('MyPack.other', listener)

    await settings.set('MyPack.size', 5)
    stopFirst()
    const followedAfterOneLeft = stops.map(
      (stop) => vi.mocked(stop).mock.calls.length
    )
    stopSecond()
    await settings.set('MyPack.size', 6)

    expect(subscribe).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledExactlyOnceWith(5, 4)
    expect(followedAfterOneLeft).toEqual([0])
    expect(stops[0]).toHaveBeenCalledOnce()
  })

  it('reports a listener that throws and still calls the next one', async () => {
    const settings = settingsApi()
    settings.declare(sizeSetting)
    const broken = new Error('pack listener failed')
    const after = vi.fn()
    settings.onChange('MyPack.size', () => {
      throw broken
    })
    settings.onChange('MyPack.size', after)

    await settings.set('MyPack.size', 2)

    expect(after).toHaveBeenCalledExactlyOnceWith(2, 4)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      broken,
      expect.objectContaining({ tags: { event: 'settings.onChange' } })
    )
  })

  it.for([
    { name: 'an id that is not a string', id: 1, listener: () => {} },
    {
      name: 'a listener that is not a function',
      id: 'MyPack.size',
      listener: {}
    }
  ])('refuses $name', ({ id, listener }) => {
    const settings = settingsApi()

    expect(() =>
      Reflect.apply(settings.onChange, settings, [id, listener])
    ).toThrow(TypeError)
  })

  it.for(INHERITED_IDS)('refuses %s, an id every object inherits', (id) => {
    expect(() => settingsApi().onChange(id, () => {})).toThrow(
      new TypeError(
        `settings.onChange needs a setting id no object inherits, not '${id}'.`
      )
    )
  })
})

function cyclicValue(): object {
  const value: { self?: object } = {}
  value.self = value
  return value
}
