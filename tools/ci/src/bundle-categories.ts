/**
 * Bundle categorization configuration
 *
 * This file defines how bundles are categorized in size reports.
 * Categories help identify which parts of the application are growing.
 */

export interface BundleCategory {
  name: string
  description: string
  patterns: RegExp[]
  order: number
}

const BUNDLE_CATEGORIES: BundleCategory[] = [
  {
    name: 'App Entry Points',
    description: 'Main entry bundles and manifests',
    patterns: [/^index-.*\.js$/i, /^manifest-.*\.js$/i],
    order: 1
  },
  {
    name: 'Graph Workspace',
    description: 'Graph editor runtime, canvas, workflow orchestration',
    patterns: [
      /Graph(View|State)?-.*\.js$/i,
      /(Canvas|Workflow|History|NodeGraph|Compositor)-.*\.js$/i
    ],
    order: 2
  },
  {
    name: 'Views & Navigation',
    description: 'Top-level views, pages, and routed surfaces',
    patterns: [/.*(View|Page|Layout|Screen|Route)-.*\.js$/i],
    order: 3
  },
  {
    name: 'Panels & Settings',
    description: 'Configuration panels, inspectors, and settings screens',
    patterns: [/.*(Panel|Settings|Config|Preferences|Manager)-.*\.js$/i],
    order: 4
  },
  {
    name: 'User & Accounts',
    description: 'Authentication, profile, and account management bundles',
    patterns: [
      /.*((User(Panel|Select|Auth|Account|Profile|Settings|Preferences|Manager|List|Menu|Modal))|Account|Auth|Profile|Login|Signup|Password).*-.+\.js$/i
    ],
    order: 5
  },
  {
    name: 'Editors & Dialogs',
    description: 'Modals, dialogs, drawers, and in-app editors',
    patterns: [/.*(Modal|Dialog|Drawer|Editor)-.*\.js$/i],
    order: 6
  },
  {
    name: 'UI Components',
    description: 'Reusable component library chunks',
    patterns: [
      /.*(Button|Avatar|Badge|Dropdown|Tabs|Table|List|Card|Form|Input|Toggle|Menu|Toolbar|Sidebar)-.*\.js$/i,
      /.*\.vue_vue_type_script_setup_true_lang-.*\.js$/i
    ],
    order: 7
  },
  {
    name: 'Data & Services',
    description: 'Stores, services, APIs, and repositories',
    patterns: [/.*(Service|Store|Api|Repository)-.*\.js$/i],
    order: 8
  },
  {
    name: 'Utilities & Hooks',
    description: 'Helpers, composables, and utility bundles',
    patterns: [
      /.*(Util|Utils|Helper|Composable|Hook)-.*\.js$/i,
      /use[A-Z].*\.js$/
    ],
    order: 9
  },
  {
    name: 'Vendor & Third-Party',
    description: 'External libraries and shared vendor chunks',
    patterns: [
      /^(chunk|vendor|prime|three|lodash|chart|firebase|yjs|axios|uuid)-.*\.js$/i
    ],
    order: 10
  },
  {
    name: 'Other',
    description: 'Bundles that do not match a named category',
    patterns: [/.*/],
    order: 99
  }
]

export function categorizeBundle(fileName: string): string {
  const baseName = fileName.split('/').pop() || fileName
  const match = BUNDLE_CATEGORIES.find((category) =>
    category.patterns.some((pattern) => pattern.test(baseName))
  )
  return match?.name ?? 'Other'
}

export function getCategoryMetadata(
  categoryName: string
): BundleCategory | undefined {
  return BUNDLE_CATEGORIES.find((cat) => cat.name === categoryName)
}
