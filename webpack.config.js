const path = require('path');
const version = require('./package.json').version;

module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: `lnurl-nfc-v${version}.js`,
    path: path.resolve(__dirname, 'dist'),
    library: {
      type: 'umd',
    },
  },
};
