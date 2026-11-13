import { describe, expect, it, vi } from 'vitest'

import {
  projectTemplateOrigin,
  rememberTemplateOrigin,
  templateOriginFor
} from './templateOrigin'

describe('template origin snapshot', () => {
  it('freezes the loaded origin on its exact workflow instance', async () => {
    const workflow = {}
    await rememberTemplateOrigin(workflow, 'fixture_template', { nodes: [] })
    const origin = templateOriginFor(workflow)
    expect(origin?.template_id).toBe('fixture_template')
    expect(origin?.revision).toMatch(/^[a-f0-9]{64}$/)
    expect(templateOriginFor({})).toBeUndefined()
    expect(Object.isFrozen(origin)).toBe(true)
  })

  it('refuses unbounded or private-looking identifiers', async () => {
    for (const id of [
      'https://private.example/a',
      'x@y.example',
      'x'.repeat(121)
    ]) {
      const workflow = {}
      await rememberTemplateOrigin(workflow, id, {})
      expect(templateOriginFor(workflow)).toBeUndefined()
    }
  })

  it('projects an origin claim without retaining extra runtime properties', async () => {
    const value = {
      template_id: 'fixture',
      revision: 'a'.repeat(64),
      email: 'private@example.invalid'
    }
    expect(projectTemplateOrigin(value)).toEqual({
      template_id: 'fixture',
      revision: 'a'.repeat(64)
    })
    expect(
      projectTemplateOrigin({ template_id: 'fixture', revision: 'unknown' })
    ).toBeUndefined()
  })

  it('keeps the latest load when earlier hashing finishes later', async () => {
    let finishOlder: (buffer: ArrayBuffer) => void = () => {}
    const older = new Promise<ArrayBuffer>((resolve) => {
      finishOlder = resolve
    })
    vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(() => older)
    const workflow = {}
    const first = rememberTemplateOrigin(workflow, 'older', {})
    await rememberTemplateOrigin(workflow, 'newer', {})
    finishOlder(new ArrayBuffer(32))
    await first
    expect(templateOriginFor(workflow)?.template_id).toBe('newer')
  })

  it('omits origin when no graph snapshot exists', async () => {
    const workflow = {}
    await rememberTemplateOrigin(workflow, 'fixture', undefined)
    expect(templateOriginFor(workflow)).toBeUndefined()
  })
})
