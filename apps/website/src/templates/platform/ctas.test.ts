import { describe, expect, it } from 'vitest'

import { platformCtas } from './ctas'

describe('platformCtas', () => {
  it('sends Get Started to the console and docs to the platform overview', () => {
    const { getStarted, docs } = platformCtas('en')

    expect(getStarted).toEqual({
      label: 'Get Started',
      href: 'https://platform.comfy.org',
      target: '_blank'
    })
    expect(docs).toEqual({
      label: 'Read the docs',
      href: 'https://docs.comfy.org/development/overview',
      target: '_blank'
    })
  })

  it('localizes the labels without changing the targets', () => {
    const en = platformCtas('en')
    const zh = platformCtas('zh-CN')

    expect(zh.getStarted.label).toBe('立即开始')
    expect(zh.docs.label).toBe('阅读文档')
    expect(zh.getStarted.href).toBe(en.getStarted.href)
    expect(zh.docs.href).toBe(en.docs.href)
  })
})
