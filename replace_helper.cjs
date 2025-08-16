const fs = require('fs');

// Read the file
let content = fs.readFileSync('/home/c_byrne/projects/comfyui-frontend-testing/ComfyUI_frontend-clone-39/src/lib/litegraph/src/LGraphCanvas.ts', 'utf8');

// Replace the first occurrence (canvas menu)
content = content.replace(
  /            content: 'Convert to Group Node \\(Deprecated\\) 🧾',\\n            callback: \\(\\) => \\{[^}]+\\n              \\}\\n            \\}\\n          \\},/s,
  `          {
            content: 'Convert to Group Node (Deprecated) 🧾',
            callback: () => {
              // Convert selected nodes to group node using our helper function
              const selectedNodes = Object.values(this.selected_nodes);
              LGraphCanvas.convertSelectedNodesToGroupNode(selectedNodes);
            }
          },`
);

// Replace the second occurrence (node menu)
content = content.replace(
  /          content: 'Convert to Group Node \\(Deprecated\\) 🧾',\\n          callback: \\(\\) => \\{[^}]+\\n              \\}\\n            \\}\\n          \\}/s,
  `        {
          content: 'Convert to Group Node (Deprecated) 🧾',
          callback: () => {
            // Convert selected nodes to group node using our helper function
            const selectedNodes = Object.values(this.selected_nodes);
            LGraphCanvas.convertSelectedNodesToGroupNode(selectedNodes);
          }
        }`
);

// Write the file back
fs.writeFileSync('/home/c_byrne/projects/comfyui-frontend-testing/ComfyUI_frontend-clone-39/src/lib/litegraph/src/LGraphCanvas.ts', content);