/**
 * Renders the Taobao Currency Converter icons (16/32/48/128 px) from the
 * canonical SVG source (`public/icons/TaobaoConvert2k.svg`).
 *
 * Run: `node scripts/generate-icons.mjs`
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, "..", "public", "icons");
const svgPath = resolve(iconsDir, "TaobaoConvert2k.svg");
const SIZES = [16, 32, 48, 128];

async function main() {
  await mkdir(iconsDir, { recursive: true });
  const svgBuffer = await readFile(svgPath);

  for (const size of SIZES) {
    const outPath = resolve(iconsDir, `icon-${size}.png`);
    const pngBuffer = await sharp(svgBuffer, { density: 300 })
      .resize(size, size, { kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 9 })
      .toBuffer();
    await writeFile(outPath, pngBuffer);
    console.log(`Generated ${outPath} (${pngBuffer.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
