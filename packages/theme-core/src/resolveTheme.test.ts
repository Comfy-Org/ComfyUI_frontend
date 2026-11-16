import { describe, expect, it } from 'vitest'

import { DEFAULT_DARK_THEME_PRESET } from './builtInThemePresets'
import { resolveTheme } from './resolveTheme'
import type { ThemePreset } from './themePresetSchema'

describe('theme resolution', () => {
  it.for<{
    name: string
    preset: ThemePreset
    background: string
    node: string
    colorScheme: 'dark' | 'light'
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
      colorScheme: 'light'
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
  ])('$name', ({ preset, background, node, colorScheme }) => {
    const theme = resolveTheme(preset)
    expect({
      background: theme.cssTokens.background,
      node: theme.cssTokens.node,
      colorScheme: theme.colorScheme
    }).toEqual({ background, node, colorScheme })
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
})
