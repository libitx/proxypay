import babel from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import { terser } from "rollup-plugin-terser";
import banner from 'rollup-plugin-banner'

export default  {
  input: 'src/index.js',
  output: {
    file: 'dist/proxypay.min.js',
    format: 'umd',
    name: 'proxypay',
    globals: {
      bsv: 'bsv'
    }
  },
  external: ['bsv'],
  
  plugins: [
    resolve({
      browser: true
    }),
    commonjs(),
    babel({
      exclude: 'node_modules/**',
      presets: ['@babel/preset-env'],
    }),
    terser(),
    banner('Proxypay - v<%= pkg.version %>\n<%= pkg.description %>\n<%= pkg.repository %>\nCopyright © <%= new Date().getFullYear() %> <%= pkg.author %>. MIT License')
  ]
};