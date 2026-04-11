import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPrefix = normalizeApiPrefix(env.EDGEOPS_API_PREFIX);
  const apiHost = env.EDGEOPS_API_HOST || '127.0.0.1';
  const apiPort = env.EDGEOPS_API_PORT || env.EDGEOPS_PORT || '8787';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        [apiPrefix]: {
          target: `http://${apiHost}:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});

function normalizeApiPrefix(value?: string) {
  const trimmed = (value || '/api').trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+$/, '');

  return normalized || '/api';
}
