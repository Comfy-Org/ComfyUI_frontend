import { danger, fail } from 'danger'

// Check if we should run the checks
const shouldRunChecks = async () => {
  const allChangedFiles = [...danger.git.modified_files, ...danger.git.created_files]
  const srcChanges = allChangedFiles.filter(file => file.startsWith('src/'))
  
  if (srcChanges.length === 0) {
    return false
  }
  
  // Check total lines changed in src files
  let totalLinesChanged = 0
  for (const file of srcChanges) {
    const diff = await danger.git.diffForFile(file)
    if (diff) {
      const additions = (diff.added?.match(/\n/g) || []).length
      const deletions = (diff.removed?.match(/\n/g) || []).length
      totalLinesChanged += additions + deletions
    }
  }
  
  return totalLinesChanged > 3
}

// Check if browser tests were updated
const checkBrowserTestCoverage = () => {
  const allChangedFiles = [...danger.git.modified_files, ...danger.git.created_files]
  const hasBrowserTestChanges = allChangedFiles.some(file => 
    file.startsWith('browser_tests/') && file.endsWith('.ts')
  )
  
  if (!hasBrowserTestChanges) {
    fail(`🧪 **E2E Test Coverage Missing**

All changes should be covered under E2E testing. Please add or update browser tests.`)
  }
}

// Check for screen recording in PR description
const checkScreenRecording = () => {
  const description = danger.github.pr.body || ''
  const hasRecording = 
    /github\.com\/user-attachments\/assets\/[a-f0-9-]+/i.test(description) ||
    /youtube\.com\/watch|youtu\.be\//i.test(description)
  
  if (!hasRecording) {
    fail(`📹 **Visual Documentation Missing**

Please add a screen recording or screenshot:
- GitHub: Drag & drop media to PR description  
- YouTube: Add YouTube link`)
  }
}

// Run the checks only if conditions are met
shouldRunChecks().then(shouldRun => {
  if (shouldRun) {
    checkBrowserTestCoverage()
    checkScreenRecording()
  }
})