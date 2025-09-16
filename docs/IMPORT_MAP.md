# Import Map Visualization

This document describes the import map visualization tool for the ComfyUI Frontend project.

## Overview

The import map visualization provides an interactive graph showing all the import dependencies in the ComfyUI Frontend codebase. This helps developers understand:

- Module dependencies and relationships
- Code organization and architecture
- Circular dependencies (if any)
- External package usage
- Module coupling and cohesion

## Viewing the Import Map

Open `docs/import-map.html` in a web browser to view the interactive visualization.

### Features

- **Interactive Graph**: Drag nodes to explore the dependency graph
- **Color-Coded Categories**: Different module types are shown in different colors:
  - 🔴 Components
  - 🔵 Stores
  - 🟢 Services
  - 🟡 Views
  - 🟠 Composables
  - ⚪ Utils
  - 🟣 External packages
  - ⚫ Other modules

- **Search**: Use the search box to find specific files or modules
- **Zoom & Pan**: Navigate through the graph using mouse controls
- **Export**: Export the raw dependency data as JSON

## Generating the Import Map

To regenerate the import map after code changes:

```bash
npx tsx scripts/generate-import-map.ts
```

This will:
1. Scan all TypeScript and Vue files in the `src/` directory
2. Extract import statements
3. Build a dependency graph
4. Generate both JSON data and HTML visualization

### Output Files

- `docs/import-map.json` - Raw dependency data in JSON format
- `docs/import-map.html` - Interactive HTML visualization

## Understanding the Visualization

### Node Size
- Larger nodes indicate modules that are imported by many other modules
- Small nodes are leaf modules with fewer dependents

### Links
- Lines between nodes show import relationships
- Thicker lines indicate multiple imports between the same modules

### Layout
- The graph uses force-directed layout to automatically position nodes
- Highly connected modules tend to cluster together
- External dependencies are typically on the periphery

## Use Cases

### Architecture Review
- Identify architectural patterns and layers
- Spot potential violations of architectural boundaries
- Find opportunities for refactoring

### Dependency Analysis
- Identify heavily used modules that might benefit from optimization
- Find unused or rarely used modules
- Detect circular dependencies

### Onboarding
- Help new developers understand the codebase structure
- Visualize the relationships between different parts of the application
- Identify entry points and core modules

### Performance Optimization
- Find modules that might benefit from code splitting
- Identify heavy external dependencies
- Optimize bundle size by understanding import chains

## Technical Details

The import map generator uses:
- TypeScript AST parsing to extract imports
- D3.js for interactive visualization
- Force-directed graph layout algorithm
- Fast-glob for file system traversal

## Limitations

- Dynamic imports (`import()`) are detected but may not show the full dependency picture
- Conditional imports are shown as always-present dependencies
- Type-only imports are included in the visualization
- The visualization works best with up to ~1000 nodes

## Future Improvements

Potential enhancements for the import map tool:

- [ ] Filter by module type or specific directories
- [ ] Show import cycle detection
- [ ] Display bundle size information
- [ ] Integration with webpack bundle analyzer
- [ ] Real-time updates during development
- [ ] Export to other visualization formats (GraphViz, etc.)
- [ ] Show test file dependencies separately
- [ ] Add metrics dashboard (coupling, cohesion, etc.)

## Contributing

To improve the import map visualization:

1. The generation script is located at `scripts/generate-import-map.ts`
2. The HTML template is embedded in the script
3. Submit PRs with improvements or bug fixes

## Related Documentation

- [Architecture Decision Records](./adr/README.md)
- [Settings System](./SETTINGS.md)
- [Extension Development](./extensions/development.md)