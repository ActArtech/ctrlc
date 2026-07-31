/**
 * Unit tests for asset materialization (stable names, dry-run, mock fetch).
 * Usage: npm run test -w @ctrlc/capture
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const distIndex = path.join(pkgRoot, "dist/index.js");
const srcIndex = path.join(pkgRoot, "src/index.ts");

async function loadCapture() {
  if (fs.existsSync(distIndex)) {
    return import(pathToFileURL(distIndex).href);
  }
  const api = await import("tsx/esm/api");
  api.register();
  return import(pathToFileURL(srcIndex).href);
}

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`  FAIL  ${msg}`);
    failed++;
  } else {
    console.log(`  ok    ${msg}`);
  }
}

function assertEq(a, b, msg) {
  if (a !== b) {
    console.error(`  FAIL  ${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
    failed++;
  } else {
    console.log(`  ok    ${msg}`);
  }
}

function shortHash(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 8);
}

function makeIr(assets) {
  return {
    schemaVersion: 1,
    sourceUrl: "https://example.com",
    capturedAt: new Date().toISOString(),
    viewport: { width: 1440, height: 900 },
    sections: [],
    tokens: { colors: [], fonts: [] },
    assets,
  };
}

const mod = await loadCapture();
const {
  stableAssetFilename,
  materializeAssets,
  materializeAssetsFromFile,
} = mod;

console.log("@ctrlc/capture materialize-assets tests\n");

// --- stableAssetFilename ---
console.log("stableAssetFilename");

const imgUrl = "https://cdn.example.com/static/images/hero-logo.png";
const imgName = stableAssetFilename(imgUrl, "image", 0);
assert(imgName.startsWith("img-"), "image kind prefix img-");
assert(imgName.includes("example-com") || imgName.includes("cdn-example-com") || imgName.includes("cdn.example.com".replace(/\./g, "-")) || /cdn/.test(imgName), "includes host");
assert(imgName.endsWith(".png"), "preserves .png");
assert(imgName.includes(shortHash(imgUrl)), "includes sha256-8 of url");
assert(!/[/?%*:|"<>\\]/.test(imgName), "no unsafe path chars");

const fontUrl = "https://fonts.gstatic.com/s/inter/v12/UcCO3Fwr.woff2";
const fontName = stableAssetFilename(fontUrl, "font", 1);
assert(fontName.startsWith("font-"), "font kind prefix font-");
assert(fontName.endsWith(".woff2"), "preserves .woff2");

const videoUrl = "https://media.example.org/clips/demo.mp4?token=abc";
const videoName = stableAssetFilename(videoUrl, "video", 2);
assert(videoName.startsWith("video-"), "video kind prefix");
assert(videoName.endsWith(".mp4"), "preserves .mp4");

// Same URL always same name
assertEq(
  stableAssetFilename(imgUrl, "image", 0),
  stableAssetFilename(imgUrl, "image", 0),
  "stable across calls",
);

// data: URL naming
const dataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const dataName = stableAssetFilename(dataUrl, "image", 3);
assert(dataName.startsWith("img-data-"), "data url prefix");
assert(dataName.endsWith(".png"), "data url mime -> .png");

// Sanitization: weird path
const weird = "https://ex.com/a b/c%20d/logo?.png";
const weirdName = stableAssetFilename(weird, "image", 0);
assert(!weirdName.includes(" "), "spaces sanitized");
assert(!weirdName.includes("%"), "percent encoding cleaned or removed");

// --- dryRun materialize ---
console.log("\nmaterializeAssets dryRun");

const dryIr = makeIr([
  { url: imgUrl, kind: "image" },
  { url: fontUrl, kind: "font" },
]);

const dryOut = path.join(os.tmpdir(), `CtrlC-mat-dry-${Date.now()}`);
const dryResult = await materializeAssets(dryIr, {
  outDir: dryOut,
  dryRun: true,
  rewriteIr: true,
});

assertEq(dryResult.written.length, 2, "dryRun written length 2");
assert(dryResult.written.every((w) => w.ok), "dryRun all ok");
assert(dryResult.ir.assets[0].localPath, "localPath set on asset 0");
assert(dryResult.ir.assets[0].localPath.endsWith(".png"), "localPath ends .png");
assert(!fs.existsSync(path.join(dryOut, dryResult.written[0].localPath)), "dryRun wrote no file");

// rewriteIr false leaves original assets without localPath on clone... actually we clone assets
const dry2 = await materializeAssets(makeIr([{ url: imgUrl, kind: "image" }]), {
  outDir: dryOut,
  dryRun: true,
  rewriteIr: false,
});
assert(!dry2.ir.assets[0].localPath, "rewriteIr false does not set localPath");

// --- mock fetch download ---
console.log("\nmaterializeAssets mock fetch");

const mockBytes = Buffer.from("fake-png-bytes");
/** @type {typeof fetch} */
const mockFetch = async (url) => {
  if (String(url).includes("fail.example")) {
    return new Response(null, { status: 404, statusText: "Not Found" });
  }
  return new Response(mockBytes, {
    status: 200,
    headers: { "content-type": "image/png" },
  });
};

