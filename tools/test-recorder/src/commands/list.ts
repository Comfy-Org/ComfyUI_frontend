import pc from 'picocolors'
import { listWorkflows, findProjectRoot } from '../recorder/runner'
import { header } from '../ui/logger'

export function filterWorkflows(
  workflows: string[],
  keyword: string
): string[] {
  const normalizedKeyword = keyword.toLowerCase()
  return workflows.filter((workflow) =>
    workflow.toLowerCase().includes(normalizedKeyword)
  )
}

export async function runList(filter?: string): Promise<void> {
  header('Available Workflows')

  const projectRoot = findProjectRoot()
  const allWorkflows = listWorkflows(projectRoot)
  const workflows = filterWorkflows(allWorkflows, filter ?? '')

  if (workflows.length === 0) {
    if (filter) {
      console.log(pc.dim(`  No workflows match "${filter}".`))
      return
    }
    console.log(pc.dim('  No workflow assets found in browser_tests/assets/'))
    return
  }

  console.log(
    pc.dim(`  Found ${workflows.length} workflows in browser_tests/assets/:\n`)
  )

  let currentDir = ''
  for (const wf of workflows) {
    const parts = wf.split('/')
    if (parts.length > 1) {
      const dir = parts.slice(0, -1).join('/')
      if (dir !== currentDir) {
        currentDir = dir
        console.log(pc.bold(`  ${dir}/`))
      }
      console.log(`    ${pc.cyan(parts[parts.length - 1])}`)
    } else {
      if (currentDir !== '') {
        currentDir = ''
        console.log()
      }
      console.log(`  ${pc.cyan(wf)}`)
    }
  }
}
