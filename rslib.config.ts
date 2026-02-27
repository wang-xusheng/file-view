import path from 'node:path';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';
import { defineConfig } from '@rslib/core';
import rspack from '@rspack/core';

export default defineConfig({
  source: {
    entry: {
      index: ['./src/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  lib: [
    {
      bundle: false,
      dts: true,
      format: 'esm',
    },
  ],
  output: {
    target: 'web',
  },
  tools: {
    rspack: {
      plugins: [
        new rspack.CopyRspackPlugin({
          patterns: [
            {
              from: 'node_modules/pdfjs-dist/cmaps/',
              to: 'pdfjs-dist/cmaps/',
            },
            {
              from: 'node_modules/pdfjs-dist/wasm/',
              to: 'pdfjs-dist/wasm/',
            },
            {
              from: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
              to: 'pdfjs-dist/build/pdf.worker.min.mjs',
            },
            {
              from: 'src/assets/libheif-wasm/libheif.wasm',
              to: 'assets/libheif-wasm/libheif.wasm',
            },
          ],
        }),
      ],
    },
  },
  plugins: [pluginReact(), pluginSass()],
});
