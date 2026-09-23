import { describe, expect, it } from 'vitest'

import { workshopUploadOrigin } from './workshop-upload-origin'

describe('workshop upload diagnostic origin', () => {
  it.for([
    'https://comfy.org',
    'http://localhost:4321',
    'http://probe.localhost:4321',
    'http://127.0.0.1:4321',
    'http://127.4.3.2:4321',
    'http://[::1]:4321'
  ])('accepts secure-context origin %s', (value) => {
    expect(workshopUploadOrigin(value).origin).toBe(value)
  })

  it.for([
    'http://comfy.org',
    'http://192.168.1.2',
    'http://localhost.example.com',
    'http://127.example.com',
    'ftp://localhost',
    'https://user:password@comfy.org'
  ])('rejects unsafe origin %s before running the probe', (value) => {
    expect(() => workshopUploadOrigin(value)).toThrow()
  })
})
