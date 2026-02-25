import * as path from 'node:path';
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
