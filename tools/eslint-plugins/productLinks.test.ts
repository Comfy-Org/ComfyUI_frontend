import { RuleTester } from 'eslint'
import path from 'node:path'
import vueParser from 'vue-eslint-parser'
import { describe, it } from 'vitest'

import productLinks from './productLinks'

RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: {
    parser: vueParser,
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' }
  }
})

const filename = path.join(
  import.meta.dirname,
  '../../src/components/LintFixture.vue'
)

function vue(template: string, script = '') {
  return {
    filename,
    code: `<script setup lang="ts">${script}</script><template>${template}</template>\n`
  }
}

const untagged = [{ messageId: 'untagged' }]

ruleTester.run('require-utm', productLinks.rules['require-utm'], {
  valid: [
    vue(
      '',
      "const url = productLink('https://docs.comfy.org/a', 'help_center')"
    ),
    vue(
      '',
      'const url = productLink(`https://comfy.org/hub/workflows/${id}`, `hub_card`)'
    ),
    vue(
      "<a :href=\"productLink('https://comfy.org/contact/', 'pricing_table')\" />"
    ),
    vue('', "const api = 'https://api.comfy.org/v2'"),
    vue('', "const cloud = 'https://cloud.comfy.org/?template=x'"),
    vue('', "const assets = 'https://desktop-assets.comfy.org/x.png'"),
    vue('', "const forum = 'https://forum.comfy.org/'"),
    vue('<a href="https://github.com/Comfy-Org/ComfyUI" />')
  ],
  invalid: [
    {
      ...vue('', "const url = 'https://comfy.org/contact/'"),
      errors: untagged
    },
    { ...vue('', "const url = 'https://www.comfy.org'"), errors: untagged },
    {
      ...vue('', 'const url = `https://docs.comfy.org${path}`'),
      errors: untagged
    },
    {
      ...vue('', "window.open('https://comfy.org/cloud/pricing/', '_blank')"),
      errors: untagged
    },
    {
      ...vue('', "const url = productLink(base, 'https://docs.comfy.org')"),
      errors: [{ messageId: 'campaign' }, { messageId: 'untagged' }]
    },
    {
      ...vue('<a href="https://comfy.org/terms-of-service/">Terms</a>'),
      errors: untagged
    },
    {
      ...vue('<a :href="\'https://blog.comfy.org/p/post\'">Blog</a>'),
      errors: untagged
    },
    {
      ...vue(
        '',
        "const url = productLink('https://docs.comfy.org/a', 'Help-Center')"
      ),
      errors: [{ messageId: 'campaign' }]
    }
  ]
})
