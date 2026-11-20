import { reportError } from '@comfyorg/telemetry/reportError'
import { describe, expect, it, vi } from 'vitest'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ButtonContribution } from '@/platform/nodeApi/v4/types'

function createApi() {
  return createComfyApi({ getGraph: () => null })
}

const button: ButtonContribution = {
  id: 'MyPack.open',
  icon: 'icon-[lucide--camera]',
  label: 'Open',
  tooltip: 'Open the panel',
  run: vi.fn()
}

describe('top-bar badges', () => {
  it('shows each badge a pack adds, in the order added', () => {
    const { comfy, host } = createApi()

    comfy.ui.addTopBarBadge({ id: 'MyPack.gpu', text: '40%', label: 'GPU' })
    comfy.ui.addTopBarBadge({
      id: 'MyPack.ram',
      text: '2 GB',
      variant: 'warning',
      tooltip: 'Memory'
    })

    expect(host.topbarBadges.value).toEqual([
      { text: '40%', label: 'GPU', variant: undefined, tooltip: undefined },
      { text: '2 GB', label: undefined, variant: 'warning', tooltip: 'Memory' }
    ])
  })

  it('updates only the fields given, keeping its place', () => {
    const { comfy, host } = createApi()
    const gpu = comfy.ui.addTopBarBadge({
      id: 'MyPack.gpu',
      text: '40%',
      label: 'GPU'
    })
    comfy.ui.addTopBarBadge({ id: 'MyPack.ram', text: '2 GB' })

    expect(gpu.update({ text: '55%' })).toBe(true)

    expect(
      host.topbarBadges.value.map(({ text, label }) => [text, label])
    ).toEqual([
      ['55%', 'GPU'],
      ['2 GB', undefined]
    ])
  })

  it('refuses an update that names an id or a field a badge does not have, and keeps the badge as it was', () => {
    const { comfy, host } = createApi()
    const gpu = comfy.ui.addTopBarBadge({ id: 'MyPack.gpu', text: '40%' })

    expect(() =>
      gpu.update(Object.assign({ text: '1%' }, { id: 'MyPack.other' }))
    ).toThrow(
      new TypeError(
        "update needs the fields to change of text, label, variant, tooltip only, not 'id'."
      )
    )
    expect(() =>
      gpu.update(Object.assign({ text: '1%' }, { colour: 'red' }))
    ).toThrow(
      new TypeError(
        "update needs the fields to change of text, label, variant, tooltip only, not 'colour'."
      )
    )
    expect(host.topbarBadges.value.map(({ text }) => text)).toEqual(['40%'])
  })

  it('refuses an update that is not a plain object', () => {
    const { comfy, host } = createApi()
    const gpu = comfy.ui.addTopBarBadge({ id: 'MyPack.gpu', text: '40%' })

    expect(() => gpu.update(Object.create({ text: '1%' }))).toThrow(
      new TypeError(
        'update needs the fields to change as a plain object, not an object.'
      )
    )
    expect(host.topbarBadges.value.map(({ text }) => text)).toEqual(['40%'])
  })

  it('removes only its own badge, and refuses an update afterwards', () => {
    const { comfy, host } = createApi()
    const gpu = comfy.ui.addTopBarBadge({ id: 'MyPack.gpu', text: '40%' })
    comfy.ui.addTopBarBadge({ id: 'MyPack.ram', text: '2 GB' })

    gpu.remove()
    gpu.remove()

    expect(host.topbarBadges.value.map(({ text }) => text)).toEqual(['2 GB'])
    expect(gpu.update({ text: '9%' })).toBe(false)
    expect(Reflect.apply(gpu.update, gpu, [{ colour: 'red' }])).toBe(false)
    expect(host.topbarBadges.value.map(({ text }) => text)).toEqual(['2 GB'])
  })

  it('lets an id be used again once its badge is removed', () => {
    const { comfy, host } = createApi()
    comfy.ui.addTopBarBadge({ id: 'MyPack.gpu', text: 'old' }).remove()

    comfy.ui.addTopBarBadge({ id: 'MyPack.gpu', text: 'new' })

    expect(host.topbarBadges.value.map(({ text }) => text)).toEqual(['new'])
  })

  it('leaves a later badge under the same id when an old handle is removed again', () => {
    const { comfy, host } = createApi()
    const old = comfy.ui.addTopBarBadge({ id: 'MyPack.gpu', text: 'old' })
    old.remove()
    comfy.ui.addTopBarBadge({ id: 'MyPack.gpu', text: 'new' })

    old.remove()

    expect(host.topbarBadges.value.map(({ text }) => text)).toEqual(['new'])
  })

  it('refuses an id another badge has, and keeps the first', () => {
    const { comfy, host } = createApi()
    comfy.ui.addTopBarBadge({ id: 'MyPack.gpu', text: 'first' })

    expect(() =>
      comfy.ui.addTopBarBadge({ id: 'MyPack.gpu', text: 'second' })
    ).toThrow(
      new TypeError(
        "ui.addTopBarBadge needs an id nothing shown has, not 'MyPack.gpu'."
      )
    )
    expect(host.topbarBadges.value.map(({ text }) => text)).toEqual(['first'])
  })

  it.for([
    { name: 'no badge', badge: 'GPU', needs: 'a badge as a plain object' },
    {
      name: 'a field a badge does not have',
      badge: { id: 'MyPack.b', text: 'x', colour: 'red' },
      needs: 'a badge of id, text, label, variant, tooltip only'
    },
    {
      name: 'an empty id',
      badge: { id: '', text: 'x' },
      needs: 'id as a non-empty string'
    },
    { name: 'no text', badge: { id: 'MyPack.b' }, needs: 'text as a string' },
    {
      name: 'an unknown variant',
      badge: { id: 'MyPack.b', text: 'x', variant: 'danger' },
      needs: 'variant as info, warning or error'
    },
    {
      name: 'a label that is not text',
      badge: { id: 'MyPack.b', text: 'x', label: 1 },
      needs: 'label as a string'
    },
    {
      name: 'a tooltip that is not text',
      badge: { id: 'MyPack.b', text: 'x', tooltip: {} },
      needs: 'tooltip as a string'
    }
  ])('refuses $name, and shows nothing', ({ badge, needs }) => {
    const { comfy, host } = createApi()

    expect(() =>
      Reflect.apply(comfy.ui.addTopBarBadge, comfy.ui, [badge])
    ).toThrow(
      expect.objectContaining({
        name: 'TypeError',
        message: expect.stringContaining(
          `ui.addTopBarBadge needs ${needs}, not `
        )
      })
    )
    expect(host.topbarBadges.value).toEqual([])
  })

  it('refuses an update with a field of the wrong type, and keeps the badge as it was', () => {
    const { comfy, host } = createApi()
    const gpu = comfy.ui.addTopBarBadge({ id: 'MyPack.gpu', text: '40%' })

    expect(() => Reflect.apply(gpu.update, gpu, [{ text: 5 }])).toThrow(
      new TypeError('update needs text as a string, not 5.')
    )
    expect(() => Reflect.apply(gpu.update, gpu, ['55%'])).toThrow(
      new TypeError(
        "update needs the fields to change as a plain object, not '55%'."
      )
    )
    expect(host.topbarBadges.value.map(({ text }) => text)).toEqual(['40%'])
  })
})

