const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const venvWin = path.resolve(root, '.venv', 'Scripts', 'python.exe');
const venvUnix = path.resolve(root, '.venv', 'bin', 'python');
const py = fs.existsSync(venvWin) ? venvWin : (fs.existsSync(venvUnix) ? venvUnix : (process.platform === 'win32' ? 'python' : 'python3'));

console.log(`[MaintainIQ Backend] Starting FastAPI with ${py} on port 8000...`);

const args = [
  '-m', 'uvicorn',
  'backend.main:app',
  '--port', '8000',
  '--host', '127.0.0.1',
  '--reload',
  '--reload-dir', 'backend'
];

const proc = spawn(py, args, {
  cwd: root,
  stdio: 'inherit',
  env: process.env
});

proc.on('close', (code) => {
  console.log(`[MaintainIQ Backend] Process exited with code ${code}`);
  process.exit(code || 0);
});
