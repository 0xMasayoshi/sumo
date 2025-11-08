import { mkdirSync, existsSync, chmodSync, createWriteStream } from "node:fs";
import path from "node:path";
import https from "node:https";

const plat = process.platform; // darwin|linux|win32
const outDir = path.join("src-tauri", "bin", plat);
const outName = plat === "win32" ? "sumo-daemon.exe" : "sumo-daemon";
const outPath = path.join(outDir, outName);

if (existsSync(outPath)) process.exit(0);
mkdirSync(outDir, { recursive: true });

const asset = ({
  darwin: "sumo-daemon-darwin-amd64",
  linux: "sumo-daemon-linux-amd64",
  win32: "sumo-daemon-windows-amd64.exe"
})[plat];

const url = `https://github.com/0xMasayoshi/sumo/releases/latest/download/${asset}`;

function download(u, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(u, { headers: { "User-Agent": "sumo-fetch" } }, (res) => {
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
      res.pipe(file).on("finish", () => file.close(resolve));
    }).on("error", reject);
  });
}

try {
  console.log("Fetching daemon:", url);
  await download(url, outPath);
  if (plat !== "win32") chmodSync(outPath, 0o755);
  console.log("Daemon ready at", outPath);
} catch (e) {
  console.error("Failed to fetch daemon:", e.message);
  process.exit(1);
}
