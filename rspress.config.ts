import * as path from 'node:path';
// AIGC START
import { pluginNodePolyfill } from '@rsbuild/plugin-node-polyfill';
// AIGC END
import { pluginSass } from '@rsbuild/plugin-sass';
import { defineConfig } from '@rspress/core';
import { pluginApiDocgen } from '@rspress/plugin-api-docgen';
import { pluginPreview } from '@rspress/plugin-preview';
import { pluginWorkspaceDev } from 'rsbuild-plugin-workspace-dev';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  title: 'file-view',
  lang: 'zh',
  ssg: false,
  builderConfig: {
    plugins: [
      pluginSass(),
      pluginWorkspaceDev({
        startCurrent: true,
      }),
      // AIGC START
      pluginNodePolyfill(),
      // AIGC END
    ],
  },
  plugins: [
    pluginApiDocgen({
      entries: {
        PdfView: 'src/pdf-view/PdfView.tsx',
      },
      apiParseTool: 'react-docgen-typescript',
    }),
    pluginPreview(),
  ],
});