describe('action-bar buttons', () => {
  it('shows the button and runs the pack function on a click, with the click', () => {
    const run = vi.fn()
    const { comfy, host } = createApi()
    comfy.ui.addActionBarButton({ ...button, run })
    const [shown] = host.actionBarButtons.value
    const click = new MouseEvent('click')

    expect(shown).toMatchObject({
      icon: 'icon-[lucide--camera]',
      label: 'Open',
      tooltip: 'Open the panel'
    })
    Reflect.apply(shown.onClick, undefined, [click])
    shown.onClick()

    expect(run.mock.calls).toEqual([[click], [undefined]])
  })

  it('runs the function an update gave it', () => {
    const later = vi.fn()
    const { comfy, host } = createApi()
    const added = comfy.ui.addActionBarButton(button)

    added.update({ run: later, label: 'Close' })
    const [shown] = host.actionBarButtons.value
    shown.onClick()

    expect(shown.label).toBe('Close')
    expect(later).toHaveBeenCalledOnce()
    expect(button.run).not.toHaveBeenCalled()
  })

  it('reports a run that throws, and does not pass the error to the host', () => {
    const broken = new Error('pack button failed')
    const { comfy, host } = createApi()
    comfy.ui.addActionBarButton({
      ...button,
      run: () => {
        throw broken
      }
    })

    host.actionBarButtons.value[0].onClick()

    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      broken,
      expect.objectContaining({ tags: { event: 'ui.addActionBarButton' } })
    )
  })

  it('keeps badges and buttons apart, so a badge id does not block a button', () => {
    const { comfy, host } = createApi()
    comfy.ui.addTopBarBadge({ id: 'MyPack.open', text: 'x' })

    comfy.ui.addActionBarButton(button)

    expect(host.actionBarButtons.value).toHaveLength(1)
  })

  it.for([
    {
      name: 'no icon',
      value: { ...button, icon: '' },
      needs: 'icon as an icon class'
    },
    {
      name: 'no run function',
      value: { ...button, run: undefined },
      needs: 'run as a function'
    },
    {
      name: 'a label that is not text',
      value: { ...button, label: 2 },
      needs: 'label as a string'
    },
    {
      name: 'a field a button does not have',
      value: { ...button, onClick: vi.fn() },
      needs: 'a button of id, icon, label, tooltip, run only'
    },
    {
      name: 'a button made by a class',
      value: new (class {
        id = 'MyPack.open'
        icon = 'icon-[lucide--camera]'
        run() {}
      })(),
      needs: 'a button as a plain object'
    }
  ])('refuses $name, and shows nothing', ({ value, needs }) => {
    const { comfy, host } = createApi()

    expect(() =>
      Reflect.apply(comfy.ui.addActionBarButton, comfy.ui, [value])
    ).toThrow(
      expect.objectContaining({
        message: expect.stringContaining(
          `ui.addActionBarButton needs ${needs}, not `
        )
      })
    )
    expect(host.actionBarButtons.value).toEqual([])
  })
})
