import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

import {
  extractInternalLinks,
  isMirrorablePath,
  normalizePath,
} from "../../papermark/marketing/route-utils.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const BASE = "https://www.papermark.com";
const agent = new https.Agent({ rejectUnauthorized: false });

const SEED_PAGES = [
  "/",
  "/pricing",
  "/data-room",
  "/security",
  "/customers",
  "/blog",
  "/agents",
  "/de",
  "/es",
  "/fr",
  "/about",
  "/docs",
  "/help",
  "/alternatives",
  "/changelog",
  "/privacy",
  "/terms",
];

const MAX_PAGES = 300;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fetchText(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      https
        .get(
          url,
          {
            agent,
            headers: {
              "User-Agent": "Mozilla/5.0",
              "Accept-Language": "en-US,en;q=0.9",
            },
          },
          (res) => {
            if ([301, 302, 307, 308].includes(res.statusCode)) {
              const location = res.headers.location;
              const next = location.startsWith("http")
                ? location
                : `${BASE}${location}`;
              return fetchText(next, left).then(resolve).catch(reject);
            }
            if (res.statusCode === 503 && left > 0) {
              return sleep(2000).then(() => attempt(left - 1));
            }
            if (res.statusCode !== 200) {
              reject(new Error(`${url} -> ${res.statusCode}`));
              return;
            }
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
          },
        )
        .on("error", (error) => {
          if (left > 0) return sleep(1500).then(() => attempt(left - 1));
          reject(error);
        });
    };
    attempt(retries);
  });
}

function fetchFile(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      https
        .get(url, { agent, headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
          if ([301, 302, 307, 308].includes(res.statusCode)) {
            const location = res.headers.location;
            const next = location.startsWith("http")
              ? location
              : `${BASE}${location}`;
            return fetchFile(next, left).then(resolve).catch(reject);
          }
          if (res.statusCode === 503 && left > 0) {
            return sleep(2000).then(() => attempt(left - 1));
          }
          if (res.statusCode !== 200) {
            reject(new Error(`${url} -> ${res.statusCode}`));
            return;
          }
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => resolve(Buffer.concat(chunks)));
        })
        .on("error", (error) => {
          if (left > 0) return sleep(1500).then(() => attempt(left - 1));
          reject(error);
        });
    };
    attempt(retries);
  });
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\u0026/gi, "&");
}

function cleanAssetUrl(raw) {
  let url = decodeHtmlEntities(raw.trim().replace(/^['"]|['"]$/g, ""));
  if (!url || url.startsWith("data:")) return null;
  if (url.includes("&") && !url.includes("?")) {
    url = url.split("&")[0];
  }
  url = url.split("?")[0].split("#")[0];
  if (url.startsWith("//")) url = `https:${url}`;
  if (url.startsWith("/")) url = `${BASE}${url}`;
  return url;
}

function collectAssetUrls(html) {
  const found = new Set();
  const patterns = [
    /(?:href|src)=["']([^"']+)["']/g,
    /url\(([^)]+)\)/g,
    /imageSrcSet="([^"]+)"/g,
    /content="(https:\/\/www\.papermark\.com[^"]+)"/g,
    /\/_next\/image\?url=([^&"']+)/g,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const raw = match[1];

      if (pattern.source.includes("imageSrcSet")) {
        for (const part of raw.split(",")) {
          const url = cleanAssetUrl(part.trim().split(/\s+/)[0]);
          if (url) found.add(url);
        }
        continue;
      }

      if (pattern.source.includes("_next\\/image")) {
        const decoded = decodeURIComponent(decodeHtmlEntities(raw));
        const url = cleanAssetUrl(decoded);
        if (url) found.add(url);
        continue;
      }

      const url = cleanAssetUrl(raw);
      if (
        url &&
        (url.startsWith(BASE) ||
          url.startsWith("https://img.papermarkassets.com") ||
          url.startsWith("https://assets.papermark.io"))
      ) {
        found.add(url);
      }
    }
  }

  return [...found].filter(
    (url) =>
      isLikelyAssetUrl(url) &&
      !url.includes("/api/") &&
      !url.includes("/_next/image") &&
      !url.endsWith(".json") &&
      !url.includes("?_rsc="),
  );
}

function ensureDir(dir) {
  if (fs.existsSync(dir) && fs.statSync(dir).isFile()) {
    fs.unlinkSync(dir);
  }
  fs.mkdirSync(dir, { recursive: true });
}

function isLikelyAssetUrl(url) {
  const pathname = new URL(url).pathname;
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/_static/") ||
    pathname.includes("/upload/")
  ) {
    return true;
  }
  return /\.[a-z0-9]{2,5}$/i.test(pathname);
}

function pagePathFromRoute(routePath) {
  if (routePath === "/") return path.join(publicDir, "index.html");
  return path.join(publicDir, routePath.slice(1), "index.html");
}

function assetPathFromUrl(url) {
  const u = new URL(url);
  const pathname = decodeURIComponent(u.pathname);
  if (u.hostname !== "www.papermark.com") {
    return path.join(publicDir, "_remote", u.hostname, pathname);
  }
  return path.join(publicDir, pathname);
}

async function downloadAssets(urls) {
  let ok = 0;
  let fail = 0;
  for (const url of urls) {
    const dest = assetPathFromUrl(url);
    if (fs.existsSync(dest)) {
      ok++;
      continue;
    }
    ensureDir(path.dirname(dest));
    try {
      const data = await fetchFile(url);
      fs.writeFileSync(dest, data);
      ok++;
      if (ok % 25 === 0) console.log(`  assets: ${ok}/${urls.length}`);
    } catch (error) {
      fail++;
      console.warn(`  skip ${url}: ${error.message}`);
    }
    await sleep(30);
  }
  console.log(`Assets done: ${ok} ok, ${fail} failed`);
}

async function main() {
  fs.mkdirSync(publicDir, { recursive: true });
  const allAssets = new Set();
  const queue = [...SEED_PAGES.map(normalizePath)];
  const seen = new Set();
  let fetched = 0;

  while (queue.length > 0 && fetched < MAX_PAGES) {
    const routePath = queue.shift();
    if (!routePath || seen.has(routePath) || !isMirrorablePath(routePath)) continue;
    seen.add(routePath);

    const url = routePath === "/" ? BASE : `${BASE}${routePath}`;
    console.log(`Fetching ${url} ...`);
    let html;
    try {
      html = await fetchText(url);
    } catch (error) {
      console.warn(`  skip page ${routePath}: ${error.message}`);
      continue;
    }

    fetched++;
    for (const asset of collectAssetUrls(html)) allAssets.add(asset);

    const outPath = pagePathFromRoute(routePath);
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, html);
    console.log(`  saved ${path.relative(root, outPath)}`);

    for (const link of extractInternalLinks(html)) {
      if (!seen.has(link)) queue.push(link);
    }

    await sleep(150);
  }

  console.log(`Downloaded ${fetched} pages, discovered ${seen.size} routes.`);
  console.log(`Downloading ${allAssets.size} assets ...`);
  await downloadAssets([...allAssets].sort());
  console.log("Mirror build complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
