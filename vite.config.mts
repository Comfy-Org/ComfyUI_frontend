import { defineConfig } from 'vite';
import noBundlePlugin from 'vite-plugin-no-bundle';


export default defineConfig({
	server: {
		open: true,
		proxy: {
			// Proxy websocket requests to the server
			'/': {
				target: 'ws://127.0.0.1:8188',
				ws: true,
			}
		}
	},
	plugins: [noBundlePlugin({
		copy: [
			'**/*.css',
			'lib/*.js',
			// Make sure to include all core extensions, as they are loaded dynamically
			'extensions/core/*.js',
			// Include modules only used by core extensions
			'scripts/ui/draggableList.js',
		]
	})],
	build: {
		lib: {
			formats: ['es'],
			entry: 'index.html',
		},
		minify: false,
		rollupOptions: {
			// Disabling tree-shaking
			// Prevent vite remove unused exports
			treeshake: false
		}
	},
});