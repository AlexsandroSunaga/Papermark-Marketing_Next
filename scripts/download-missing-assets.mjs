import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const agent = new https.Agent({ rejectUnauthorized: false });

const ASSETS = [
  "https://www.papermark.com/_static/landing11/office-hero-poster.jpg",
  "https://img.papermarkassets.com/upload/file_15dihGpDRHcXZU8kpVaPfR-images-2-Picsart-AiImageEnhancer.jpeg",
  "https://www.papermark.com/_next/static/media/3b23457314f0d7e2-s.p.woff2",
  "https://www.papermark.com/_next/static/media/e4af272ccee01ff0-s.p.woff2",
];

function fetchFile(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { agent, headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode)) {
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : `https://www.papermark.com${res.headers.location}`;
          return fetchFile(next).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`${url} -> ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

function localPath(url) {
  const u = new URL(url);
  if (u.hostname === "www.papermark.com") {
    return path.join(publicDir, decodeURIComponent(u.pathname));
  }
  return path.join(publicDir, "_remote", u.hostname, decodeURIComponent(u.pathname));
}

for (const url of ASSETS) {
  const dest = localPath(url);
  if (fs.existsSync(dest)) {
    console.log("skip", path.relative(root, dest));
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    const data = await fetchFile(url);
    fs.writeFileSync(dest, data);
    console.log("saved", path.relative(root, dest));
  } catch (error) {
    console.warn("failed", url, error.message);
  }
}
