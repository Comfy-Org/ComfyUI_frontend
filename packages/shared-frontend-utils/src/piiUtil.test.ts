import { describe, expect, it } from 'vitest'

import { createPostHogBeforeSend } from './piiUtil'

describe('createPostHogBeforeSend', () => {
  const beforeSend = createPostHogBeforeSend()

  it('returns null for null input', () => {
    expect(beforeSend(null)).toBeNull()
  })

  it('strips all PII keys from properties, $set, and $set_once', () => {
    const event = {
      properties: {
        email: 'a@example.com',
        prompt: 'hello',
        user_email: 'b@example.com',
        $email: 'c@example.com',
        method: 'google'
      },
      $set: {
        email: 'd@example.com',
        user_email: 'e@example.com',
        $email: 'f@example.com',
        name: 'keep me'
      },
      $set_once: {
        email: 'g@example.com',
        plan: 'free'
      }
    }

    const result = beforeSend(event)!

    expect(result.properties).not.toHaveProperty('email')
    expect(result.properties).not.toHaveProperty('prompt')
    expect(result.properties).not.toHaveProperty('user_email')
    expect(result.properties).not.toHaveProperty('$email')
    expect(result.properties).toHaveProperty('method', 'google')

    expect(result.$set).not.toHaveProperty('email')
    expect(result.$set).not.toHaveProperty('user_email')
    expect(result.$set).not.toHaveProperty('$email')
    expect(result.$set).toHaveProperty('name', 'keep me')

    expect(result.$set_once).not.toHaveProperty('email')
    expect(result.$set_once).toHaveProperty('plan', 'free')
  })

  it('handles missing property bags gracefully', () => {
    const event = { properties: { email: 'a@example.com', safe: true } }
    const result = beforeSend(event)!
    expect(result.properties).not.toHaveProperty('email')
    expect(result.properties).toHaveProperty('safe', true)
    expect(result.$set).toBeUndefined()
    expect(result.$set_once).toBeUndefined()
  })
})
