import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'

import { noAppSingletonImport } from './noAppSingletonImport'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } }
}).run('no-app-singleton-import', noAppSingletonImport, {
  valid: [
    {
      name: 'other app module exports and the useApp seam',
      code: `
import { ComfyApp, sanitizeNodeName } from '@/scripts/app'
import type { app as appType } from '@/scripts/app'
import { type app as alsoType } from '@/scripts/app'
import { useApp } from '@/scripts/appInstance'
import { app } from '@/stores/app'
import { app as other } from './apps'
import { app as json } from '@/scripts/app.json'
`
    }
  ],
  invalid: [
    {
      name: 'aliased, relative, and mixed singleton imports',
      code: `
import { app } from '@/scripts/app'
import { app as comfyApp } from '@/scripts/app'
import { ComfyApp, app as mixed } from './app'
import { app as parent } from '../scripts/app'
import { app as withTs } from '@/scripts/app.ts'
import { app as withJs } from '../scripts/app.js'
`,
      errors: [
        { messageId: 'singleton' },
        { messageId: 'singleton' },
        { messageId: 'singleton' },
        { messageId: 'singleton' },
        { messageId: 'singleton' },
        { messageId: 'singleton' }
      ]
    }
  ]
})
