import { describe, expect, it } from 'vitest'

import { applyFindings, findInheritedClasses } from './inheritedClasses'

function sfc(template: string, imports: string[] = []) {
  const script = imports
    .map((name) => `import ${name} from './${name}.vue'`)
    .join('\n')
  return `<script setup lang="ts">\n${script}\n</script>\n<template>\n${template}\n</template>\n`
}

function report(files: Record<string, string>) {
  return findInheritedClasses(new Map(Object.entries(files))).map(
    ({ file, line, tag, tokens }) =>
      `${file}:${line} <${tag}> ${tokens.join(' ')}`
  )
}

interface Project {
  name: string
  files: Record<string, string>
}

const card = sfc('<div class="text-sm"><slot /></div>')
const label = sfc('<div><span class="text-xs">x</span></div>')

describe('findInheritedClasses', () => {
  it.for<Project & { expected: string[] }>([
    {
      name: 'a text size its parent element sets',
      files: {
        'src/App.vue': sfc(
          '<div class="text-sm font-bold"><p class="text-sm font-bold">x</p></div>'
        )
      },
      expected: ['src/App.vue:5 <p> text-sm font-bold']
    },
    {
      name: 'a text size every usage of the component already sets',
      files: {
        'src/App.vue': sfc(
          '<div class="text-xs"><Label /></div><p class="text-xs"><Label /></p>',
          ['Label']
        ),
        'src/Label.vue': label
      },
      expected: ['src/Label.vue:5 <span> text-xs']
    },
    {
      name: 'slot content inside a component that sets the size',
      files: {
        'src/App.vue': sfc('<Card><p class="text-sm">x</p></Card>', ['Card']),
        'src/Card.vue': card
      },
      expected: ['src/App.vue:5 <p> text-sm']
    },
    {
      name: 'slot content under a class that falls through to the root',
      files: {
        'src/App.vue': sfc(
          '<Panel class="text-muted-foreground"><p class="text-muted-foreground">x</p></Panel>',
          ['Panel']
        ),
        'src/Panel.vue': sfc('<section><slot /></section>')
      },
      expected: ['src/App.vue:5 <p> text-muted-foreground']
    }
  ])('reports $name', ({ files, expected }) => {
    expect(report(files)).toEqual(expected)
  })

  it.for<Project>([
    {
      name: 'a component used under two different sizes',
      files: {
        'src/App.vue': sfc(
          '<div class="text-xs"><Label /></div><div class="text-sm"><Label /></div>',
          ['Label']
        ),
        'src/Label.vue': label
      }
    },
    {
      name: 'a component that is also mounted from TypeScript',
      files: {
        'src/App.vue': sfc('<div class="text-xs"><Label /></div>', ['Label']),
        'src/Label.vue': label,
        'src/dialogs.ts': "import Label from './Label.vue'\nexport { Label }\n"
      }
    },
    {
      name: 'a root class that a TypeScript mount could override',
      files: {
        'src/App.vue': sfc('<Label />', ['Label']),
        'src/Label.vue': sfc(
          '<div class="text-sm"><span class="text-sm">x</span></div>'
        ),
        'src/dialogs.ts': "import Label from './Label.vue'\nexport { Label }\n"
      }
    },
    {
      name: 'a component with no known mount point',
      files: { 'src/Label.vue': label }
    },
    {
      name: 'form controls and headings, which do not inherit',
      files: {
        'src/App.vue': sfc(
          '<div class="text-sm font-bold"><button class="text-sm" /><h2 class="font-bold">x</h2></div>'
        )
      }
    },
    {
      name: 'a parent whose classes are bound',
      files: {
        'src/App.vue': sfc(
          '<div :class="classes"><p class="text-sm">x</p></div>'
        )
      }
    },
    {
      name: 'a parent whose stylesheet class sets the font size',
      files: {
        'src/App.vue': sfc(
          '<div class="text-sm prose"><div class="prose"><p class="text-sm">x</p></div></div>'
        ),
        'src/style.css': '@layer components { .prose { @apply text-lg; } }'
      }
    },
    {
      name: 'content teleported out of the parent',
      files: {
        'src/App.vue': sfc(
          '<div class="text-sm"><Teleport to="body"><p class="text-sm">x</p></Teleport></div>'
        )
      }
    },
    {
      name: 'a class forwarded through a wrapper component to the root',
      files: {
        'src/App.vue': sfc(
          '<div class="text-xs"><Wrapper class="text-sm" /></div>',
          ['Wrapper']
        ),
        'src/Wrapper.vue': sfc('<BaseCard />', ['BaseCard']),
        'src/BaseCard.vue': sfc('<div><p class="text-xs">x</p></div>')
      }
    },
    {
      name: 'slot content under a class forwarded through a wrapper',
      files: {
        'src/App.vue': sfc(
          '<div class="text-xs"><Wrapper class="text-sm"><p class="text-xs">x</p></Wrapper></div>',
          ['Wrapper']
        ),
        'src/Wrapper.vue': sfc('<Panel><slot /></Panel>', ['Panel']),
        'src/Panel.vue': sfc('<section><slot /></section>')
      }
    },
    {
      name: 'relative font sizes, which compound',
      files: {
        'src/App.vue': sfc(
          '<div class="text-[0.9em]"><p class="text-[0.9em]">x</p></div><div class="text-[1cap]"><p class="text-[1cap]">x</p></div>'
        )
      }
    },
    {
      name: 'a size that differs only by line height',
      files: {
        'src/App.vue': sfc(
          '<div class="text-sm leading-6"><p class="text-sm">x</p></div>'
        )
      }
    }
  ])('allows $name', ({ files }) => {
    expect(report(files)).toEqual([])
  })
})

describe('applyFindings', () => {
  it.for([
    {
      template: '<div class="text-sm"><p class="m-0 text-sm">x</p></div>',
      fixed: '<div class="text-sm"><p class="m-0">x</p></div>'
    },
    {
      template: '<div class="text-sm"><p class="text-sm">x</p></div>',
      fixed: '<div class="text-sm"><p>x</p></div>'
    },
    {
      template: '<div class="text-sm"><p class=text-sm>x</p></div>',
      fixed: '<div class="text-sm"><p>x</p></div>'
    }
  ])('removes the inherited classes from $template', ({ template, fixed }) => {
    const source = sfc(template)
    const findings = findInheritedClasses(new Map([['src/App.vue', source]]))

    expect(applyFindings(source, findings)).toBe(sfc(fixed))
  })
})
