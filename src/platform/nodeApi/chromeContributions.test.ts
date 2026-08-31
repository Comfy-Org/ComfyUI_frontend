import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useActionBarButtonStore } from '@/stores/actionBarButtonStore'
import { useTopbarBadgeStore } from '@/stores/topbarBadgeStore'

import {
  addBadgeContribution,
  addButtonContribution,
  resetChromeContributions
} from './chromeContributions'
import { ComfyApiError } from './errors'

describe('chrome contributions', () => {
  afterEach(resetChromeContributions)

  it('shows a badge in the top bar, and removes it again', () => {
    setActivePinia(createPinia())
    const store = useTopbarBadgeStore()

    const badge = addBadgeContribution({
      id: 'Crystools.monitor',
      text: 'CPU 12%',
      icon: 'pi-chart-bar',
      tooltip: 'Resources'
    })

    expect(store.badges).toContainEqual(
      expect.objectContaining({ text: 'CPU 12%', tooltip: 'Resources' })
    )

    badge.remove()
    expect(store.badges).toHaveLength(0)
  })

  it('updates a live value in place', () => {
    // The motivating case is a resource readout that changes every second. A
    // closure would not do: the host renders on reactive change and cannot see
    // a plain function, so the readout would show its first value forever.
    setActivePinia(createPinia())
    const store = useTopbarBadgeStore()
    const badge = addBadgeContribution({ id: 'Crystools.cpu', text: 'CPU 12%' })

    expect(store.badges[0].text).toBe('CPU 12%')

    badge.update({ text: 'CPU 87%' })
    expect(store.badges[0].text).toBe('CPU 87%')
  })

  it('keeps the fields an update does not mention', () => {
    setActivePinia(createPinia())
    const store = useTopbarBadgeStore()
    const badge = addBadgeContribution({
      id: 'Crystools.cpu',
      text: 'CPU 12%',
      tooltip: 'Resources'
    })

    badge.update({ text: 'CPU 87%' })

    expect(store.badges[0].tooltip).toBe('Resources')
  })

  it('refuses to update something already removed', () => {
    // Silently reviving it would leave a pack showing what it took down.
    const badge = addBadgeContribution({ id: 'MyPack.gone', text: 'x' })
    badge.remove()

    expect(() => badge.update({ text: 'y' })).toThrow(/has been removed/)
  })

  it('runs a contributed action bar button', () => {
    setActivePinia(createPinia())
    const store = useActionBarButtonStore()
    const run = vi.fn()

    addButtonContribution({ id: 'AGL.locale', icon: 'pi-globe', run })
    const click = new MouseEvent('click', { shiftKey: true })
    store.buttons.at(-1)!.onClick(click)

    // The event is passed because packs branch on modifiers — one opens its
    // panel in a sized window on shift-click.
    expect(run).toHaveBeenCalledWith(click)
  })

  it('requires a namespaced id', () => {
    expect(() => addBadgeContribution({ id: 'monitor', text: 'x' })).toThrow(
      ComfyApiError
    )
  })

  it('refuses to take a slot another contribution already holds', () => {
    // Silently replacing would let a pack loaded twice, or two packs that
    // picked the same id, fight over one slot with no way to see it.
    addBadgeContribution({ id: 'MyPack.x', text: 'first' })

    expect(() =>
      addBadgeContribution({ id: 'MyPack.x', text: 'second' })
    ).toThrow(/already registered/)
  })

  it('frees the id once removed', () => {
    addBadgeContribution({ id: 'MyPack.x', text: 'first' }).remove()

    expect(() =>
      addBadgeContribution({ id: 'MyPack.x', text: 'second' })
    ).not.toThrow()
  })

  it('leaves the host its own contributions', () => {
    // The stores merge two sources; a pack must not displace core's.
    setActivePinia(createPinia())
    const store = useTopbarBadgeStore()
    const before = store.badges.length

    addBadgeContribution({ id: 'MyPack.x', text: 'mine' })

    expect(store.badges).toHaveLength(before + 1)
  })
})
