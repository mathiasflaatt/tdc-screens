import { defineConfig } from 'vite';
import scheduleHandler from './api/schedule.js';

function scheduleApiPlugin() {
  const install = (server) => {
    server.middlewares.use((request, response, next) => {
      let pathname;
      try {
        pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      } catch {
        return next();
      }
      if (pathname !== '/api/schedule') return next();

      const vercelResponse = {
        setHeader: (name, value) => response.setHeader(name, value),
        status(code) {
          response.statusCode = code;
          return this;
        },
        json(body) {
          response.end(JSON.stringify(body));
          return this;
        },
      };

      void scheduleHandler(request, vercelResponse).catch(next);
    });
  };

  return {
    name: 'local-schedule-api',
    configureServer: install,
    configurePreviewServer: install,
  };
}

export default defineConfig({ plugins: [scheduleApiPlugin()] });
