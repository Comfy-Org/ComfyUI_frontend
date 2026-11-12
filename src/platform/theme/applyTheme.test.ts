import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { DEFAULT_DARK_THEME_PRESET } from '@comfyorg/theme-core/builtInThemePresets'
import { resolveTheme } from '@comfyorg/theme-core/resolveTheme'
import { LGraph, LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createComfyApi } from '@/platform/nodeApi/comfyApi'

import { applyTheme } from './applyTheme'

function fixtureTheme() {
  return resolveTheme({
    id: 'fixture',
    name: 'Fixture',
    colors: {
      node_slot: { IMAGE: '#123456' },
      litegraph_base: {
        NODE_TITLE_COLOR: '#234567',
        LINK_COLOR: '#345678',
        CLEAR_BACKGROUND_COLOR: '#456789',
        BACKGROUND_IMAGE: 'fixture.png',
        NODE_DEFAULT_SHAPE: 'legacy'
      },
      comfy_base: { 'comfy-menu-bg': '#56789a' },
      theme: { background: '#6789ab' }
    }
  })
}

function fixtureCanvas() {
  return fromPartial<LGraphCanvas>({
    default_connection_color_byType: {},
    setDirty: vi.fn()
  })
}

describe('applyTheme', () => {
  beforeEach(() => {
    const globals = Object.getOwnPropertyDescriptors(LiteGraph)
    const typeColors = { ...LGraphCanvas.link_type_colors }
    return () => {
      Object.defineProperties(LiteGraph, globals)
      LGraphCanvas.link_type_colors = typeColors
    }
  })

  it('writes semantic tokens and color scheme to the supplied style', () => {
    const style = document.createElement('div').style
    applyTheme(fixtureTheme(), { style })
    expect([style.getPropertyValue('--background'), style.colorScheme]).toEqual(
      ['#6789ab', 'dark']
    )
  })

  it('writes legacy variables and clears aliases when returning to core dark', () => {
    const style = document.createElement('div').style
    applyTheme(fixtureTheme(), { style })
    expect(style.getPropertyValue('--comfy-menu-bg')).toBe('#56789a')

    applyTheme(resolveTheme(DEFAULT_DARK_THEME_PRESET), { style })
    expect(style.getPropertyValue('--comfy-menu-bg')).toBe('')
  })

  it('applies globals and sanitizes legacy node shapes only with a canvas target', () => {
    const canvas = fixtureCanvas()
    applyTheme(fixtureTheme(), {
      style: document.createElement('div').style,
      canvas
    })
    expect([LiteGraph.NODE_TITLE_COLOR, LiteGraph.NODE_DEFAULT_SHAPE]).toEqual([
      '#234567',
      LiteGraph.ROUND_SHAPE
    ])
  })

  it('writes canvas colors and respects a configured background image', () => {
    const canvas = fixtureCanvas()
    const style = document.createElement('div').style
    applyTheme(fixtureTheme(), { style, canvas })
    expect([
      canvas.node_title_color,
      canvas.default_link_color,
      canvas.background_image,
      canvas.clear_background_color
    ]).toEqual(['#234567', '#345678', 'fixture.png', '#456789'])
    applyTheme(fixtureTheme(), { style, canvas, backgroundImage: 'user.png' })
    expect([
      canvas.clear_background_color,
      style.getPropertyValue('--bg-img')
    ]).toEqual(['transparent', "url('user.png')"])
  })

  it('writes datatype colors to CSS and both canvas registries, clearing unknown types', () => {
    const canvas = fixtureCanvas()
    const style = document.createElement('div').style
    style.setProperty('--color-datatype-CUSTOM', '#abcdef')
    applyTheme(fixtureTheme(), {
      style,
      canvas,
      dataTypes: ['IMAGE', 'CUSTOM']
    })
    expect([
      style.getPropertyValue('--color-datatype-IMAGE'),
      style.getPropertyValue('--color-datatype-CUSTOM'),
      canvas.default_connection_color_byType.IMAGE,
      LGraphCanvas.link_type_colors.IMAGE,
      canvas.default_connection_color_byType.CUSTOM
    ]).toEqual(['#123456', '', '#123456', '#123456', ''])
  })

  it('preserves a registered pack color when a theme resets known types', () => {
    const comfy = createComfyApi(() => new LGraph())
    onTestFinished(comfy.defs.setTypeColor('PACK_THEME_TYPE', '#c9a'))

    applyTheme(fixtureTheme(), {
      style: document.createElement('div').style,
      canvas: fixtureCanvas(),
      dataTypes: ['IMAGE', 'PACK_THEME_TYPE']
    })

    expect([
      LGraphCanvas.link_type_colors.PACK_THEME_TYPE,
      LGraphCanvas.link_type_colors.IMAGE
    ]).toEqual(['#c9a', '#123456'])
  })

  it('keeps canvas globals unchanged for a style-only target', () => {
    const previous = LiteGraph.NODE_TITLE_COLOR
    applyTheme(fixtureTheme(), { style: document.createElement('div').style })
    expect(LiteGraph.NODE_TITLE_COLOR).toBe(previous)
  })
})
