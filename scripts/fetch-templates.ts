import fs from 'fs-extra'
import { execSync } from 'node:child_process'
import path from 'node:path'

const workflowTemplatesRepo = 'https://github.com/Comfy-Org/workflow_templates'
const tempRepoDir = './templates_repo'

// Clone the repository
execSync(`git clone ${workflowTemplatesRepo} --depth 1 ${tempRepoDir}`)

// Create public/templates directory if it doesn't exist
fs.ensureDirSync('public/templates')

// Copy templates from repo to public/templates
const sourceDir = path.join(tempRepoDir, 'templates')
const targetDir = 'public/templates'

// Copy entire directory at once
fs.copySync(sourceDir, targetDir)

// Remove the temporary repository directory
fs.removeSync(tempRepoDir)

console.log('Templates fetched successfully')
