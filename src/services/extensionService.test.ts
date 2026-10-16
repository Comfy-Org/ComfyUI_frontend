import { describe, expect, it, vi } from 'vitest'

import { app } from '@/scripts/app'
import { useExtensionStore } from '@/stores/extensionStore'

import { shouldLoadExtension, useExtensionService } from './extensionService'

describe('shouldLoadExtension', () => {
  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'skips the inlined Cloud extension %s in cloud builds',
    (extension) => {
      expect(shouldLoadExtension(extension, true)).toBe(false)
    }
  )

  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'keeps the legacy path %s available outside cloud builds',
    (extension) => {
      expect(shouldLoadExtension(extension, false)).toBe(true)
    }
  )

  it('skips core extensions that load through the core entry point', () => {
    expect(shouldLoadExtension('/extensions/core/foo.js', false)).toBe(false)
  })

  it('loads other extensions', () => {
    expect(shouldLoadExtension('/extensions/comfyui-foo/main.js', true)).toBe(
      true
    )
  })
})

describe('graph-load extension hooks', () => {
  type HookApp = typeof app

  function register(extension: { name: string; [key: string]: unknown }) {
    useExtensionStore().registerExtension(extension)
  }

  it.for([
    {
      entrypoint: 'loadGraphData',
      call: (hookApp: HookApp) => hookApp.loadGraphData()
    },
    {
      entrypoint: 'loadApiJson',
      call: (hookApp: HookApp) => hookApp.loadApiJson({}, 'nested.json')
    },
    {
      entrypoint: 'handleFile',
      call: (hookApp: HookApp) => hookApp.handleFile(new File([], 'nested.png'))
    }
  ])(
    'rejects $entrypoint started after an await in a graph-load hook',
    async ({ call }) => {
      let nested: Promise<unknown> | undefined
      register({
        name: 'nested-loader',
        beforeLoadGraph: async (hookApp: HookApp) => {
          await Promise.resolve()
          nested = call(hookApp)
          await nested.catch(() => {})
        }
      })

      await useExtensionService().invokeExtensionsAsync('beforeLoadGraph')

      await expect(nested).rejects.toThrow(
        'A graph-load lifecycle hook cannot start a nested graph load'
      )
    }
  )

  it('lets a retained hook app load once the hook dispatch has finished', async () => {
    let retained: HookApp | undefined
    register({
      name: 'retaining-extension',
      afterLoadGraph: (hookApp: HookApp) => {
        retained = hookApp
      }
    })
    await useExtensionService().invokeExtensionsAsync('afterLoadGraph')
    const handleFile = vi.spyOn(app, 'handleFile').mockResolvedValue(undefined)
    const file = new File([], 'later.png')

    await retained?.handleFile(file)

    expect(handleFile).toHaveBeenCalledWith(file)
  })
})
