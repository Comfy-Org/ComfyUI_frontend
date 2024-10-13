// @ts-strict-ignore
/* 
    Script to generate test API json from the ComfyUI_examples repo. 
    Requires the repo to be cloned to the tests-ui directory or specified via the EXAMPLE_REPO_PATH env var.
*/

import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'node:url'
import { getFromPngBuffer } from '@/scripts/metadata/png'
import { getFromFlacBuffer } from '@/scripts/metadata/flac'
import dotenv from 'dotenv'
dotenv.config()

const dirname = path.dirname(fileURLToPath(import.meta.url))
const repoPath =
  process.env.EXAMPLE_REPO_PATH || path.resolve(dirname, 'ComfyUI_examples')
const workflowsPath = path.resolve(dirname, 'workflows', 'examples')

if (!fs.existsSync(repoPath)) {
  console.error(
    `ComfyUI_examples repo not found. Please clone this to ${repoPath} or set the EXAMPLE_REPO_PATH env var (see .env_example) and re-run.`
  )
}

if (!fs.existsSync(workflowsPath)) {
  await fs.promises.mkdir(workflowsPath)
}

async function* getFiles(
  dir: string,
  ...exts: string[]
): AsyncGenerator<string, void, void> {
  const dirents = await fs.promises.readdir(dir, { withFileTypes: true })
  for (const dirent of dirents) {
    const res = path.resolve(dir, dirent.name)
    if (dirent.isDirectory()) {
      yield* getFiles(res, ...exts)
    } else if (exts.includes(path.extname(res))) {
      yield res
    }
  }
}

async function validateMetadata(metadata: Record<string, string>) {
  const check = (prop: 'prompt' | 'workflow') => {
    const v = metadata?.[prop]
    if (!v) throw `${prop} not found in metadata`
    try {
      JSON.parse(v)
    } catch (error) {
      throw `${prop} invalid json: ${error.message}`
    }
    return v
  }

  return { prompt: check('prompt'), workflow: check('workflow') }
}

async function hasExampleChanged(
  existingFilePath: string,
  exampleJson: string
) {
  return exampleJson !== (await fs.promises.readFile(existingFilePath, 'utf8'))
}

// Example images to ignore as they don't contain workflows
const ignore = [
  'unclip_sunset.png',
  'unclip_mountains.png',
  'inpaint_yosemite_inpaint_example.png',
  'controlnet_shark_depthmap.png',
  'controlnet_pose_worship.png',
  'controlnet_pose_present.png',
  'controlnet_input_scribble_example.png',
  'controlnet_house_scribble.png'
]

// Find all existing examples so we can check if any are removed/changed
const existing = new Set(
  (await fs.promises.readdir(workflowsPath, { withFileTypes: true }))
    .filter((d) => d.isFile())
    .map((d) => path.resolve(workflowsPath, d.name))
)

const results = {
  new: [],
  changed: [],
  unchanged: [],
  missing: [],
  failed: []
}

let total = 0
for await (const file of getFiles(repoPath, '.png', '.flac')) {
  const cleanedName = path
    .relative(repoPath, file)
    .replaceAll('/', '_')
    .replaceAll('\\', '_')

  if (ignore.includes(cleanedName)) continue
  total++

  let metadata: { prompt: string; workflow: string }
  try {
    const { buffer } = await fs.promises.readFile(file)
    switch (path.extname(file)) {
      case '.png':
        metadata = await validateMetadata(getFromPngBuffer(buffer))
        break
      case '.flac':
        metadata = await validateMetadata(getFromFlacBuffer(buffer))
        break
    }

    const outPath = path.resolve(workflowsPath, cleanedName + '.json')
    const exampleJson = JSON.stringify(metadata)
    if (existing.has(outPath)) {
      existing.delete(outPath)
      if (await hasExampleChanged(outPath, exampleJson)) {
        results.changed.push(outPath)
      } else {
        // Unchanged, no point in re-saving
        results.unchanged.push(outPath)
        continue
      }
    } else {
      results.new.push(outPath)
    }

    await fs.promises.writeFile(outPath, exampleJson, 'utf8')
  } catch (error) {
    results.failed.push({ file, error })
  }
}

// Any workflows left in the existing set are now missing, these will want checking and manually removing
results.missing.push(...existing)

const c = (v: number, gt0: 'red' | 'yellow' | 'green') =>
  chalk[v > 0 ? gt0 : 'gray'](v)

console.log(`Processed ${chalk.green(total)} examples`)
console.log(`  ${chalk.gray(results.unchanged.length)} unchanged`)
console.log(`  ${c(results.changed.length, 'yellow')} changed`)
console.log(`  ${c(results.new.length, 'green')} new`)
console.log(`  ${c(results.missing.length, 'red')} missing`)
console.log(`  ${c(results.failed.length, 'red')} failed`)

if (results.missing.length) {
  console.log()
  console.log(
    chalk.red(
      'The following examples are missing and require manual reviewing & removal:'
    )
  )
  for (const m of results.missing) {
    console.log(m)
  }
}

if (results.failed.length) {
  console.log()
  console.log(chalk.red('The following examples failed to extract:'))
  for (const m of results.failed) {
    console.log(m.file)
    console.error(m.error)
    console.log()
  }
}
