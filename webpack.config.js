//@ts-check
'use strict';

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  devtool: 'nosources-source-map',
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'node_modules/web-tree-sitter/tree-sitter.wasm', to: 'node_modules/web-tree-sitter/tree-sitter.wasm' },
        { from: 'resources/tree-sitter-wasm', to: 'resources/tree-sitter-wasm', noErrorOnMissing: true },
        { from: 'src/tools/colorCustomizer/styles.css', to: 'tools/colorCustomizer/styles.css' },
        { from: 'src/tools/colorCustomizer/webview.js', to: 'tools/colorCustomizer/webview.js' },
        { from: 'resources/preview-lines.json', to: 'resources/preview-lines.json' },
        { from: 'resources/language-scopes.json', to: 'resources/language-scopes.json' },
        { from: 'resources/language-scopes.schema.json', to: 'resources/language-scopes.schema.json' }
      ],
    }),
  ]
};

module.exports = config;