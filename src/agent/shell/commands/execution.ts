import { api } from '@/scripts/api'

import type { Command, CommandRegistry } from '../types'
import { emptyIter, stringIter } from '../types'

interface RawJob {
  id: string
  status: string
  execution_error?: unknown
  outputs_count?: number | null
  workflow_id?: string | null
}

function jobState(j: RawJob): string {
  if (j.execution_error) return 'error'
  return j.status || 'unknown'
}

function fmtJob(j: RawJob): string {
  return `${jobState(j)}\t${j.id}\t${j.workflow_id ?? ''}`
}

const queueStatus: Command = async () => {
  const { Running, Pending } = await api.getQueue()
  const lines: string[] = []
  lines.push(`running: ${Running.length}`)
  for (const j of Running) lines.push('  ' + fmtJob(j as unknown as RawJob))
  lines.push(`pending: ${Pending.length}`)
  for (const j of Pending) lines.push('  ' + fmtJob(j as unknown as RawJob))
  return { stdout: stringIter(lines.join('\n') + '\n'), exitCode: 0 }
}

const historyCmd: Command = async (ctx) => {
  const arg = ctx.argv.find((a) => a.startsWith('--last='))
  const last = arg ? Number(arg.slice(7)) : 10
  const max = Number.isFinite(last) && last > 0 ? Math.min(last, 200) : 10
  const items = await api.getHistory(max)
  const lines = items.map((j) => fmtJob(j as unknown as RawJob))
  return {
    stdout: stringIter(lines.join('\n') + (lines.length ? '\n' : '')),
    exitCode: 0
  }
}

const waitQueue: Command = async (ctx) => {
  const timeoutArg = ctx.argv.find((a) => a.startsWith('--timeout='))
  const timeoutMs = timeoutArg ? Number(timeoutArg.slice(10)) * 1000 : 300_000
  const pollArg = ctx.argv.find((a) => a.startsWith('--poll='))
  const pollMs = pollArg ? Number(pollArg.slice(7)) * 1000 : 1000
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    if (ctx.signal.aborted) {
      return { stdout: emptyIter(), exitCode: 130, stderr: 'aborted' }
    }
    const { Running, Pending } = await api.getQueue()
    if (Running.length === 0 && Pending.length === 0) {
      const elapsed = ((Date.now() - started) / 1000).toFixed(1)
      return {
        stdout: stringIter(`queue idle after ${elapsed}s\n`),
        exitCode: 0
      }
    }
    await new Promise((r) => setTimeout(r, pollMs))
  }
  return {
    stdout: emptyIter(),
    exitCode: 124,
    stderr: `timed out after ${timeoutMs / 1000}s`
  }
}

const latestOutput: Command = async () => {
  const items = await api.getHistory(1)
  if (items.length === 0) {
    return { stdout: emptyIter(), exitCode: 1, stderr: 'no history' }
  }
  const job = items[0] as unknown as RawJob
  const detail = await api.getJobDetail(job.id)
  const outputs = detail?.outputs ?? {}
  const previews: string[] = []
  for (const [nodeId, out] of Object.entries(outputs)) {
    const images = (
      out as {
        images?: { filename?: string; subfolder?: string; type?: string }[]
      }
    ).images
    if (!images) continue
    for (const img of images) {
      if (!img.filename) continue
      const sub = img.subfolder
        ? `&subfolder=${encodeURIComponent(img.subfolder)}`
        : ''
      const type = img.type ? `&type=${encodeURIComponent(img.type)}` : ''
      previews.push(
        `node=${nodeId}\t/view?filename=${encodeURIComponent(img.filename)}${sub}${type}`
      )
    }
  }
  const state = jobState(job)
  if (previews.length === 0) {
    return {
      stdout: stringIter(`job ${job.id}\t${state}\tno images\n`),
      exitCode: 0
    }
  }
  return {
    stdout: stringIter(
      [`job: ${job.id}`, `state: ${state}`, ...previews].join('\n') + '\n'
    ),
    exitCode: 0
  }
}

export function registerExecutionCommands(registry: CommandRegistry): void {
  registry.register('queue-status', queueStatus)
  registry.register('history', historyCmd)
  registry.register('wait-queue', waitQueue)
  registry.register('latest-output', latestOutput)
}
