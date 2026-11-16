import { createHash } from "node:crypto";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [{
    name: "offline-workspace",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url === "/?test=cloud-fallback") {
          response.setHeader("Permissions-Policy", "language-model=()");
        }
        next();
      });
    },
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((file) => file !== "index.html").sort();
      const assets = ["/", ...files.map((file) => "/" + file)];
      const hash = createHash("sha256").update(JSON.stringify(assets)).digest("hex").slice(0, 12);
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `
const cacheKey = "stockcount-${hash}";
const assets = ${JSON.stringify(assets)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheKey).then((cache) => cache.addAll(assets)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith("stockcount-") && key !== cacheKey)
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate" && url.pathname === "/") {
    event.respondWith(fetch(event.request).catch(() =>
      caches.open(cacheKey).then((cache) => cache.match("/"))));
  } else if (assets.includes(url.pathname)) {
    event.respondWith(caches.open(cacheKey).then(async (cache) =>
      await cache.match(event.request) ?? fetch(event.request)));
  }
});
`,
      });
    },
  }],
});
