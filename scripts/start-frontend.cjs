const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log('[MaintainIQ Frontend] Starting Express and Vite dev server...');

const proc = spawn(npx, ['tsx', 'server.ts'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: true
});

proc.on('close', (code) => {
  console.log(`[MaintainIQ Frontend] Process exited with code ${code}`);
  process.exit(code || 0);
});
