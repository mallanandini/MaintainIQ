const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const venvWin = path.resolve(root, '.venv', 'Scripts', 'python.exe');
const venvUnix = path.resolve(root, '.venv', 'bin', 'python');
const py = fs.existsSync(venvWin) ? venvWin : (fs.existsSync(venvUnix) ? venvUnix : (process.platform === 'win32' ? 'python' : 'python3'));

const res = spawnSync(py, ['-m', 'pytest', 'backend/tests', '-v'], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});

process.exit(res.status || 0);
