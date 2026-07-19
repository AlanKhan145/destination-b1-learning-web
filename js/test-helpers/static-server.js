// static-server.js
// Minimal static file server used only by tests, so question-loader.js and
// review-engine.js (which fetch() relative paths like "./data/...") can be
// exercised the same way a browser would load them — no test-only branches
// in the modules themselves, and no dependency on a dev server already running.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const CONTENT_TYPES = { ".json": "application/json", ".js": "text/javascript", ".html": "text/html", ".css": "text/css" };

async function startStaticServer() {
  const server = createServer(async (req, res) => {
    try {
      const requestedPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const filePath = path.join(PROJECT_ROOT, requestedPath);

      if (!filePath.startsWith(PROJECT_ROOT)) {
        res.writeHead(403).end();
        return;
      }

      const stats = await stat(filePath).catch(() => null);
      if (!stats || !stats.isFile()) {
        res.writeHead(404).end();
        return;
      }

      const body = await readFile(filePath);
      const contentType = CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType }).end(body);
    } catch (error) {
      res.writeHead(500).end(String(error));
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

/**
 * Patches global.fetch so relative URLs ("./data/...") resolve against
 * `baseUrl`, exactly like a browser resolves them against the page origin.
 * Returns a function that restores the original fetch.
 */
function withRelativeFetch(baseUrl) {
  const originalFetch = global.fetch;
  global.fetch = (input, init) => originalFetch(new URL(input, baseUrl), init);
  return () => {
    global.fetch = originalFetch;
  };
}

/**
 * Minimal in-memory localStorage polyfill for tests (Node has no global
 * localStorage). Real browsers provide the real thing; review-engine.js only
 * ever calls the Web Storage methods used here.
 */
function withMemoryLocalStorage() {
  const original = global.localStorage;
  const data = new Map();

  global.localStorage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear()
  };

  return () => {
    global.localStorage = original;
  };
}

export { startStaticServer, withRelativeFetch, withMemoryLocalStorage };
