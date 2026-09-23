// @ts-check
// Serves the production build the way Vercel routes it: static files first, then the
// `api/` functions, then the rewrites declared in vercel.json. Unlike `vite preview`,
// there is no implicit SPA fallback, so a missing rewrite shows up as a 404 in tests.

import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import scheduleHandler from '../api/schedule.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');
const DEFAULT_PORT = 4174;
const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
  ['.json', 'application/json; charset=utf-8'],
  ['.ico', 'image/x-icon'],
]);

/**
 * Convert the subset of Vercel's path-to-regexp source syntax used in vercel.json
 * (literal segments and `(.*)` groups) into an anchored RegExp.
 * @param {string} source
 */
export function vercelSourceToRegExp(source) {
  const escaped = source
    .split('(.*)')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('(.*)');
  return new RegExp(`^${escaped}$`);
}

/**
 * @param {{ source: string, destination: string }[]} rewrites
 * @param {string} pathname
 */
export function resolveRewrite(rewrites, pathname) {
  return rewrites.find((rewrite) => vercelSourceToRegExp(rewrite.source).test(pathname))?.destination;
}

/** @param {string} pathname */
async function staticFile(pathname) {
  const candidate = normalize(join(DIST, pathname));
  if (candidate !== DIST && !candidate.startsWith(DIST + sep)) return undefined;
  try {
    const info = await stat(candidate);
    return info.isFile() ? candidate : undefined;
  } catch {
    return undefined;
  }
}

/** @param {import('node:http').ServerResponse} response @param {string} file */
function sendFile(response, file) {
  response.statusCode = 200;
  response.setHeader('Content-Type', CONTENT_TYPES.get(extname(file)) ?? 'application/octet-stream');
  createReadStream(file).pipe(response);
}

/** @param {import('node:http').ServerResponse} response */
function toVercelResponse(response) {
  return {
    /** @param {string} name @param {string} value */
    setHeader: (name, value) => response.setHeader(name, value),
    /** @param {number} code */
    status(code) {
      response.statusCode = code;
      return this;
    },
    /** @param {unknown} body */
    json(body) {
      response.end(JSON.stringify(body));
      return this;
    },
  };
}

async function main() {
  const config = JSON.parse(await readFile(join(ROOT, 'vercel.json'), 'utf8'));
  /** @type {{ source: string, destination: string }[]} */
  const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
  const port = Number(process.env.PORT ?? DEFAULT_PORT);

  const server = createServer(async (request, response) => {
    try {
      const { pathname } = new URL(request.url ?? '/', 'http://localhost');
      const file = await staticFile(pathname === '/' ? '/index.html' : pathname);
      if (file) return sendFile(response, file);
      if (pathname === '/api/schedule') {
        await scheduleHandler(request, toVercelResponse(response));
        return;
      }
      const destination = resolveRewrite(rewrites, pathname);
      const rewritten = destination ? await staticFile(destination) : undefined;
      if (rewritten) return sendFile(response, rewritten);
      response.statusCode = 404;
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.end('404: NOT_FOUND');
    } catch (error) {
      console.error(error);
      if (!response.headersSent) response.statusCode = 500;
      response.end();
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Production build served with vercel.json routing at http://127.0.0.1:${port}`);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