const tmpDir = path.join(os.tmpdir(), `CtrlC-mat-${Date.now()}`);
const fetchIr = makeIr([
  { url: "https://cdn.example.com/a.png", kind: "image" },
  { url: "https://fail.example.com/missing.png", kind: "image" },
]);

const fetchResult = await materializeAssets(fetchIr, {
  outDir: tmpDir,
  fetchImpl: mockFetch,
  concurrency: 2,
  rewriteIr: true,
});

assertEq(fetchResult.written.length, 2, "mock fetch 2 results");
const okOne = fetchResult.written.find((w) => w.ok);
const failOne = fetchResult.written.find((w) => !w.ok);
assert(okOne, "one ok download");
assert(failOne, "one failed download");
assert(failOne.error && /404/.test(failOne.error), "404 error recorded");
assert(
  fs.existsSync(path.join(tmpDir, okOne.localPath)),
  "ok file exists on disk",
);
assertEq(
  fs.readFileSync(path.join(tmpDir, okOne.localPath)).toString(),
  "fake-png-bytes",
  "file contents match mock body",
);
// Failed asset still gets localPath for stable IR
assert(fetchResult.ir.assets[1].localPath, "failed asset still has localPath");

// --- small data URL write ---
console.log("\ndata: URL write");

const dataDir = path.join(os.tmpdir(), `CtrlC-mat-data-${Date.now()}`);
const dataResult = await materializeAssets(
  makeIr([{ url: dataUrl, kind: "image" }]),
  { outDir: dataDir, rewriteIr: true },
);
assert(dataResult.written[0].ok, "small data url ok");
assert(
  fs.existsSync(path.join(dataDir, dataResult.written[0].localPath)),
  "data url file written",
);

// --- local HTTP server (real fetch path) ---
console.log("\nlocal http server download");

const serverPayload = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const server = http.createServer((req, res) => {
  if (req.url === "/pixel.png") {
    res.writeHead(200, { "content-type": "image/png" });
    res.end(serverPayload);
  } else {
    res.writeHead(404);
    res.end();
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const httpUrl = `http://127.0.0.1:${port}/pixel.png`;
const httpDir = path.join(os.tmpdir(), `CtrlC-mat-http-${Date.now()}`);

try {
  const httpResult = await materializeAssets(
    makeIr([{ url: httpUrl, kind: "image" }]),
    { outDir: httpDir, concurrency: 1 },
  );
  assert(httpResult.written[0].ok, "http download ok");
  assertEq(
    fs.readFileSync(path.join(httpDir, httpResult.written[0].localPath)).length,
    serverPayload.length,
    "http body length",
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}

// --- materializeAssetsFromFile ---
console.log("\nmaterializeAssetsFromFile");

const irFileDir = path.join(os.tmpdir(), `CtrlC-mat-ir-${Date.now()}`);
fs.mkdirSync(irFileDir, { recursive: true });
const irFile = path.join(irFileDir, "ir.json");
const assetsOut = path.join(irFileDir, "public-assets");
fs.writeFileSync(
  irFile,
  JSON.stringify(
    makeIr([
      { url: "https://cdn.example.com/logo.svg", kind: "image" },
      { url: "https://cdn.example.com/x.woff2", kind: "font" },
    ]),
    null,
    2,
  ),
);

const fileResult = await materializeAssetsFromFile(irFile, {
  outDir: assetsOut,
  dryRun: true,
  rewriteIr: true,
});
assertEq(fileResult.written.length, 2, "fromFile dryRun 2 assets");
// dryRun should not write IR
const matDefault = path.join(irFileDir, "ir.materialized.json");
assert(!fs.existsSync(matDefault), "dryRun does not write IR file");

const fileResult2 = await materializeAssetsFromFile(irFile, {
  outDir: assetsOut,
  dryRun: false,
  rewriteIr: true,
  fetchImpl: mockFetch,
});
assert(fs.existsSync(matDefault), "default writes ir.materialized.json");
const writtenIr = JSON.parse(fs.readFileSync(matDefault, "utf8"));
assert(writtenIr.assets[0].localPath, "written IR has localPath");
assert(writtenIr.assets[0].localPath.startsWith("img-"), "localPath uses img- prefix");

// overwrite with backup
const overwritePath = irFile;
await materializeAssetsFromFile(irFile, {
  outDir: assetsOut,
  outIrPath: overwritePath,
  dryRun: false,
  fetchImpl: mockFetch,
});
assert(fs.existsSync(irFile + ".bak"), "overwrite creates .bak");
const overIr = JSON.parse(fs.readFileSync(irFile, "utf8"));
assert(overIr.assets[0].localPath, "overwritten IR has localPath");

// cleanup temp dirs (best effort)
for (const d of [tmpDir, dataDir, httpDir, dryOut, irFileDir]) {
  try {
    fs.rmSync(d, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall ok");
