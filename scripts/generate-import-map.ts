#!/usr/bin/env tsx

import fs from 'fs'
import path from 'path'
import glob from 'fast-glob'

interface ImportInfo {
  source: string
  imports: string[]
}

interface DependencyGraph {
  nodes: Array<{
    id: string
    label: string
    group: string
    size: number
  }>
  links: Array<{
    source: string
    target: string
    value: number
  }>
}

// Extract imports from a TypeScript/Vue file
function extractImports(filePath: string): ImportInfo {
  const content = fs.readFileSync(filePath, 'utf-8')
  const imports: string[] = []
  
  // Match ES6 import statements
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g
  let match
  
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1])
  }
  
  // Also match dynamic imports
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.push(match[1])
  }
  
  return {
    source: filePath,
    imports: [...new Set(imports)] // Remove duplicates
  }
}

// Categorize file by its path
function getFileGroup(filePath: string): string {
  const relativePath = path.relative(process.cwd(), filePath)
  
  if (relativePath.includes('node_modules')) return 'external'
  if (relativePath.startsWith('src/components')) return 'components'
  if (relativePath.startsWith('src/stores')) return 'stores'
  if (relativePath.startsWith('src/services')) return 'services'
  if (relativePath.startsWith('src/views')) return 'views'
  if (relativePath.startsWith('src/composables')) return 'composables'
  if (relativePath.startsWith('src/utils')) return 'utils'
  if (relativePath.startsWith('src/types')) return 'types'
  if (relativePath.startsWith('src/extensions')) return 'extensions'
  if (relativePath.startsWith('src/lib')) return 'lib'
  if (relativePath.startsWith('src/scripts')) return 'scripts'
  if (relativePath.startsWith('tests')) return 'tests'
  if (relativePath.startsWith('browser_tests')) return 'browser_tests'
  
  return 'other'
}

// Resolve import path to actual file
function resolveImportPath(importPath: string, sourceFile: string): string {
  // Handle aliases
  if (importPath.startsWith('@/')) {
    return path.join(process.cwd(), 'src', importPath.slice(2))
  }
  
  // Handle relative paths
  if (importPath.startsWith('.')) {
    const sourceDir = path.dirname(sourceFile)
    return path.resolve(sourceDir, importPath)
  }
  
  // External module
  return importPath
}

// Generate dependency graph
async function generateDependencyGraph(): Promise<DependencyGraph> {
  const sourceFiles = await glob('src/**/*.{ts,tsx,vue,mts}', {
    ignore: ['**/node_modules/**', '**/*.d.ts', '**/*.spec.ts', '**/*.test.ts', '**/*.stories.ts']
  })
  
  const nodes = new Map<string, { id: string; label: string; group: string; size: number }>()
  const links = new Map<string, { source: string; target: string; value: number }>()
  
  // Process each file
  for (const file of sourceFiles) {
    const importInfo = extractImports(file)
    const sourceId = path.relative(process.cwd(), file)
    
    // Add source node
    if (!nodes.has(sourceId)) {
      nodes.set(sourceId, {
        id: sourceId,
        label: path.basename(file),
        group: getFileGroup(file),
        size: 1
      })
    }
    
    // Process imports
    for (const importPath of importInfo.imports) {
      const resolvedPath = resolveImportPath(importPath, file)
      let targetId: string
      
      // Check if it's an external module
      if (!resolvedPath.startsWith('/') && !resolvedPath.startsWith('.')) {
        targetId = `external:${importPath}`
        if (!nodes.has(targetId)) {
          nodes.set(targetId, {
            id: targetId,
            label: importPath,
            group: 'external',
            size: 1
          })
        }
      } else {
        // Try to find the actual file
        const possibleExtensions = ['.ts', '.tsx', '.vue', '.mts', '.js', '.json', '/index.ts', '/index.js']
        let actualFile = resolvedPath
        
        for (const ext of possibleExtensions) {
          if (fs.existsSync(resolvedPath + ext)) {
            actualFile = resolvedPath + ext
            break
          }
        }
        
        if (fs.existsSync(actualFile)) {
          targetId = path.relative(process.cwd(), actualFile)
          if (!nodes.has(targetId)) {
            nodes.set(targetId, {
              id: targetId,
              label: path.basename(actualFile),
              group: getFileGroup(actualFile),
              size: 1
            })
          }
        } else {
          continue // Skip unresolved imports
        }
      }
      
      // Add link
      const linkKey = `${sourceId}->${targetId}`
      if (links.has(linkKey)) {
        links.get(linkKey)!.value++
      } else {
        links.set(linkKey, {
          source: sourceId,
          target: targetId,
          value: 1
        })
      }
      
      // Increase target node size
      const targetNode = nodes.get(targetId)
      if (targetNode) {
        targetNode.size++
      }
    }
  }
  
  return {
    nodes: Array.from(nodes.values()),
    links: Array.from(links.values())
  }
}

