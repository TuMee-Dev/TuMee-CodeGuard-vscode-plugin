const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/core/index.ts',
  target: 'web',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'core-bundle.js',
    library: {
      name: 'TumeeCore',
      type: 'umd',
      export: 'default'
    }
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      // web-tree-sitter is already browser-compatible
    },
    fallback: {
      // These Node.js modules aren't needed in WASM
      fs: false,
      path: false,
      module: false
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'global': 'window'
    })
  ]
};