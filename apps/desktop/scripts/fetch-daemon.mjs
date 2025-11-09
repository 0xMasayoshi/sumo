// fetch-daemon.mjs
import { mkdirSync, existsSync, chmodSync, createWriteStream } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import https from "node:https";

const plat = process.platform;           // 'darwin' | 'linux' | 'win32'
const arch = process.arch;               // 'x64' | 'arm64' | ...
const outDir = path.join("src-tauri", "bin", plat);
const outName = plat === "win32" ? "sumo-daemon.exe" : "sumo-daemon";
const outPath = path.join(outDir, outName);

// Pin a release (or leave undefined to set default below)
const RELEASE_OVERRIDE = 'v0.0.0-alpha.0';

if (existsSync(outPath)) process.exit(0);

    mkdirSync(outDir, { recursive: true });


// Map platform/arch -> asset filename. Adjust if your release names differ.
function resolveAsset(p, a) {
  if (p === "darwin") return "sumo-daemon-darwin-amd64";
  if (p === "linux")  return "sumo-daemon-linux-amd64";
  if (p === "win32")  return "sumo-daemon-windows-amd64.exe";
  throw new Error(`Unsupported platform: ${p}`);
}

const asset = resolveAsset(plat, arch);
const releaseTag = RELEASE_OVERRIDE ?? "latest";
const url = `https://github.com/0xMasayoshi/sumo/releases/download/${releaseTag}/${asset}`;

function downloadFollowRedirects(u, dest, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const visited = new Set();

    function go(currentUrl, redirectsLeft) {
      if (redirectsLeft < 0) return reject(new Error("Too many redirects"));
      if (visited.has(currentUrl)) return reject(new Error("Redirect loop detected"));
      visited.add(currentUrl);

      const req = https.get(currentUrl, {
        headers: {
          "User-Agent": "sumo-fetch",
          "Accept": "application/octet-stream"
        }
      }, (res) => {
        const { statusCode, headers } = res;

        // Handle redirects
        if ([301, 302, 303, 307, 308].includes(statusCode)) {
          const loc = headers.location;
          if (!loc) return reject(new Error(`HTTP ${statusCode} with no Location header`));
          // Resolve relative redirects
          const nextUrl = new URL(loc, currentUrl).toString();
          res.resume(); // drain
          return go(nextUrl, redirectsLeft - 1);
        }

        // Success: write body to file
        if (statusCode === 200) {
          const file = createWriteStream(dest);
          res.pipe(file);
          file.on("finish", () => file.close(resolve));
          file.on("error", reject);
          return;
        }

        // Anything else: error out (helpful message)
        res.resume(); // drain
        return reject(new Error(`HTTP ${statusCode} (${headers["content-type"] || "no content-type"})`));
      });

      req.on("error", reject);
    }

    go(u, maxRedirects);
  });
}

try {
  console.log("Fetching daemon:", url);
  await downloadFollowRedirects(url, outPath);

  // Make executable on POSIX
  if (plat !== "win32") {
    chmodSync(outPath, 0o755);
  }

  // Clear macOS quarantine bit so it runs without prompts
  if (plat === "darwin") {
    await new Promise((resolve) =>
      execFile("xattr", ["-dr", "com.apple.quarantine", outPath], () => resolve())
    );
  }

  console.log("Daemon ready at", outPath);
} catch (e) {
  console.error("Failed to create daemon:", e.message);
  process.exit(1);
}
