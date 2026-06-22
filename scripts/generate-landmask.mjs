/**
 * generate-landmask.mjs  (أداة بناء لمرّة واحدة — لا تُشحن للمتصفّح)
 *
 * يبني قناع يابسة/بحر بإسقاط Web-Mercator من نموذج ارتفاعات Terrarium (AWS Open Data)،
 * فيتطابق مباشرة مع إحداثي v_merc في HeatmapGLLayer (لا حاجة لأي تحويل lat في العيّنة).
 *
 * المخرج: public/landmask.png  (تدرّج رمادي: 255 = يابسة، 0 = بحر)
 *   - الغرض: كسر استيفاء الحقل اللوني عند خطّ الساحل في الـ shader فتظهر حافة حادّة
 *     (يابسة حارّة / بحر أبرد) كما في Zoom Earth بدل التموّه القُطري.
 *
 * التشغيل (لمرّة واحدة عند الحاجة لإعادة توليد القناع):
 *   npm i pngjs --no-save && node scripts/generate-landmask.mjs
 */

import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ZOOM = 4;                 // 16×16 = 256 بلاطة → 4096×4096 ثم نُصغّرها
const TILE = 256;
const N = 1 << ZOOM;            // عدد البلاطات في كل محور
const FULL = N * TILE;          // 4096
const OUT = 2048;               // أبعاد القناع النهائي (تكفي لحواف ساحلية واضحة)
const CONCURRENCY = 16;
const BASE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'public', 'landmask.png');

/** يفك بلاطة Terrarium ويُعيد Uint8Array(256*256) بقيمة 1=يابسة 0=بحر. */
async function fetchTileMask(x, y) {
    const url = `${BASE}/${ZOOM}/${x}/${y}.png`;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = Buffer.from(await res.arrayBuffer());
            const png = PNG.sync.read(buf);
            const out = new Uint8Array(TILE * TILE);
            for (let i = 0; i < TILE * TILE; i++) {
                const r = png.data[i * 4], g = png.data[i * 4 + 1], b = png.data[i * 4 + 2];
                const elev = (r * 256 + g + b / 256) - 32768;
                out[i] = elev > 0.5 ? 1 : 0; // يابسة فوق مستوى البحر
            }
            return out;
        } catch (e) {
            if (attempt === 2) { console.warn(`فشل ${url}: ${e.message} — يُعتبر بحراً`); return new Uint8Array(TILE * TILE); }
        }
    }
}

async function main() {
    console.log(`جلب ${N * N} بلاطة عند zoom ${ZOOM} …`);
    const full = new Uint8Array(FULL * FULL); // 1=يابسة
    const jobs = [];
    for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) jobs.push([tx, ty]);

    let done = 0;
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
        const batch = jobs.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async ([tx, ty]) => {
            const mask = await fetchTileMask(tx, ty);
            for (let py = 0; py < TILE; py++) {
                const gy = ty * TILE + py;
                for (let px = 0; px < TILE; px++) {
                    full[gy * FULL + (tx * TILE + px)] = mask[py * TILE + px];
                }
            }
            done++;
        }));
        process.stdout.write(`\r  ${done}/${jobs.length}`);
    }
    console.log('\nتصغير وكتابة PNG …');

    // تصغير بمتوسّط منطقة (FULL→OUT): البكسل يابسة إن كان ≥ نصف مصدره يابسة.
    const scale = FULL / OUT;
    const png = new PNG({ width: OUT, height: OUT, colorType: 0 }); // grayscale
    for (let oy = 0; oy < OUT; oy++) {
        for (let ox = 0; ox < OUT; ox++) {
            let sum = 0, cnt = 0;
            const sx0 = Math.floor(ox * scale), sx1 = Math.floor((ox + 1) * scale);
            const sy0 = Math.floor(oy * scale), sy1 = Math.floor((oy + 1) * scale);
            for (let sy = sy0; sy < sy1; sy++)
                for (let sx = sx0; sx < sx1; sx++) { sum += full[sy * FULL + sx]; cnt++; }
            const land = cnt > 0 && sum * 2 >= cnt ? 255 : 0;
            const idx = (oy * OUT + ox) * 4;
            png.data[idx] = png.data[idx + 1] = png.data[idx + 2] = land;
            png.data[idx + 3] = 255;
        }
    }
    writeFileSync(outPath, PNG.sync.write(png));
    console.log(`تمّ: ${outPath} (${OUT}×${OUT})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
