import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Переменные окружения сборки, по которым видно ветку/коммит/PR.
const INTERESTING_ENV = /(BRANCH|COMMIT|SHA|REF|PR_|PULL|PREVIEW|STAND|DEPLOY|TWC|TIMEWEB|APP_|GIT|BUILD|NODE_ENV|VITE_)/i;
const SECRET_ENV = /(TOKEN|SECRET|PASSWORD|PASSWD|KEY|CREDENTIAL|AUTH)/i;

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

function buildEnv() {
  const result = {};
  for (const name of Object.keys(process.env).sort()) {
    if (!INTERESTING_ENV.test(name)) continue;
    result[name] = SECRET_ENV.test(name) ? '***скрыто***' : process.env[name];
  }
  return result;
}

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_INFO__: JSON.stringify({
      builtAt: new Date().toISOString(),
      gitBranch: git('rev-parse --abbrev-ref HEAD'),
      gitCommit: git('rev-parse HEAD'),
      gitCommitMessage: git('log -1 --pretty=%s'),
      env: buildEnv(),
    }),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
