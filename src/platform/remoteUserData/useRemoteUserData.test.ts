import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { z } from 'zod'

import {
  markRemoteUserDataPending,
  markRemoteUserDataReady,
  remoteUserDataReady,
  setPayloadSource
} from './payloadSource'
import { useRemoteUserData } from './useRemoteUserData'

const KEY = 'app-mode-template-order'
const schema = z.object({ templateIds: z.array(z.string()) })
const defaultValue = { templateIds: ['default-a', 'default-b'] }

function registerSource(initial: Record<string, unknown> = {}) {
  const payloads = ref<Record<string, unknown>>(initial)
  setPayloadSource({ payloads })
  return payloads
}

beforeEach(() => {
  setPayloadSource(null)
  markRemoteUserDataReady()
})

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('useRemoteUserData', () => {
  it('returns the default and is loaded when no source is registered', () => {
    const { data, isLoaded } = useRemoteUserData({
      key: KEY,
      schema,
      defaultValue
    })

    expect(data.value).toEqual(defaultValue)
    expect(isLoaded.value).toBe(true)
  })

  it('resolves a valid payload from the source', () => {
    registerSource({ [KEY]: { templateIds: ['x', 'y'] } })

    const { data } = useRemoteUserData({ key: KEY, schema, defaultValue })

    expect(data.value).toEqual({ templateIds: ['x', 'y'] })
  })

  it('falls back to the default and warns on an invalid payload', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerSource({ [KEY]: { templateIds: 'not-an-array' } })

    const { data } = useRemoteUserData({ key: KEY, schema, defaultValue })

    expect(data.value).toEqual(defaultValue)
    expect(warn).toHaveBeenCalled()
  })

  it('prefers a dev override over the source payload', () => {
    registerSource({ [KEY]: { templateIds: ['from-source'] } })
    localStorage.setItem(
      `ff:${KEY}`,
      JSON.stringify({ templateIds: ['from-override'] })
    )

    const { data } = useRemoteUserData({ key: KEY, schema, defaultValue })

    expect(data.value).toEqual({ templateIds: ['from-override'] })
  })

  describe('reactive mode', () => {
    it('tracks payload reloads', async () => {
      const payloads = registerSource({ [KEY]: { templateIds: ['v1'] } })

      const { data } = useRemoteUserData({
        key: KEY,
        schema,
        defaultValue,
        mode: 'reactive'
      })
      expect(data.value).toEqual({ templateIds: ['v1'] })

      payloads.value = { [KEY]: { templateIds: ['v2'] } }
      await nextTick()

      expect(data.value).toEqual({ templateIds: ['v2'] })
    })

    it('warns once for a persistently invalid payload across reloads', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const payloads = registerSource({ [KEY]: { templateIds: 'bad' } })

      const { data } = useRemoteUserData({
        key: KEY,
        schema,
        defaultValue,
        mode: 'reactive'
      })
      expect(data.value).toEqual(defaultValue)

      payloads.value = { [KEY]: { templateIds: 'bad' } }
      await nextTick()
      expect(data.value).toEqual(defaultValue)

      expect(warn).toHaveBeenCalledOnce()
    })
  })

  describe('snapshot mode', () => {
    it('snapshots at creation when already loaded', () => {
      registerSource({ [KEY]: { templateIds: ['at-create'] } })

      const { data } = useRemoteUserData({ key: KEY, schema, defaultValue })

      expect(data.value).toEqual({ templateIds: ['at-create'] })
    })

    it('resolves once when readiness flips, then freezes across reloads', async () => {
      markRemoteUserDataPending()
      const payloads = registerSource()

      const { data } = useRemoteUserData({ key: KEY, schema, defaultValue })
      expect(data.value).toEqual(defaultValue)

      payloads.value = { [KEY]: { templateIds: ['authoritative'] } }
      markRemoteUserDataReady()
      await nextTick()
      expect(data.value).toEqual({ templateIds: ['authoritative'] })

      payloads.value = { [KEY]: { templateIds: ['late-reload'] } }
      await nextTick()
      expect(data.value).toEqual({ templateIds: ['authoritative'] })
    })

    it('keeps defaults resolved at a timeout flip even when values arrive later', async () => {
      markRemoteUserDataPending()
      const payloads = registerSource()

      const { data } = useRemoteUserData({ key: KEY, schema, defaultValue })

      markRemoteUserDataReady()
      await nextTick()
      expect(data.value).toEqual(defaultValue)

      payloads.value = { [KEY]: { templateIds: ['too-late'] } }
      await nextTick()
      expect(data.value).toEqual(defaultValue)
    })
  })

  describe('readiness', () => {
    it('only flips once and never back', async () => {
      markRemoteUserDataPending()
      expect(remoteUserDataReady.value).toBe(false)

      markRemoteUserDataReady()
      expect(remoteUserDataReady.value).toBe(true)

      markRemoteUserDataReady()
      expect(remoteUserDataReady.value).toBe(true)
    })
  })
})
