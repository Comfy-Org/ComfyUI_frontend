#!/usr/bin/env tsx
import glob from 'fast-glob'
import { cyan, green, magenta, red, yellow } from 'kolorist'
import MagicString from 'magic-string'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

interface ImportError {
  file: string
  line: number
  column: number
  importName: string
  isVue: boolean
}

interface FileToFix {
  ms: MagicString
  imports: Array<{
    name: string
    line: number
    column: number
  }>
  isVue: boolean
}

const parseVueTscOutput = (output: string): ImportError[] => {
  const errors: ImportError[] = []
  const lines = output.split('\n')

  // Pattern for verbatim module syntax errors
  // Example: src/components/actionbar/ComfyActionbar.vue(25,10): error TS1484: 'Ref' is a type...
  const errorPattern =
    /^(.+?)\((\d+),(\d+)\): error TS(1484|1205): '([^']+)' is a type/

  for (const line of lines) {
    const match = errorPattern.exec(line)
    if (match) {
      const [, filePath, lineNum, colNum, , importName] = match
      errors.push({
        file: path.resolve(filePath),
        line: parseInt(lineNum, 10),
        column: parseInt(colNum, 10),
        importName,
        isVue: filePath.endsWith('.vue')
      })
    }
  }

  return errors
}

const runVueTsc = (tsconfigPath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const vueTscPath = path.join(
      process.cwd(),
      'node_modules',
      '.bin',
      'vue-tsc'
    )

    const child = spawn(vueTscPath, ['--noEmit', '-p', tsconfigPath], {
      cwd: process.cwd(),
      shell: true
    })

    let output = ''
    let errorOutput = ''

    child.stdout.on('data', (data) => {
      output += data.toString()
    })

    child.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    child.on('close', (code) => {
      // vue-tsc returns non-zero when there are type errors, which is expected
      // We want the error output which contains the diagnostics
      resolve(errorOutput || output)
    })

    child.on('error', (err) => {
      reject(err)
    })
  })
}

const findImportInLine = (line: string, importName: string): number => {
  // Look for the import name in various import patterns
  const patterns = [
    // import { Name } from
    new RegExp(`\\b${importName}\\b(?=[^']*['"])`),
    // import Name from (default import)
    new RegExp(`import\\s+${importName}\\s+from`),
    // import { Something as Name } from
    new RegExp(`as\\s+${importName}\\b`),
    // export { Name } from
    new RegExp(`export\\s*\\{[^}]*\\b${importName}\\b`)
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(line)
    if (match) {
      return match.index!
    }
  }

  // Fallback: simple indexOf
  return line.indexOf(importName)
}

const fixImports = async (
  errors: ImportError[]
): Promise<Map<string, FileToFix>> => {
  const fileMap = new Map<string, FileToFix>()

  for (const error of errors) {
    if (!fileMap.has(error.file)) {
      const content = fs.readFileSync(error.file, 'utf-8')
      fileMap.set(error.file, {
        ms: new MagicString(content),
        imports: [],
        isVue: error.isVue
      })
    }

    const file = fileMap.get(error.file)!
    file.imports.push({
      name: error.importName,
      line: error.line,
      column: error.column
    })
  }

  // Apply fixes
  for (const [filePath, fileData] of fileMap) {
    const lines = fileData.ms.original.split('\n')

    for (const imp of fileData.imports) {
      const lineIndex = imp.line - 1
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex]

        // Find the actual position of the import name in the line
        const nameIndex = findImportInLine(line, imp.name)

        if (nameIndex >= 0) {
          // Calculate the absolute position in the file
          let absolutePos = 0
          for (let i = 0; i < lineIndex; i++) {
            absolutePos += lines[i].length + 1 // +1 for newline
          }
          absolutePos += nameIndex

          // Check if 'type' isn't already there
          const beforeText = fileData.ms.original.slice(
            Math.max(0, absolutePos - 5),
            absolutePos
          )
          if (!beforeText.includes('type ')) {
            fileData.ms.appendLeft(absolutePos, 'type ')
          }
        }
      }
    }
  }

  return fileMap
}

const main = async () => {
  const args = process.argv.slice(2)
  const isDry = args.includes('--dry')
  const helpRequested = args.includes('--help') || args.includes('-h')

  if (helpRequested) {
    console.log(cyan('🔧 Fix Vue Verbatim Module Syntax'))
    console.log()
    console.log(
      'Usage: npx tsx scripts/fix-vue-verbatim-module-syntax.ts [options] [tsconfig]'
    )
    console.log()
    console.log('Options:')
    console.log(
      '  --dry    Run in dry mode (show what would be fixed without modifying files)'
    )
    console.log('  --help   Show this help message')
    console.log()
    console.log('Examples:')
    console.log('  npx tsx scripts/fix-vue-verbatim-module-syntax.ts')
    console.log('  npx tsx scripts/fix-vue-verbatim-module-syntax.ts --dry')
    console.log(
      '  npx tsx scripts/fix-vue-verbatim-module-syntax.ts tsconfig.app.json'
    )
    return
  }

  // Find tsconfig path argument
  let tsconfigPath = 'tsconfig.json'
  for (const arg of args) {
    if (!arg.startsWith('--') && arg.endsWith('.json')) {
      tsconfigPath = arg
      break
    }
  }

  console.log(
    cyan(
      '🔧 Fixing verbatim module syntax errors in TypeScript and Vue files...'
    )
  )
  console.log(magenta(`Using: ${tsconfigPath}`))
  if (isDry) {
    console.log(yellow('Dry run mode - no files will be modified'))
  }
  console.log()

  try {
    // Run vue-tsc to get all errors
    console.log(cyan('Running vue-tsc to detect errors...'))
    const output = await runVueTsc(tsconfigPath)

    // Parse the errors
    const errors = parseVueTscOutput(output)

    if (errors.length === 0) {
      console.log(green('✨ No verbatim module syntax errors found!'))
      return
    }

    console.log(
      yellow(`Found ${errors.length} import(s) that need 'type' modifier`)
    )
    console.log()

    // Fix the imports
    const fixes = await fixImports(errors)

    const cwd = process.cwd()
    for (const [filePath, fileData] of fixes) {
      if (!isDry) {
        fs.writeFileSync(filePath, fileData.ms.toString())
      }

      const fileType = fileData.isVue ? '(Vue)' : '(TS)'
      console.log(cyan(`${path.relative(cwd, filePath)} ${fileType}`))

      const importNames = fileData.imports.map((imp) => imp.name)
      console.log(
        '  ',
        isDry ? 'Would add type to:' : 'Adding type to:',
        importNames.map((name) => magenta(name)).join(', ')
      )
      console.log()
    }

    const fileCount = fixes.size
    const importCount = Array.from(fixes.values()).reduce(
      (sum, f) => sum + f.imports.length,
      0
    )

    console.log(
      green(
        `✨ ${isDry ? 'Would fix' : 'Fixed'} ${importCount} import${importCount === 1 ? '' : 's'} in ${fileCount} file${fileCount === 1 ? '' : 's'}`
      )
    )
  } catch (error) {
    console.error(red('Error:'), error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Run if executed directly
main().catch((error) => {
  console.error(red('Unhandled error:'), error)
  process.exit(1)
})

export { main as fixVerbatimModuleSyntax }
