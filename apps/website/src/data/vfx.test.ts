import { describe, expect, it } from 'vitest'

import type { Locale } from '@/i18n/translations'

import { externalLinks } from '@/config/routes'
import { learningTutorials } from '@/data/learningTutorials'
import { projects } from '@/data/fdct'
import {
  vfxFaqs,
  vfxPage,
  vfxTasks,
  vfxTutorialsHref,
  vfxWorkflows
} from './vfx'

const locales: Locale[] = ['en', 'zh-CN']

describe('vfxTasks', () => {
  it.for(locales)(
    'lists the five VFX tasks and a contact card for %s',
    (locale) => {
      const tasks = vfxTasks(locale)

      expect(tasks.map((task) => task.id)).toEqual([
        'cleanplate',
        'sky',
        'deaging',
        'compositing',
        'upscaling',
        'custom'
      ])
      for (const task of tasks) {
        expect(task.title).not.toBe('')
        expect(task.description).not.toBe('')
        expect(task.cta.label).not.toBe('')
      }
    }
  )

  it('links every task to a tutorial page that exists, except the contact card', () => {
    const tutorialPaths = learningTutorials.map(
      ({ category, slug }) => `/learning/${category}/${slug}/`
    )
    const tasks = vfxTasks('en')

    for (const task of tasks.slice(0, -1)) {
      expect(tutorialPaths).toContain(task.cta.href)
    }
    expect(tasks.at(-1)?.cta.href).toBe(vfxPage.contactHref)
  })

  it('prefixes tutorial and contact links with the zh-CN locale', () => {
    const tasks = vfxTasks('zh-CN')

    expect(tasks[0].cta.href).toBe(
      '/zh-CN/learning/vfx/cleanplate-walkthrough/'
    )
    expect(tasks.at(-1)?.cta.href).toBe('/zh-CN/contact/')
  })
})

describe('vfxWorkflows', () => {
  it.for(locales)(
    'reuses existing workflow links, media, and titles for %s',
    (locale) => {
      const workflows = vfxWorkflows(locale)
      const hub = projects(locale)

      expect(workflows).toHaveLength(6)
      for (const workflow of workflows) {
        expect(workflow.href).toMatch(
          /^https:\/\/(comfy\.org\/workflows\/|cloud\.comfy\.org\/\?share=)/
        )
        expect(workflow.media.src).toMatch(/^https:\/\//)
        expect(workflow.title).not.toBe('')
        expect(workflow.description).not.toBe('')
      }
      const cleanplate = hub.find(({ id }) => id === 'ltx-cleanplate-for-vfx')
      expect(workflows[0]).toMatchObject({
        title: cleanplate?.title,
        href: cleanplate?.href
      })
    }
  )
})

describe('vfxFaqs', () => {
  it.for(locales)(
    'answers the infrastructure, pipeline, and getting-started questions for %s',
    (locale) => {
      const faqs = vfxFaqs(locale)

      expect(faqs).toHaveLength(5)
      for (const faq of faqs) {
        expect(faq.question).not.toBe('')
        expect(faq.answer).not.toBe('')
        expect(faq.answer).not.toContain('{')
      }
    }
  )

  it('links the Trust Center from the security answer', () => {
    expect(vfxFaqs('en')[4].answer).toContain(externalLinks.trustCenter)
  })
})

describe('vfxTutorialsHref', () => {
  it('points at the VFX tutorial directory', () => {
    expect(vfxTutorialsHref('en')).toBe('/learning/vfx/')
    expect(vfxTutorialsHref('zh-CN')).toBe('/zh-CN/learning/vfx/')
  })
})
