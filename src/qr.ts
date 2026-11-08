// ตัวสร้าง QR Code แบบกะทัดรัด (โหมดไบต์, ระดับแก้ไขข้อผิดพลาด M, เวอร์ชัน 1–6)
// ใช้กับลิงก์สั้น ๆ เช่น ที่อยู่เว็บระบบ จึงไม่ต้องเพิ่มไลบรารีภายนอก

const ECC_PER_BLOCK_M = [0, 10, 16, 26, 18, 24, 16];
const NUM_BLOCKS_M = [0, 1, 1, 1, 2, 2, 4];
const MAX_VERSION = 6;

function getAlignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = version * 4 + 10; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

function getNumRawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alignCount = Math.floor(version / 7) + 2;
    result -= (25 * alignCount - 10) * alignCount - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function reedSolomonDivisor(degree: number): number[] {
  const result: number[] = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function reedSolomonRemainder(data: number[], divisor: number[]): number[] {
  const result: number[] = divisor.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMultiply(coef, factor);
    });
  }
  return result;
}

export function makeQrModules(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 1;
  for (; version <= MAX_VERSION; version++) {
    const dataCodewords = Math.floor(getNumRawDataModules(version) / 8) - ECC_PER_BLOCK_M[version] * NUM_BLOCKS_M[version];
    if (4 + 8 + bytes.length * 8 <= dataCodewords * 8) break;
  }
  if (version > MAX_VERSION) throw new Error("QR text too long");

  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
  const dataCodewords = rawCodewords - ECC_PER_BLOCK_M[version] * NUM_BLOCKS_M[version];

  // บิตข้อมูล
  const bits: number[] = [];
  const pushBits = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  pushBits(0x4, 4);
  pushBits(bytes.length, 8);
  bytes.forEach((byte) => pushBits(byte, 8));
  pushBits(0, Math.min(4, dataCodewords * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  for (let pad = 0xec; bits.length < dataCodewords * 8; pad ^= 0xec ^ 0x11) pushBits(pad, 8);
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j++) value = (value << 1) | bits[i + j];
    dataBytes.push(value);
  }

  // แบ่งบล็อก + รหัสแก้ไขข้อผิดพลาด
  const numBlocks = NUM_BLOCKS_M[version];
  const blockEccLen = ECC_PER_BLOCK_M[version];
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const divisor = reedSolomonDivisor(blockEccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const length = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const data = dataBytes.slice(k, k + length);
    k += length;
    const ecc = reedSolomonRemainder(data, divisor);
    if (i < numShortBlocks) data.push(0);
    blocks.push(data.concat(ecc));
  }
  const allCodewords: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) allCodewords.push(block[i]);
    });
  }

  // วาดลวดลายฟังก์ชัน
  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFunction = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };
  for (let i = 0; i < size; i++) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }
  const drawFinder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setFunction(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);
  const alignPositions = getAlignmentPositions(version);
  alignPositions.forEach((ax, i) => {
    alignPositions.forEach((ay, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === alignPositions.length - 1) || (i === alignPositions.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) setFunction(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    });
  });
  const drawFormatBits = (mask: number) => {
    // ระดับ M = 0b00
    const data = (0 << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const formatBits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((formatBits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) setFunction(8, i, bit(i));
    setFunction(8, 7, bit(6));
    setFunction(8, 8, bit(7));
    setFunction(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFunction(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, bit(i));
    setFunction(8, size - 8, true);
  };
  drawFormatBits(0);

  // วางข้อมูล
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && bitIndex < allCodewords.length * 8) {
          modules[y][x] = ((allCodewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
          bitIndex++;
        }
      }
    }
  }

  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let invert = false;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        }
        if (!isFunction[y][x] && invert) modules[y][x] = !modules[y][x];
      }
    }
  };

  const penalty = (): number => {
    let result = 0;
    const lineScore = (get: (i: number) => boolean) => {
      let score = 0;
      let runColor = false;
      let runLen = 0;
      for (let i = 0; i < size; i++) {
        const color = get(i);
        if (i > 0 && color === runColor) {
          runLen++;
          if (runLen === 5) score += 3;
          else if (runLen > 5) score += 1;
        } else {
          runColor = color;
          runLen = 1;
        }
      }
      // รูปแบบคล้ายตัวค้นหา 1:1:3:1:1
      const pattern = [true, false, true, true, true, false, true];
      for (let i = 0; i + 7 <= size; i++) {
        if (pattern.every((value, k) => get(i + k) === value)) {
          const before = [1, 2, 3, 4].every((k) => i - k < 0 || !get(i - k));
          const after = [7, 8, 9, 10].every((k) => i + k >= size || !get(i + k));
          if (before) score += 40;
          if (after) score += 40;
        }
      }
      return score;
    };
    for (let y = 0; y < size; y++) result += lineScore((i) => modules[y][i]);
    for (let x = 0; x < size; x++) result += lineScore((i) => modules[i][x]);
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const color = modules[y][x];
        if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) result += 3;
      }
    }
    let dark = 0;
    modules.forEach((row) => row.forEach((value) => { if (value) dark++; }));
    const total = size * size;
    result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return result;
  };

  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask);
    drawFormatBits(mask);
    const score = penalty();
    if (score < bestPenalty) {
      bestPenalty = score;
      bestMask = mask;
    }
    applyMask(mask);
  }
  applyMask(bestMask);
  drawFormatBits(bestMask);
  return modules;
}

/** วาด QR เป็นภาพ PNG (data URL) พร้อมขอบขาว 4 โมดูล */
export function makeQrDataUrl(text: string, moduleSize = 10): string {
  const modules = makeQrModules(text);
  const quiet = 4;
  const total = modules.length + quiet * 2;
  const canvas = document.createElement("canvas");
  canvas.width = total * moduleSize;
  canvas.height = total * moduleSize;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000000";
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) context.fillRect((x + quiet) * moduleSize, (y + quiet) * moduleSize, moduleSize, moduleSize);
    })
  );
  return canvas.toDataURL("image/png");
}
