import { danger, fail } from 'danger'

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

// Run the checks
checkBrowserTestCoverage()
checkScreenRecording()