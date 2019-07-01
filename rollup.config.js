import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import babel from 'rollup-plugin-babel'
import { uglify } from 'rollup-plugin-uglify'
import banner from 'rollup-plugin-banner'

export default  {
  input: 'src/index.js',
  output: {
    file: 'dist/proxypay.min.js',
    format: 'umd',
    name: 'proxypay',
    globals: {
      eventsource: 'EventSource'
    }
  },
  external: ['eventsource'],
  
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: true
    }),
    commonjs(),
    babel({
      exclude: 'node_modules/**',
      presets: ['@babel/preset-env'],
    }),
    uglify({
      mangle: {
        reserved: ['ProxyPayment', 'bitdb', 'bitindex']
      }
    }),
    banner('Proxypay - v<%= pkg.version %>\n<%= pkg.description %>\n<%= pkg.repository %>\nCopyright © <%= new Date().getFullYear() %> <%= pkg.author %>. MIT License')
  ]
};