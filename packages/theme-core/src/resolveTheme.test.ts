import { describe, expect, it } from 'vitest'

import {
  BUILT_IN_THEME_PRESETS,
  DEFAULT_DARK_THEME_PRESET
} from './builtInThemePresets'
import { resolveTheme } from './resolveTheme'
import type { ThemePreset } from './themePresetSchema'

describe('theme resolution', () => {
  it.for<{
    name: string
    preset: ThemePreset
    background: string
    node: string
    colorScheme: 'dark' | 'light'
    nodeLightness?: number
  }>([
    {
      name: 'built-in semantic tokens',
      preset: DEFAULT_DARK_THEME_PRESET,
      background: '#171718',
      node: 'var(--card)',
      colorScheme: 'dark'
    },
    {
      name: 'missing custom values use light defaults',
      preset: {
        id: 'sparse',
        name: 'Sparse',
        light_theme: true,
        colors: { node_slot: {}, litegraph_base: {}, comfy_base: {} }
      },
      background: '#FFFFFF',
      node: '#F5F5F5',
      colorScheme: 'light',
      nodeLightness: 0.5
    },
    {
      name: 'explicit tokens override legacy colors',
      preset: {
        id: 'explicit',
        name: 'Explicit',
        colors: {
          node_slot: {},
          litegraph_base: {},
          comfy_base: { 'comfy-menu-bg': '#123456' },
          theme: { background: '#234567', node: '#345678' }
        }
      },
      background: '#234567',
      node: '#345678',
      colorScheme: 'dark'
    },
    {
      name: 'legacy colors derive semantic tokens',
      preset: {
        id: 'legacy',
        name: 'Legacy',
        colors: {
          node_slot: {},
          litegraph_base: { NODE_DEFAULT_BGCOLOR: '#456789' },
          comfy_base: { 'comfy-menu-bg': '#123456' }
        }
      },
      background: '#123456',
      node: '#456789',
      colorScheme: 'dark'
    }
  ])('$name', ({ preset, background, node, colorScheme, nodeLightness }) => {
    const theme = resolveTheme(preset)
    expect({
      background: theme.cssTokens.background,
      node: theme.cssTokens.node,
      colorScheme: theme.colorScheme,
      nodeLightness: theme.canvas.nodeLightness
    }).toEqual({ background, node, colorScheme, nodeLightness })
  })

  it('fills a missing secondary surface without changing the authored file', () => {
    const preset: ThemePreset = {
      id: 'immutable',
      name: 'Immutable',
      version: 7,
      colors: {
        node_slot: {},
        litegraph_base: {},
        comfy_base: Object.freeze({ 'comfy-menu-bg': '#123456' })
      }
    }
    const before = structuredClone(preset)

    const theme = resolveTheme(preset)

    expect(theme.cssTokens.card).toBe('#123456')
    expect(preset).toEqual(before)
    expect(theme.preset.version).toBe(7)
  })

  it.for<{
    name: string
    stylesheet?: string
    iconStyle?: string
    expected?: string
  }>([
    {
      name: 'saved palettes with triangle icons keep the Classic stylesheet',
      iconStyle: 'triangle',
      expected: 'classic'
    },
    {
      name: 'an explicit stylesheet wins over the legacy icon style',
      stylesheet: 'morning-class',
      iconStyle: 'triangle',
      expected: 'morning-class'
    },
    {
      name: 'other legacy icon styles get no stylesheet',
      iconStyle: 'chevron'
    },
    { name: 'palettes without the legacy key get no stylesheet' }
  ])('$name', ({ stylesheet, iconStyle, expected }) => {
    const savedPalette = {
      id: 'my-classic',
      name: 'My Classic',
      stylesheet,
      colors: {
        node_slot: {},
        litegraph_base: {},
        comfy_base: {},
        theme: {
          'node-radius': '8px',
          ...(iconStyle && { 'node-icon-style': iconStyle })
        }
      }
    }

    expect(resolveTheme(savedPalette).stylesheet).toBe(expected)
  })

  it.for([
    {
      name: 'the default node geometry',
      preset: DEFAULT_DARK_THEME_PRESET,
      geometry: {
        headerHeight: 28,
        slotInset: 0,
        slotBlockMarginBottom: 0,
        socketRowOverlap: 2
      }
    },
    {
      name: 'the node geometry Classic declares in its tokens',
      preset: BUILT_IN_THEME_PRESETS.classic,
      geometry: {
        headerHeight: 30,
        slotInset: 10,
        slotBlockMarginBottom: -2,
        socketRowOverlap: 0
      }
    }
  ])('resolves $name', ({ preset, geometry }) => {
    expect(resolveTheme(preset).nodeGeometry).toEqual(geometry)
  })
})
