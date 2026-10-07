import type { AgentationProps } from 'agentation'
import { Agentation } from 'agentation'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'

const props: AgentationProps = {
  endpoint: 'http://localhost:4747',
  appName: 'comfy.org'
}

export function mountAgentation(): void {
  const host = document.createElement('div')
  document.body.append(host)
  createRoot(host).render(createElement<AgentationProps>(Agentation, props))
  document.addEventListener('astro:after-swap', () => {
    document.body.append(host)
  })
}
