import { describe, expect, it } from 'vitest'

import type { ISerialisedGraph } from '@/lib/litegraph/src/litegraph'
import type { SystemStats } from '@/schemas/apiSchema'

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
})
