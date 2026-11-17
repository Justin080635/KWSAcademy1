import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const canonicalAssessmentJsonPath = path.resolve(
    __dirname,
    'content/assessment.json'
  );

  return {
    plugins: [
      {
        name: 'strip-internal-assessment-scoring',
        enforce: 'pre',
        load(id, options) {
          if (options?.ssr) return null;
          const cleanId = id.split('?', 1)[0];
          if (path.resolve(cleanId) !== canonicalAssessmentJsonPath) {
            return null;
          }
          const raw = fs.readFileSync(canonicalAssessmentJsonPath, 'utf8');
          const parsed = JSON.parse(raw) as {
            contentVersion?: string;
            source?: string;
            partA?: unknown;
            partB?: unknown;
            partC?: {
              cards?: Array<Record<string, unknown>>;
            };
            partD?: unknown;
          };
          const sanitized = {
            contentVersion: parsed.contentVersion,
            source: parsed.source,
            partA: parsed.partA,
            partB: parsed.partB,
            partC: {
              cards: (parsed.partC?.cards ?? []).map((card) => {
                const { correctUnderstandingKey: _omit, ...publicCard } = card;
                return publicCard;
              }),
            },
            partD: parsed.partD,
          };
          return JSON.stringify(sanitized);
        },
      },
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
