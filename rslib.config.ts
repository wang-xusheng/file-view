import path from 'node:path';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';
import { defineConfig } from '@rslib/core';
import rspack from '@rspack/core';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  lib: [
    {
      bundle: true,
      dts: true,
      format: 'esm',
      source: {
        entry: {
          index: './src/index.tsx',
        },
      },
      output: {
        target: 'web',
      },
    },
    {
      bundle: true,
      format: 'esm',
      autoExternal: false,
      source: {
        entry: {
          'heic-worker': './src/workers/heic-worker.ts',
        },
      },
      output: {
        target: 'web',
      },
    },
  ],
  tools: {
    rspack: {
      plugins: [
        new rspack.CopyRspackPlugin({
          patterns: [
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
