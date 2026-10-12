import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn } from 'child_process';
import path from 'path';

const app = express();
const PORT = 3000;
const FASTAPI_PORT = 8000;

console.log('Starting MaintainIQ Python FastAPI backend...');
const pyProcess = spawn('python3', ['-m', 'uvicorn', 'backend.main:app', '--port', String(FASTAPI_PORT), '--host', '127.0.0.1'], {
  stdio: 'inherit'
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

// Proxy /api requests to FastAPI
app.use('/api', createProxyMiddleware({
  target: `http://127.0.0.1:${FASTAPI_PORT}`,
  changeOrigin: true,
}));

// Proxy /docs and /openapi.json
app.use('/docs', createProxyMiddleware({
  target: `http://127.0.0.1:${FASTAPI_PORT}`,
  changeOrigin: true,
}));
app.use('/openapi.json', createProxyMiddleware({
  target: `http://127.0.0.1:${FASTAPI_PORT}`,
  changeOrigin: true,
}));

async function start() {
  const isProd = process.env.NODE_ENV === 'production';
  
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
