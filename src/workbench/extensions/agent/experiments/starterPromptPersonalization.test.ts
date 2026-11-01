import { describe, expect, it } from 'vitest'

import {
  normalizeStarterPromptProfile,
  selectStarterPrompts
} from './starterPromptPersonalization'

const videoBeginner = {
  intent: 'video',
  experience: 'new'
} as const

describe('starter prompt personalization', () => {
  it.for([
    {
      strategy: 'static' as const,
      expected: [
        'Create a product image from a text prompt',
        'Build an image-to-video workflow',
        'Explain how a ComfyUI workflow works',
        'Find the best workflow for a specific task',
        'Diagnose and fix errors in a workflow'
      ]
    },
    {
      strategy: 'profile' as const,
      expected: [
        'Create an image for a video',
        'Build an image-to-video workflow',
        'Teach me how ComfyUI workflows work',
        'Find the best video workflow for a specific task',
        'Help me diagnose a video workflow error'
      ]
    },
    {
      strategy: 'canvas' as const,
      expected: [
        'Create a product image from a text prompt',
        'Build an image-to-video workflow',
        'Explain this workflow',
        'Suggest the next improvement to this workflow',
        'Diagnose and fix errors in this workflow'
      ]
    },
    {
      strategy: 'profile_canvas' as const,
      expected: [
        'Create an image for a video',
        'Build an image-to-video workflow',
        'Explain this workflow',
        'Suggest the next improvement to this workflow',
        'Diagnose and fix errors in this workflow'
      ]
    }
  ])('computes the literal $strategy example', ({ strategy, expected }) => {
    expect(
      selectStarterPrompts({
        strategy,
        profile: videoBeginner,
        canvasPresence: 'present'
      }).prompts
    ).toEqual(expected)
  })

  it('uses focus only for the discover slot', () => {
    const selection = selectStarterPrompts({
      strategy: 'profile',
      profile: {
        intent: 'workflows',
        experience: 'pro',
        focus: 'custom_nodes'
      },
      canvasPresence: 'empty'
    })

    expect(selection.prompts).toEqual([
      'Create something with a workflow',
      'Build a reusable workflow',
      'Explain the architecture of a ComfyUI workflow',
      'Find useful custom nodes for my workflow',
      'Help me diagnose a workflow error'
    ])
  })

  it('drops free text, acquisition fields, and invalid enum values', () => {
    expect(
      normalizeStarterPromptProfile({
        intent: 'video',
        experience: 'expert',
        focus: 'products',
        intentOther: 'private text',
        source: 'social'
      })
    ).toEqual({ intent: 'video' })
  })

  it('drops focus when the intent does not support it', () => {
    expect(
      normalizeStarterPromptProfile({
        intent: 'images',
        experience: 'some',
        focus: 'custom_nodes'
      })
    ).toEqual({ intent: 'images', experience: 'some' })
  })

  it('ignores typed focus when the intent does not support it', () => {
    const selection = selectStarterPrompts({
      strategy: 'profile',
      profile: {
        intent: 'images',
        focus: 'custom_nodes'
      },
      canvasPresence: 'empty'
    })

    expect(selection.prompts[3]).toBe(
      'Find the best image workflow for a specific task'
    )
  })

  it('falls back as one English catalog when the locale is unavailable', () => {
    const selection = selectStarterPrompts({
      strategy: 'static',
      profile: null,
      canvasPresence: 'empty'
    })

    expect(selection.prompts).toEqual([
      'Create a product image from a text prompt',
      'Build an image-to-video workflow',
      'Explain how a ComfyUI workflow works',
      'Find the best workflow for a specific task',
      'Diagnose and fix errors in a workflow'
    ])
    expect(selection.locale).toBe('en')
    expect(selection.personalizationApplied).toBe(false)
  })
})