// Generate HTML visualization
function generateHTML(graph: DependencyGraph): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ComfyUI Frontend Import Map</title>
  <script src="https://unpkg.com/d3@7"></script>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      color: #fff;
    }
    
    #container {
      display: flex;
      height: 100vh;
    }
    
    #graph {
      flex: 1;
      position: relative;
    }
    
    #sidebar {
      width: 300px;
      background: #2a2a2a;
      padding: 20px;
      overflow-y: auto;
      border-left: 1px solid #3a3a3a;
    }
    
    h1 {
      margin: 0 0 20px 0;
      font-size: 1.5em;
      color: #fff;
    }
    
    .stats {
      margin-bottom: 30px;
    }
    
    .stat-item {
      display: flex;
      justify-content: space-between;
      margin: 10px 0;
      padding: 8px;
      background: #1a1a1a;
      border-radius: 4px;
    }
    
    .legend {
      margin-top: 30px;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      margin: 8px 0;
    }
    
    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 10px;
    }
    
    .controls {
      margin-top: 30px;
    }
    
    button {
      display: block;
      width: 100%;
      padding: 10px;
      margin: 10px 0;
      background: #4a4a4a;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    
    button:hover {
      background: #5a5a5a;
    }
    
    .node-tooltip {
      position: absolute;
      padding: 10px;
      background: rgba(0, 0, 0, 0.9);
      color: #fff;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s;
      z-index: 1000;
      max-width: 300px;
    }
    
    .search-box {
      width: 100%;
      padding: 10px;
      margin: 20px 0;
      background: #1a1a1a;
      color: #fff;
      border: 1px solid #3a3a3a;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .highlighted {
      stroke: #ff0 !important;
      stroke-width: 3px !important;
    }
  </style>
</head>
<body>
  <div id="container">
    <div id="graph">
      <svg id="svg"></svg>
      <div class="node-tooltip"></div>
    </div>
    <div id="sidebar">
      <h1>Import Map</h1>
      
      <div class="stats">
        <div class="stat-item">
          <span>Total Files:</span>
          <span id="total-nodes">${graph.nodes.length}</span>
        </div>
        <div class="stat-item">
          <span>Total Dependencies:</span>
          <span id="total-links">${graph.links.length}</span>
        </div>
      </div>
      
      <input type="text" class="search-box" placeholder="Search files..." id="search">
      
      <div class="legend">
        <h3>Categories</h3>
        <div class="legend-item">
          <div class="legend-color" style="background: #ff6b6b;"></div>
          <span>Components</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #4ecdc4;"></div>
          <span>Stores</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #45b7d1;"></div>
          <span>Services</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #96ceb4;"></div>
          <span>Views</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #ffeaa7;"></div>
          <span>Composables</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #dfe6e9;"></div>
          <span>Utils</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #fab1a0;"></div>
          <span>Types</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #a29bfe;"></div>
          <span>External</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #636e72;"></div>
          <span>Other</span>
        </div>
      </div>
      
      <div class="controls">
        <button onclick="resetZoom()">Reset View</button>
        <button onclick="toggleSimulation()">Toggle Physics</button>
        <button onclick="exportData()">Export Data</button>
      </div>
    </div>
  </div>
  
  <script>
    const graphData = ${JSON.stringify(graph, null, 2)};
    
    // Color scheme for different groups
    const colorScale = d3.scaleOrdinal()
      .domain(['components', 'stores', 'services', 'views', 'composables', 'utils', 'types', 'external', 'other'])
      .range(['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#fab1a0', '#a29bfe', '#636e72']);
    
    // Setup SVG
    const width = window.innerWidth - 300;
    const height = window.innerHeight;
    
    const svg = d3.select('#svg')
      .attr('width', width)
      .attr('height', height);
    
    const g = svg.append('g');
    
    // Setup zoom
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    svg.call(zoom);
    
    // Create force simulation
    const simulation = d3.forceSimulation(graphData.nodes)
      .force('link', d3.forceLink(graphData.links)
        .id(d => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => Math.sqrt(d.size) * 5));
    
    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(graphData.links)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.value));
    
    // Create nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(graphData.nodes)
      .enter().append('circle')
      .attr('r', d => Math.sqrt(d.size) * 3 + 3)
      .attr('fill', d => colorScale(d.group))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .call(drag(simulation));
    
    // Add labels for important nodes
    const label = g.append('g')
      .selectAll('text')
      .data(graphData.nodes.filter(d => d.size > 10))
      .enter().append('text')
      .text(d => d.label)
      .style('font-size', '10px')
      .style('fill', '#fff')
      .attr('dx', 15)
      .attr('dy', 4);
    
    // Tooltip
    const tooltip = d3.select('.node-tooltip');
    
    node.on('mouseover', (event, d) => {
      const connections = graphData.links.filter(l => l.source.id === d.id || l.target.id === d.id);
      tooltip
        .style('opacity', 1)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .html(\`
          <strong>\${d.label}</strong><br>
          Type: \${d.group}<br>
          Connections: \${connections.length}<br>
          Path: \${d.id}
        \`);
    })
    .on('mouseout', () => {
      tooltip.style('opacity', 0);
    });
    
    // Update positions
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
      
      label
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });
    
    // Drag behavior
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      
      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      
      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      
      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }
    
    // Search functionality
    document.getElementById('search').addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      
      node.classed('highlighted', false);
      
      if (searchTerm) {
        node.classed('highlighted', d => 
          d.label.toLowerCase().includes(searchTerm) || 
          d.id.toLowerCase().includes(searchTerm)
        );
      }
    });
    
    // Control functions
    let simulationRunning = true;
    
    function resetZoom() {
      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);
    }
    
    function toggleSimulation() {
      if (simulationRunning) {
        simulation.stop();
      } else {
        simulation.restart();
      }
      simulationRunning = !simulationRunning;
    }
    
    function exportData() {
      const dataStr = JSON.stringify(graphData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = 'import-map.json';
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }
    
    // Resize handler
    window.addEventListener('resize', () => {
      const newWidth = window.innerWidth - 300;
      const newHeight = window.innerHeight;
      
      svg.attr('width', newWidth).attr('height', newHeight);
      simulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2));
      simulation.alpha(0.3).restart();
    });
  </script>
</body>
</html>`
}

// Main function
async function main() {
  console.log('Generating import map...')
  
  try {
    const graph = await generateDependencyGraph()
    console.log(`Found ${graph.nodes.length} nodes and ${graph.links.length} dependencies`)
    
    // Save JSON data
    const jsonPath = path.join(process.cwd(), 'docs', 'import-map.json')
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true })
    fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2))
    console.log(`Saved JSON data to ${jsonPath}`)
    
    // Generate and save HTML visualization
    const html = generateHTML(graph)
    const htmlPath = path.join(process.cwd(), 'docs', 'import-map.html')
    fs.writeFileSync(htmlPath, html)
    console.log(`Saved HTML visualization to ${htmlPath}`)
    
    console.log('✅ Import map generation complete!')
    console.log('Open docs/import-map.html in a browser to view the visualization')
  } catch (error) {
    console.error('Error generating import map:', error)
    process.exit(1)
  }
}

void main()