import { deflateSync } from "node:zlib";

// 최소 PNG 인코더 — e2e에서 브라우저가 실제로 디코딩할 수 있는 테스트 이미지를
// 외부 의존 없이 생성한다. 그라디언트 + 100px 격자 + 초점 마커(원)로
// crop(초점·확대) 결과를 눈으로 검증할 수 있는 패턴을 그린다.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function makeTestPng(
  width: number,
  height: number,
  opts: { seed?: number; marker?: { x: number; y: number; radius?: number } } = {},
): Buffer {
  const seed = opts.seed ?? 0;
  const radius = opts.marker?.radius ?? Math.round(Math.min(width, height) * 0.09);
  const raw = Buffer.alloc(height * (1 + width * 3));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // scanline filter: none
    for (let x = 0; x < width; x++) {
      let r = 30 + Math.round((x / width) * 200);
      let g = ((seed * 37) % 55) + Math.round((y / height) * 200);
      let b = 160;
      if (x % 100 < 2 || y % 100 < 2) {
        r = g = b = 255; // 100px 격자
      }
      if (opts.marker) {
        const dx = x - opts.marker.x;
        const dy = y - opts.marker.y;
        if (dx * dx + dy * dy < radius * radius) {
          r = 220;
          g = 40;
          b = 60; // 초점 마커 (빨간 원)
        }
      }
      raw[offset++] = r & 0xff;
      raw[offset++] = g & 0xff;
      raw[offset++] = b & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
