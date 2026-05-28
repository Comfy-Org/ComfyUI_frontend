import plugin from 'tailwindcss/plugin'
import { getIconsCSSData } from '@iconify/utils/lib/css/icons'
import { matchIconName } from '@iconify/utils/lib/icon/name'
import { loadIconSet } from '@iconify/tailwind4/lib/helpers/loader.js'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

function getBooleanValue(value, defaultValue = false) {
  switch (value) {
    case true:
    case '1':
    case 'true':
      return true
    case false:
    case '0':
    case 'false':
      return false
    default:
      return defaultValue
  }
}

function getFloatValue(value, defaultValue = 1) {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return defaultValue

  const numberValue = Number.parseFloat(value)
  return Number.isNaN(numberValue) ? defaultValue : numberValue
}

function parseCssString(value) {
  const matched = value.match(/^['"]?([^'"]+)['"]?$/)
  return matched ? matched[1] : value
}

function parseIconSets(value) {
  const values = typeof value === 'string' ? [value] : value
  if (!Array.isArray(values)) return {}

  return Object.fromEntries(
    values.flatMap((entry) => {
      const matched = entry.match(/^(from-folder)\((.*)\s*,\s*(.*)\)$/)
      if (!matched) return []

      return [
        [
          parseCssString(matched[2]),
          iconSetFromFolder(parseCssString(matched[3]))
        ]
      ]
    })
  )
}

function iconSetFromFolder(directory) {
  const icons = {}

  for (const file of readdirSync(directory)) {
    if (!file.endsWith('.svg')) continue

    const name = basename(file, '.svg')
    const svg = readFileSync(join(directory, file), 'utf8')
    const svgMatch = svg.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i)
    if (!svgMatch) continue

    const viewBox = svgMatch[1].match(/\bviewBox=(['"])(.*?)\1/i)?.[2]
    const [, , width = '16', height = '16'] =
      viewBox?.match(
        /^(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(\d*\.?\d+)\s+(\d*\.?\d+)$/
      ) ?? []

    icons[name] = {
      body: svgMatch[2],
      height: Number(height),
      width: Number(width)
    }
  }

  return {
    prefix: 'comfy',
    icons
  }
}

function getDynamicCSSRules(icon, options) {
  const nameParts = icon.split(/--|:/)
  if (nameParts.length !== 2) return {}

  const [prefix, name] = nameParts
  if (!(prefix.match(matchIconName) && name.match(matchIconName))) return {}

  const iconSet = loadIconSet(options.iconSets[prefix] ?? prefix)
  if (!iconSet) return {}

  const generated = getIconsCSSData(iconSet, [name], {
    iconSelector: '.icon'
  })
  if (generated.css.length !== 1) return {}

  const scale = options.scale
  if (scale) {
    generated.common.rules.height = `${scale}em`
    generated.common.rules.width = `${scale}em`
  } else {
    delete generated.common.rules.height
    delete generated.common.rules.width
  }

  return {
    ...(options.overrideOnly ? {} : generated.common.rules),
    ...generated.css[0].rules
  }
}

export default plugin.withOptions((params = {}) => {
  const options = {
    iconSets: {},
    overrideOnly: false,
    prefix: 'icon',
    scale: 1
  }

  for (const [key, value] of Object.entries(params)) {
    switch (key) {
      case 'prefix':
        options.prefix = value === false ? '' : String(value)
        break
      case 'overrideOnly':
      case 'override-only':
      case 'overrideonly':
        options.overrideOnly = getBooleanValue(value, options.overrideOnly)
        break
      case 'scale':
        options.scale = getFloatValue(value, options.scale)
        break
      case 'icon-sets':
      case 'iconSets':
      case 'iconsets':
        options.iconSets = parseIconSets(value)
        break
    }
  }

  return ({ matchComponents }) => {
    if (!options.prefix) return

    matchComponents({
      [options.prefix]: (icon) => getDynamicCSSRules(icon, options)
    })
  }
})
