const { build } = require('esbuild');
const path = require('path');

// Build the core module to a single JS file first
build({
  entryPoints: ['./src/core/index.ts'],
  bundle: true,
  outfile: './dist/core-bundle.js',
  platform: 'neutral',
  format: 'esm',
  target: 'es2020',
  external: [],
  define: {
    'process.env.NODE_ENV': '"production"'
  }
}).then(() => {
  console.log('Core module bundled successfully');
  console.log('Now you can use a tool like Javy or js2wasm to compile to WASM');
}).catch(() => process.exit(1));