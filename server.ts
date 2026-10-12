import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const FASTAPI_PORT = 8000;

const venvPythonWin = path.resolve(__dirname, '.venv', 'Scripts', 'python.exe');
const venvPythonUnix = path.resolve(__dirname, '.venv', 'bin', 'python');
const pyCmd = fs.existsSync(venvPythonWin)
  ? venvPythonWin
  : (fs.existsSync(venvPythonUnix) ? venvPythonUnix : (process.platform === 'win32' ? 'python' : 'python3'));

console.log(`Starting MaintainIQ Python FastAPI backend with ${pyCmd}...`);
const pyProcess = spawn(pyCmd, ['-m', 'uvicorn', 'backend.main:app', '--port', String(FASTAPI_PORT), '--host', '127.0.0.1'], {
  stdio: 'inherit',
  env: { ...process.env }
});

const cleanup = () => {
  try {
    pyProcess.kill();
  } catch (err) {
    // ignore
  }
};

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(); });
process.on('SIGTERM', () => { cleanup(); process.exit(); });

// Proxy /api, /docs, and /openapi.json requests to FastAPI
app.use(createProxyMiddleware({
  target: `http://127.0.0.1:${FASTAPI_PORT}`,
  changeOrigin: true,
  pathFilter: ['/api', '/docs', '/openapi.json'],
}));

async function start() {
  const isProd = process.env.NODE_ENV === 'production';
  
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { port: 24679 },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MaintainIQ full-stack server running on http://0.0.0.0:${PORT}`);
    console.log(`FastAPI documentation available at http://0.0.0.0:${PORT}/docs`);
  });
}

start();
