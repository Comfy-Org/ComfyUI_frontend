import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

import type { Command, CommandRegistry } from '../types'
import { stringIter } from '../types'

/**
 * run-js: Execute arbitrary JavaScript with the ComfyUI app + Pinia stores
 * injected as locals, so snippets like
 *   useCanvasStore().canvas.graph._nodes
 * work without any import dance.
 *
 * Locals bound in the eval scope:
 *   app, api, document, window,
 *   useCanvasStore, useCommandStore, useWorkflowStore,
 *   useMissingModelStore, useExecutionErrorStore, useSettingStore
 */
const INJECT = [
  'app',
  'api',
  'document',
  'window',
  'useCanvasStore',
  'useCommandStore',
  'useWorkflowStore',
  'useMissingModelStore',
  'useExecutionErrorStore',
  'useSettingStore',
  'useColorPaletteStore'
] as const

/**
 * Strip outermost matching quotes (single/double/backtick). The pre-parse
 * shortcut for run-js passes the arg verbatim so the LLM often wraps its
 * snippet in quotes as it would in a shell — but here those quotes become
 * part of the JS source and collapse the whole thing to a string literal
 * that evaluates to undefined. Strip them so it works either way.
 */
function stripOuterQuotes(s: string): string {
  const trimmed = s.trim()
  if (trimmed.length < 2) return trimmed
  const first = trimmed[0]
  const last = trimmed[trimmed.length - 1]
  if ((first === '"' || first === "'" || first === '`') && first === last) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

const runJs: Command = async (ctx) => {
  const code = stripOuterQuotes(ctx.argv.slice(1).join(' '))
  if (!code.trim()) {
    return {
      stdout: stringIter(''),
      exitCode: 2,
      stderr: 'usage: run-js <js expression or statement>'
    }
  }
  try {
    // Intentional: run-js is a DevTools-equivalent eval entry point.
    const FnCtor = Function
    const fn = new FnCtor(...INJECT, `return (async () => { ${code} })()`) as (
      ...args: unknown[]
    ) => Promise<unknown>
    const result: unknown = await fn(
      app,
      api,
      document,
      window,
      useCanvasStore,
      useCommandStore,
      useWorkflowStore,
      useMissingModelStore,
      useExecutionErrorStore,
      useSettingStore,
      useColorPaletteStore
    )
    const out =
      result === undefined ? '' : JSON.stringify(result, null, 2) + '\n'
    return { stdout: stringIter(out), exitCode: 0 }
  } catch (err) {
    return {
      stdout: stringIter(''),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * describe <js-expression>
 *
 * Introspect the shape of any value in the run-js scope (stores, app,
 * canvas, nodes …). Returns type, constructor, own-property summary,
 * and prototype methods — without dumping huge payloads.
 *
 * Examples:
 *   describe useCanvasStore().canvas.graph
 *   describe app.canvas
 *   describe useCanvasStore().canvas.graph._nodes[0]
 */
const describeCmd: Command = async (ctx) => {
  const expr = stripOuterQuotes(ctx.argv.slice(1).join(' '))
  if (!expr) {
    return {
      stdout: stringIter(''),
      exitCode: 2,
      stderr: 'usage: describe <expression>'
    }
  }
  try {
    const FnCtor = Function
    const fn = new FnCtor(
      ...INJECT,
      `return (async () => { return (${expr}) })()`
    ) as (...args: unknown[]) => Promise<unknown>
    const value: unknown = await fn(
      app,
      api,
      document,
      window,
      useCanvasStore,
      useCommandStore,
      useWorkflowStore,
      useMissingModelStore,
      useExecutionErrorStore,
      useSettingStore,
      useColorPaletteStore
    )
    return { stdout: stringIter(formatShape(value) + '\n'), exitCode: 0 }
  } catch (err) {
    return {
      stdout: stringIter(''),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
}

function formatShape(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  const t = typeof value
  if (t !== 'object' && t !== 'function') {
    return `${t}: ${JSON.stringify(value)}`
  }
  const ctor =
    (value as object).constructor?.name ??
    (t === 'function' ? 'Function' : 'object')
  const lines: string[] = [`${ctor} (${t})`]
  if (Array.isArray(value)) {
    lines.push(`  length: ${value.length}`)
    if (value.length > 0) {
      lines.push(`  [0]: ${summariseValue(value[0])}`)
      if (value.length > 1)
        lines.push(`  [-1]: ${summariseValue(value[value.length - 1])}`)
    }
    return lines.join('\n')
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  if (keys.length > 0) {
    lines.push(`  own properties (${keys.length}):`)
    for (const k of keys.slice(0, 40)) {
      lines.push(`    ${k}: ${summariseValue(obj[k])}`)
    }
    if (keys.length > 40) lines.push(`    …${keys.length - 40} more`)
  }
  // Prototype methods (one level up, shallow)
  const proto = Object.getPrototypeOf(value)
  if (proto && proto !== Object.prototype && proto !== Function.prototype) {
    const protoKeys = Object.getOwnPropertyNames(proto)
      .filter((k) => k !== 'constructor')
      .sort()
    if (protoKeys.length > 0) {
      lines.push(`  prototype methods (${protoKeys.length}):`)
      lines.push('    ' + protoKeys.slice(0, 30).join(', '))
      if (protoKeys.length > 30)
        lines.push(`    …${protoKeys.length - 30} more`)
    }
  }
  return lines.join('\n')
}

function summariseValue(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  const t = typeof v
  if (t === 'function') return 'function'
  if (t === 'string') return `string(${(v as string).length})`
  if (t === 'number' || t === 'boolean') return `${t} ${String(v)}`
  if (Array.isArray(v)) return `Array(${v.length})`
  if (t === 'object') {
    const ctor = (v as object).constructor?.name ?? 'object'
    return ctor
  }
  return t
}

export function registerBrowserCommands(registry: CommandRegistry): void {
  registry.register('run-js', runJs)
  registry.register('describe', describeCmd)
}
