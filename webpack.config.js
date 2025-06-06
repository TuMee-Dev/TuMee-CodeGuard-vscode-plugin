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
        { from: 'src/tools/colorCustomizer/styles.css', to: 'tools/colorCustomizer/styles.css' },
        { from: 'src/tools/colorCustomizer/webview.js', to: 'tools/colorCustomizer/webview.js' },
        { from: 'src/tools/colorCustomizer/colorRenderingEngineWebview.js', to: 'tools/colorCustomizer/colorRenderingEngineWebview.js' },
        { from: 'src/tools/colorCustomizer/webviewGuardParser.js', to: 'tools/colorCustomizer/webviewGuardParser.js' },
        { from: 'resources/preview-lines.json', to: 'resources/preview-lines.json' },
        { from: 'resources/vscode.png', to: 'vscode.png' },
      ],
    }),
  ]
};

module.exports = extensionConfig;