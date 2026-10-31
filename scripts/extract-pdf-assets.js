const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const pdfPath = 'C:/Users/infod/.gemini/antigravity/brain/b4d33797-f56f-4d10-badf-2e366dd81e66/.user_uploaded/media_1793480849563_e8262ad8.pdf';
const outDir = path.join(__dirname, '..', 'public', 'uploads');
const tmpDir = path.join(__dirname, '..', 'data', 'tmp_pdf');

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

fs.copyFileSync(pdfPath, path.join(outDir, 'Avigo-Corporate-Profile.pdf'));

const buf = fs.readFileSync(pdfPath);
const str = buf.toString('latin1');
const objRegex = /(\d+)\s+0\s+obj([\s\S]*?)endobj/g;
let match;

const objects = {};

while ((match = objRegex.exec(str)) !== null) {
  const objNum = parseInt(match[1], 10);
  const body = match[2];
  if (body.includes('/Subtype /Image') || body.includes('/Subtype/Image')) {
    const widthMatch = body.match(/\/Width\s+(\d+)/);
    const heightMatch = body.match(/\/Height\s+(\d+)/);
    const filterMatch = body.match(/\/Filter\s*\/?\[?\s*\/([A-Za-z0-9]+)/);
    const smaskMatch = body.match(/\/SMask\s+(\d+)\s+0\s+R/);

    const streamIdx = body.indexOf('stream');
    const endStreamIdx = body.lastIndexOf('endstream');
    if (streamIdx !== -1 && endStreamIdx !== -1) {
      let dataStart = match.index + match[0].indexOf('stream') + 6;
      if (buf[dataStart] === 0x0d && buf[dataStart + 1] === 0x0a) dataStart += 2;
      else if (buf[dataStart] === 0x0a || buf[dataStart] === 0x0d) dataStart += 1;

      let dataEnd = match.index + match[0].lastIndexOf('endstream');
      while (dataEnd > dataStart && (buf[dataEnd - 1] === 0x0a || buf[dataEnd - 1] === 0x0d)) {
        dataEnd--;
      }

      const rawStream = buf.subarray(dataStart, dataEnd);
      const filter = filterMatch ? filterMatch[1] : 'unknown';
      const w = widthMatch ? parseInt(widthMatch[1], 10) : 0;
      const h = heightMatch ? parseInt(heightMatch[1], 10) : 0;
      const smask = smaskMatch ? parseInt(smaskMatch[1], 10) : null;

      objects[objNum] = { objNum, w, h, filter, smask, rawStream };
    }
  }
}

// Save JPEGs and their raw decompressed alpha mask bytes
const pairs = [];
for (const objNum of Object.keys(objects).map(Number)) {
  const obj = objects[objNum];
  if (obj.filter === 'DCTDecode') {
    const jpgPath = path.join(tmpDir, `obj${objNum}.jpg`);
    fs.writeFileSync(jpgPath, obj.rawStream);
    let maskPath = '';
    if (obj.smask && objects[obj.smask] && objects[obj.smask].filter === 'FlateDecode') {
      const maskObj = objects[obj.smask];
      try {
        const rawMask = zlib.inflateSync(maskObj.rawStream);
        maskPath = path.join(tmpDir, `mask${obj.smask}.raw`);
        fs.writeFileSync(maskPath, rawMask);
        console.log(`Obj ${objNum} (${obj.w}x${obj.h}) -> SMask ${obj.smask} (${rawMask.length} bytes, expected ${obj.w * obj.h})`);
      } catch (e) {
        console.error(`Failed to inflate mask ${obj.smask}:`, e.message);
      }
    } else {
      console.log(`Obj ${objNum} (${obj.w}x${obj.h}) -> No SMask`);
    }
    pairs.push({ objNum, w: obj.w, h: obj.h, jpgPath, maskPath });
  }
}

fs.writeFileSync(path.join(tmpDir, 'pairs.json'), JSON.stringify(pairs, null, 2));
