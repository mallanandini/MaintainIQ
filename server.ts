import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';
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

let pyProcess: ChildProcess | null = null;
let spawnedByUs = false;

function isPortActive(port: number, host: string = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

const cleanup = () => {
  if (spawnedByUs && pyProcess && pyProcess.pid) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(pyProcess.pid), '/f', '/t']);
      } else {
        pyProcess.kill();
      }
    } catch {
      // Ignore cleanup error
    }
  }
};

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(); });
process.on('SIGTERM', () => { cleanup(); process.exit(); });

// Proxy /api, /docs, and /openapi.json requests to FastAPI with resilient error handling
app.use(createProxyMiddleware({
  target: `http://127.0.0.1:${FASTAPI_PORT}`,
  changeOrigin: true,
  pathFilter: ['/api', '/docs', '/openapi.json'],
  on: {
    error: (err, _req, res) => {
      if (res && 'writeHead' in res && !(res as any).headersSent) {
        (res as any).writeHead(503, { 'Content-Type': 'application/json' });
        (res as any).end(JSON.stringify({
          status: 'error',
          code: 'BACKEND_UNAVAILABLE',
          message: `FastAPI service on port ${FASTAPI_PORT} is not responding or currently reloading.`,
          detail: err.message
        }));
      }
    }
  }
}));

async function start() {
  const isProd = process.env.NODE_ENV === 'production';

  // 1. Check if backend is already running on port 8000
  const backendActive = await isPortActive(FASTAPI_PORT);
  if (backendActive) {
    console.log(`[MaintainIQ] FastAPI backend detected active on http://127.0.0.1:${FASTAPI_PORT}. Connecting proxy.`);
  } else {
    console.log(`[MaintainIQ] FastAPI backend not detected on port ${FASTAPI_PORT}. Spawning with ${pyCmd}...`);
    pyProcess = spawn(pyCmd, ['-m', 'uvicorn', 'backend.main:app', '--port', String(FASTAPI_PORT), '--host', '127.0.0.1', '--reload', '--reload-dir', 'backend'], {
      stdio: 'inherit',
      env: { ...process.env }
    });
    spawnedByUs = true;
  }

  // 2. Setup Vite dev middleware or static production serve
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

  // 3. Listen on PORT 3001 with collision check
  const server = app.listen(PORT, () => {
    console.log(`[MaintainIQ] Full-stack application ready at http://localhost:${PORT}`);
    console.log(`[MaintainIQ] Interactive Swagger API documentation: http://localhost:${PORT}/docs`);
    console.log(`[MaintainIQ] Standalone FastAPI service URL: http://127.0.0.1:${FASTAPI_PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[MaintainIQ ERROR] Port ${PORT} is already occupied by another process.`);
      console.error(`Please stop the existing process on port ${PORT} (e.g. run '.\\stop-dev.ps1') before restarting.\n`);
      process.exit(1);
    } else {
      console.error(`[MaintainIQ ERROR] Failed to start server:`, err);
      process.exit(1);
    }
  });
}

start();
