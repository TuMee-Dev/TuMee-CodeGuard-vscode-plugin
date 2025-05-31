//@ts-check
'use strict';

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

/**@type {import('webpack').Configuration}*/
const extensionConfig = {
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
        { from: 'src/tools/colorCustomizer/colorRenderingEngineWebview.js', to: 'tools/colorCustomizer/colorRenderingEngineWebview.js' },
        { from: 'src/tools/colorCustomizer/webviewGuardParser.js', to: 'tools/colorCustomizer/webviewGuardParser.js' },
        { from: 'resources/preview-lines.json', to: 'resources/preview-lines.json' },
        { from: 'resources/language-scopes.json', to: 'resources/language-scopes.json' },
        { from: 'resources/language-scopes.schema.json', to: 'resources/language-scopes.schema.json' },
        { from: 'resources/themes.json', to: 'resources/themes.json' },
        { from: 'resources/validation-report-template.html', to: 'resources/validation-report-template.html' }
      ],
    }),
  ]
};

/**@type {import('webpack').Configuration}*/
const cliConfig = {
  target: 'node',
  mode: 'none',
  entry: './src/cli/visualguard.ts',
  output: {
    path: path.resolve(__dirname, 'dist/cli'),
    filename: 'visualguard.js',
    libraryTarget: 'commonjs2'
  },
  devtool: 'nosources-source-map',
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'vscode': path.resolve(__dirname, 'src/cli/vscode-mock.ts')
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
    new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true })
  ]
};

module.exports = [extensionConfig, cliConfig];