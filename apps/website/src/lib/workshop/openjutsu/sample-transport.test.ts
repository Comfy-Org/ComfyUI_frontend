import { describe, expect, it } from 'vitest'

import { ReshootError } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import { sampleScenario, sampleTransport } from './sample-transport'

const clip = new File(['clip'], 'clip.mp4', { type: 'video/mp4' })

describe('sampleScenario', () => {
  it.for<[string, string]>([
    ['', 'free'],
    ['?sample=paid', 'paid'],
    ['?sample=nonsense', 'free']
  ])('reads %s as %s', ([search, scenario]) => {
    expect(sampleScenario(search)).toBe(scenario)
  })
})

describe('sampleTransport', () => {
  it('queues, runs, then hands the uploaded clip back as the result', async () => {
    const transport = sampleTransport(() => 'free')
    await transport.upload(clip)
    const job = await transport.submit({}, 'key')
    const statuses = []
    for (let poll = 0; poll < 4; poll++)
      statuses.push((await transport.job(job.id)).status)
    expect(statuses).toEqual(['queued', 'running', 'running', 'succeeded'])
    const done = await transport.job(job.id)
    expect(done.outputs?.at(0)?.filename).toContain('result')
    await expect(transport.output(done, {})).resolves.toBe(clip)
  })

  it('ends a run in failure when asked to', async () => {
    const transport = sampleTransport(() => 'fails')
    const job = await transport.submit({}, 'key')
    for (let poll = 0; poll < 3; poll++) await transport.job(job.id)
    expect((await transport.job(job.id)).status).toBe('failed')
  })

  it.for<[ReturnType<typeof sampleScenario>, string, string | undefined]>([
    ['paid', 'paid', undefined],
    ['exhausted', 'blocked', 'free_runs_exhausted'],
    ['no-credits', 'blocked', 'insufficient_credits']
  ])('quotes %s as %s', async ([scenario, next, reason]) => {
    const quote = await sampleTransport(() => scenario).quote()
    expect(quote?.next_run).toBe(next)
    expect(quote?.blocked_reason).toBe(reason)
  })

  it('refuses the quote when the app is unavailable', async () => {
    await expect(sampleTransport(() => 'unavailable').quote()).rejects.toThrow(
      ReshootError
    )
  })
})
