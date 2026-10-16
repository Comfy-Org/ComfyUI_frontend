import { RuleTester } from 'eslint'
import path from 'node:path'
import vueParser from 'vue-eslint-parser'
import { describe, it } from 'vitest'

import templateClasses from './templateClasses'

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
const buttonImport =
  "<script setup>\nimport Button from '@/components/ui/button/Button.vue'\n</script>\n"
const inputImport =
  "<script setup>\nimport Input from '@/components/ui/input/Input.vue'\n</script>\n"

function vue(template: string, script = '') {
  return { filename, code: `${script}<template>${template}</template>\n` }
}

function redundant(template: string, output: string, script = '') {
  return { ...vue(template, script), output: vue(output, script).code }
}

ruleTester.run(
  'no-default-utilities',
  templateClasses.rules['no-default-utilities'],
  {
    valid: [
      vue('<div class="flex flex-col md:flex-row" />'),
      vue('<button class="p-0" />'),
      vue('<div class="items-stretch" :class="{ \'items-center\': true }" />'),
      vue('<div class="grid justify-start items-stretch" />'),
      vue('<p class="m-0" />'),
      vue('<div class="place-items-center items-stretch" />'),
      vue('<div class="place-content-center justify-start" />'),
      vue('<div class="space-y-2"><div class="m-0" /><div /></div>'),
      vue('<ul class="divide-y"><li class="border-0 px-2" /></ul>'),
      vue(
        '<section><TransitionGroup tag="div" class="space-y-2"><div key="a" class="m-0" /></TransitionGroup></section>'
      ),
      vue('<div class="border-0" />'),
      vue('<div class="border-none border-[3px]" />'),
      vue('<div class="border-0 border-dashed" />'),
      vue('<div class="border-none" style="border-width: 3px" />'),
      vue('<div class="border-none" :[attributeName]="\'border-solid\'" />'),
      {
        filename,
        code: '<template><div><div class="m-0" /></div></template>\n<style>@layer components { div { margin: 1rem } }</style>\n'
      }
    ],
    invalid: [
      {
        ...redundant(
          '<div class="flex flex-row gap-2" />',
          '<div class="flex gap-2" />'
        ),
        errors: [
          {
            messageId: 'redundant',
            data: { token: 'flex-row', element: 'div' }
          }
        ]
      },
      {
        ...redundant(
          '<span class="p-0 text-sm" />',
          '<span class="text-sm" />'
        ),
        errors: [
          { messageId: 'redundant', data: { token: 'p-0', element: 'span' } }
        ]
      },
      {
        ...redundant('<p><span class="border-0" /></p>', '<p><span /></p>'),
        errors: [
          {
            messageId: 'redundant',
            data: { token: 'border-0', element: 'span' }
          }
        ]
      },
      {
        ...redundant(
          '<div class="p-0 content-[&quot;x&quot;]" />',
          '<div class="content-[&quot;x&quot;]" />'
        ),
        errors: [
          { messageId: 'redundant', data: { token: 'p-0', element: 'div' } }
        ]
      }
    ]
  }
)

ruleTester.run(
  'no-redundant-component-classes',
  templateClasses.rules['no-redundant-component-classes'],
  {
    valid: [
      vue('<Button size="lg" class="h-8 rounded-md">Go</Button>', buttonImport),
      vue(
        '<Button :variant="kind" class="rounded-lg">Go</Button>',
        buttonImport
      ),
      vue(
        '<Button v-bind="buttonProps" class="rounded-lg">Go</Button>',
        buttonImport
      )
    ],
    invalid: [
      {
        ...redundant(
          '<Button size="lg" class="h-10 px-4 font-bold">Go</Button>',
          '<Button size="lg" class="font-bold">Go</Button>',
          buttonImport
        ),
        errors: [
          {
            messageId: 'redundant',
            data: { token: 'h-10', component: 'Button' }
          },
          {
            messageId: 'redundant',
            data: { token: 'px-4', component: 'Button' }
          }
        ]
      },
      {
        ...redundant(
          '<Button @size="onSize" size="lg" class="h-10">Go</Button>',
          '<Button @size="onSize" size="lg">Go</Button>',
          buttonImport
        ),
        errors: [
          {
            messageId: 'redundant',
            data: { token: 'h-10', component: 'Button' }
          }
        ]
      },
      {
        ...redundant(
          '<Input class="w-full text-sm max-w-80" />',
          '<Input class="max-w-80" />',
          inputImport
        ),
        errors: [
          {
            messageId: 'redundant',
            data: { token: 'w-full', component: 'Input' }
          },
          {
            messageId: 'redundant',
            data: { token: 'text-sm', component: 'Input' }
          }
        ]
      }
    ]
  }
)

ruleTester.run(
  'no-inherited-utilities',
  templateClasses.rules['no-inherited-utilities'],
  {
    valid: [
      vue(
        '<div class="text-xs"><Button><span class="text-xs">x</span></Button></div>',
        buttonImport
      ),
      vue('<div class="text-sm"><i class="pi pi-check text-sm" /></div>'),
      vue(
        '<div class="text-muted-foreground"><a class="text-muted-foreground" href="/">x</a></div>'
      ),
      vue('<div class="text-sm"><h2 class="text-sm font-normal">x</h2></div>'),
      vue('<div class="text-sm"><button class="text-sm">x</button></div>'),
      vue(
        '<p class="text-sm"><TransitionGroup tag="div" class="text-lg"><span key="a" class="text-sm" /></TransitionGroup></p>'
      ),
      vue('<div class="text-sm"><h3><span class="text-sm">x</span></h3></div>'),
      vue(
        '<div class="text-sm md:text-base"><span class="text-sm">x</span></div>'
      ),
      vue(
        '<div class="text-sm"><div class="text-[13px]"><span class="text-sm">x</span></div></div>'
      ),
      vue(
        '<div class="text-sm leading-none"><span class="text-sm">x</span></div>'
      ),
      vue('<div class="text-[0.9em]"><span class="text-[0.9em]">x</span></div>')
    ],
    invalid: [
      {
        ...redundant(
          '<div class="text-xs"><span class="flex text-xs">x</span></div>',
          '<div class="text-xs"><span class="flex">x</span></div>'
        ),
        errors: [
          {
            messageId: 'redundant',
            data: { token: 'text-xs', element: 'span' }
          }
        ]
      },
      {
        ...redundant(
          '<p class="text-sm leading-5"><span class="leading-5 text-sm md:text-base">x</span></p>',
          '<p class="text-sm leading-5"><span class="md:text-base">x</span></p>'
        ),
        errors: [
          {
            messageId: 'redundant',
            data: { token: 'leading-5', element: 'span' }
          },
          {
            messageId: 'redundant',
            data: { token: 'text-sm', element: 'span' }
          }
        ]
      }
    ]
  }
)
