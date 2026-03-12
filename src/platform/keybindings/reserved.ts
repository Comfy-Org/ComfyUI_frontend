export const RESERVED_BY_BROWSER = new Set([
  'Ctrl + t', // New tab (all browsers)
  'Ctrl + w', // Close tab (all browsers)
  'Ctrl + n', // New window (all browsers)
  'Ctrl + Shift + n', // New incognito/private window (all browsers)
  'Ctrl + Tab', // Next tab (all browsers)
  'Ctrl + Shift + Tab', // Previous tab (all browsers)
  'Ctrl + Shift + Delete', // Clear browsing data (Chrome, Edge, Firefox)
  'Ctrl + h', // History (all browsers)
  'Ctrl + j', // Downloads (Chrome, Edge)
  'Ctrl + d', // Bookmark current page (all browsers)
  'Ctrl + Shift + b', // Toggle bookmarks bar (Chrome, Edge)
  'Ctrl + Shift + o', // Bookmarks manager (Chrome, Edge)
  'Ctrl + Shift + i', // DevTools (all browsers)
  'Ctrl + Shift + j', // DevTools console (Chrome, Edge)
  'F5', // Reload page (all browsers)
  'Ctrl + F5', // Hard reload (all browsers)
  'Ctrl + r', // Reload page (all browsers)
  'Ctrl + Shift + r', // Hard reload (all browsers)
  'F7', // Caret browsing (Firefox, Edge)
  'F11', // Toggle fullscreen (all browsers)
  'F12', // DevTools (all browsers)
  'Alt + F4' // Close window (Windows, all browsers)
])

export const RESERVED_BY_TEXT_INPUT = new Set([
  'Ctrl + a',
  'Ctrl + c',
  'Ctrl + v',
  'Ctrl + x',
  'Ctrl + z',
  'Ctrl + y',
  'Ctrl + p',
  'Enter',
  'Shift + Enter',
  'Ctrl + Backspace',
  'Ctrl + Delete',
  'Home',
  'Ctrl + Home',
  'Ctrl + Shift + Home',
  'End',
  'Ctrl + End',
  'Ctrl + Shift + End',
  'PageUp',
  'PageDown',
  'Shift + PageUp',
  'Shift + PageDown',
  'ArrowLeft',
  'Ctrl + ArrowLeft',
  'Shift + ArrowLeft',
  'Ctrl + Shift + ArrowLeft',
  'ArrowRight',
  'Ctrl + ArrowRight',
  'Shift + ArrowRight',
  'Ctrl + Shift + ArrowRight',
  'ArrowUp',
  'Shift + ArrowUp',
  'ArrowDown',
  'Shift + ArrowDown'
])
