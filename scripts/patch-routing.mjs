import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import routes from "../../papermark/marketing/routes.json" with { type: "json" };
import { patchStandaloneHtml } from "../../papermark/marketing/patch.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.name.endsWith(".html")) patchFile(full);
  }
}

function patchFile(file) {
  const html = fs.readFileSync(file, "utf8");
  const patched = patchStandaloneHtml(html)
    .replace(/href="\/login"/g, 'href="http://localhost:3002/login"')
    .replace(/href='\/login'/g, "href='http://localhost:3002/login'");
  if (patched !== html) {
    fs.writeFileSync(file, patched);
    console.log("patched", path.relative(root, file));
  }
}

function writeServeJson() {
  const serve = {
    cleanUrls: false,
    trailingSlash: false,
    directoryListing: false,
    rewrites: routes.exactPaths.map((pagePath) => {
      if (pagePath === "/") {
        return { source: "/", destination: "/index.html" };
      }
      const slug = pagePath.slice(1);
      return { source: pagePath, destination: `/${slug}/index.html` };
    }),
    redirects: [
      { source: "/login", destination: "http://localhost:3002/login", type: 302 },
    ],
  };
  fs.writeFileSync(path.join(root, "serve.json"), `${JSON.stringify(serve, null, 2)}\n`);
  fs.copyFileSync(path.join(root, "serve.json"), path.join(publicDir, "serve.json"));
  console.log("updated serve.json");
}

if (!fs.existsSync(publicDir)) {
  console.error("Run npm run build first.");
  process.exit(1);
}

walk(publicDir);
writeServeJson();
console.log("Routing patch complete.");
