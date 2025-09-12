/**
 * ES Module loader for Vue files and service mocks in Node.js
 * Used during i18n collection to stub Vue component imports and services with Vue dependencies
 */

export async function resolve(specifier, context, nextResolve) {
  // Mock dialogService to avoid Vue imports
  if (specifier.endsWith('/dialogService') || specifier.endsWith('/dialogService.ts')) {
    const mockPath = new URL('../scripts/mocks/dialogService.ts', import.meta.url)
    return {
      url: mockPath.href,
      shortCircuit: true
    }
  }
  
  // Pass through for non-Vue files
  if (!specifier.endsWith('.vue')) {
    return nextResolve(specifier, context)
  }
  
  // Resolve Vue files normally
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  // Handle mock files
  if (url.includes('/scripts/mocks/')) {
    return nextLoad(url, context)
  }
  
  // Handle CSS files - return empty module
  if (url.endsWith('.css')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export default {}'
    }
  }
  
  // Only handle .vue files
  if (!url.endsWith('.vue')) {
    return nextLoad(url, context)
  }
  
  // Return a stub Vue component as JavaScript
  const componentName = url.split('/').pop().replace('.vue', '')
  
  const stubComponent = `
    export default {
      name: '${componentName}',
      render: () => null,
      props: {},
      setup: () => ({}),
      template: '<div></div>'
    }
  `
  
  return {
    format: 'module',
    shortCircuit: true,
    source: stubComponent
  }
}