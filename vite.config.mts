import { defineConfig, Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import dotenv from "dotenv";
dotenv.config();

const IS_DEV = process.env.NODE_ENV === 'development';

interface ShimResult {
  code: string;
  exports: string[];
}

function comfyAPIPlugin(): Plugin {
  return {
    name: 'comfy-api-plugin',
    transform(code: string, id: string) {
      if (IS_DEV)
        return null;

      // TODO: Remove second condition after all js files are converted to ts
      if (id.endsWith('.ts') || (id.endsWith('.js') && id.includes("extensions/core"))) {
        const result = transformExports(code, id);

        if (result.exports.length > 0) {
          const projectRoot = process.cwd();
          const relativePath = path.relative(path.join(projectRoot, 'src'), id);
          const shimFileName = relativePath.replace(/\.ts$/, '.js');

          const shimComment = `// Shim for ${relativePath}\n`;

          this.emitFile({
            type: "asset",
            fileName: shimFileName,
            source: shimComment + result.exports.join(""),
          });
        }

        return {
          code: result.code,
          map: null  // If you're not modifying the source map, return null
        };
      }
    }
  };
}

function transformExports(code: string, id: string): ShimResult {
  const moduleName = getModuleName(id);
  const exports: string[] = [];
  let newCode = code;

  // Regex to match different types of exports
  const regex = /export\s+(const|let|var|function|class|async function)\s+([a-zA-Z$_][a-zA-Z\d$_]*)(\s|\()/g;
  let match;

  while ((match = regex.exec(code)) !== null) {
    const name = match[2];
    // All exports should be bind to the window object as new API endpoint.
    if (exports.length == 0) {
      newCode += `\nwindow.comfyAPI = window.comfyAPI || {};`;
      newCode += `\nwindow.comfyAPI.${moduleName} = window.comfyAPI.${moduleName} || {};`;
    }
    newCode += `\nwindow.comfyAPI.${moduleName}.${name} = ${name};`;
    exports.push(`export const ${name} = window.comfyAPI.${moduleName}.${name};\n`);
  }

  return {
    code: newCode,
    exports,
  };
}

function getModuleName(id: string): string {
  // Simple example to derive a module name from the file path
  const parts = id.split('/');
  const fileName = parts[parts.length - 1];
  return fileName.replace(/\.\w+$/, '');  // Remove file extension
}

const DEV_SERVER_COMFYUI_URL = process.env.DEV_SERVER_COMFYUI_URL || 'http://127.0.0.1:8188';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: DEV_SERVER_COMFYUI_URL,
        // Return empty array for extensions API as these modules
        // are not on vite's dev server.
        bypass: (req, res, options) => {
          if (req.url === '/api/extensions') {
            res.end(JSON.stringify([]));
          }
          return null;
        },
      },
      '/ws': {
        target: DEV_SERVER_COMFYUI_URL,
        ws: true,
      },
    }
  },
  plugins: [
    vue(),
    comfyAPIPlugin(),
  ],
  build: {
    minify: true,
    sourcemap: true,
    rollupOptions: {
      // Disabling tree-shaking
      // Prevent vite remove unused exports
      treeshake: false
    }
  },
  define: {
    '__COMFYUI_FRONTEND_VERSION__': JSON.stringify(process.env.npm_package_version),
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});