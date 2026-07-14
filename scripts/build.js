import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const target = process.env.TARGET_BROWSER || 'chrome';
const distDir = path.resolve(`dist/${target}`);

console.log(`🚀 Starting build for ${target}...`);

// 1. Run Vite Build
execSync(`vite build`, { stdio: 'inherit' });

// 2. Generate custom manifest.json
const baseManifest = JSON.parse(fs.readFileSync('src/manifest-templates/base.json', 'utf8'));
const overrideManifest = JSON.parse(fs.readFileSync(`src/manifest-templates/${target}.json`, 'utf8'));

const finalManifest = { ...baseManifest, ...overrideManifest };

// Fix path inside manifest since Vite copies html/css directly into outDir
finalManifest.action.default_popup = "viewer.html";

fs.writeFileSync(
  path.join(distDir, 'manifest.json'),
  JSON.stringify(finalManifest, null, 2)
);

// 3. Zip the output for release
const zipOutput = fs.createWriteStream(path.resolve(`dist/quick-json-parser-${target}.zip`));
const archive = archiver('zip', { zlib: { level: 9 } });

zipOutput.on('close', () => {
  console.log(`📦 Created release package: dist/quick-json-parser-${target}.zip (${archive.pointer()} total bytes)`);
});

archive.pipe(zipOutput);
archive.directory(distDir, false);
archive.finalize();