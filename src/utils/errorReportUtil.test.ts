import { describe, expect, it } from 'vitest'

import type { ISerialisedGraph } from '@/lib/litegraph/src/litegraph'
import type { SystemStats } from '@comfyorg/api-client/types'

import type { ErrorReportData } from './errorReportUtil'
import { generateErrorReport } from './errorReportUtil'

const baseSystemStats: SystemStats = {
  system: {
    os: 'linux',
    comfyui_version: '1.0.0',
    python_version: '3.11',
    pytorch_version: '2.0',
    embedded_python: false,
    argv: ['main.py'],
    ram_total: 0,
    ram_free: 0
  },
  devices: []
}

const baseWorkflow = { nodes: [], links: [] } as unknown as ISerialisedGraph

function buildError(serverLogs: unknown): ErrorReportData {
  return {
    exceptionType: 'RuntimeError',
    exceptionMessage: 'boom',
    systemStats: baseSystemStats,
    serverLogs: serverLogs as string,
    workflow: baseWorkflow
  }
}

function hasLoneSurrogate(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    const isHighSurrogate = code >= 0xd800 && code <= 0xdbff
    const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff
    if (isHighSurrogate) {
      const next = text.charCodeAt(i + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true
    } else if (isLowSurrogate) {
      const prev = text.charCodeAt(i - 1)
      if (!(prev >= 0xd800 && prev <= 0xdbff)) return true
    }
  }
  return false
}

describe('generateErrorReport', () => {
  it('embeds string serverLogs verbatim', () => {
    const report = generateErrorReport(buildError('line one\nline two'))

    expect(report).toContain('line one\nline two')
    expect(report).not.toContain('[object Object]')
  })

  it('stringifies object serverLogs instead of rendering [object Object]', () => {
    const report = generateErrorReport(
      buildError({ entries: [{ msg: 'hello' }] })
    )

    expect(report).not.toContain('[object Object]')
    expect(report).toContain('"entries"')
    expect(report).toContain('"msg": "hello"')
  })

  it('escapes a literal ``` substring in the traceback so the fence is not broken', () => {
    const traceback = 'Traceback:\n```\nnested fenced block\n```\nEnd'
    const report = generateErrorReport({
      exceptionType: 'RuntimeError',
      exceptionMessage: 'boom',
      systemStats: baseSystemStats,
      serverLogs: 'plain logs',
      workflow: baseWorkflow,
      traceback
    })

    // The traceback must survive intact, including its embedded fence.
    expect(report).toContain(traceback)
    // The outer fence wrapping the stack trace must use a longer run of
    // backticks than the longest run already present in the traceback (3),
    // otherwise the embedded ``` would prematurely close the markdown fence.
    const stackTraceSection = report.split('## Stack Trace')[1]
    const openingDelimiterMatch = /^\n?(`{3,})/.exec(stackTraceSection)
    expect(openingDelimiterMatch).not.toBeNull()
    expect(openingDelimiterMatch?.[1].length).toBeGreaterThan(3)
  })

  it('escapes a literal ``` substring in serverLogs so the fence is not broken', () => {
    const serverLogs = 'log start\n```\nembedded fence in logs\n```\nlog end'
    const report = generateErrorReport({
      exceptionType: 'RuntimeError',
      exceptionMessage: 'boom',
      systemStats: baseSystemStats,
      serverLogs,
      workflow: baseWorkflow
    })

    expect(report).toContain(serverLogs)
    const logsSection = report.split('## Logs')[1]
    const openingDelimiterMatch = /^\n?(`{3,})/.exec(logsSection)
    expect(openingDelimiterMatch).not.toBeNull()
    expect(openingDelimiterMatch?.[1].length).toBeGreaterThan(3)
  })

  it('omits an oversized workflow with a manual-upload note instead of including it', () => {
    const emoji = '\u{1F600}' // U+1F600, a surrogate pair in UTF-16
    const workflow = {
      a: emoji.repeat(10000) + 'Z'
    } as unknown as ISerialisedGraph

    const report = generateErrorReport({
      exceptionType: 'RuntimeError',
      exceptionMessage: 'boom',
      systemStats: baseSystemStats,
      serverLogs: 'plain logs',
      workflow
    })

    expect(report).toContain('Workflow too large')
    expect(hasLoneSurrogate(report)).toBe(false)
  })
})
