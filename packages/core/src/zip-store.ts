/**
 * Minimal store-only ZIP (method 0, no compression) for small text packs.
 * Zero deps - sufficient for dev tooling downloads.
 *
 * Spec references: APPNOTE.TXT (local file header, central directory, EOCD).
 */

export type ZipEntryInput = {
  /** Forward-slash path inside the archive (no leading slash). */
  path: string;
  /** UTF-8 text or raw bytes. */
  data: string | Uint8Array;
};

const encoder = new TextEncoder();

/** Precomputed CRC-32 (IEEE) table. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function toBytes(data: string | Uint8Array): Uint8Array {
  if (typeof data === "string") return encoder.encode(data);
  return data;
}

function normalizePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");
}

function dosDateTime(date = new Date()): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  const time = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { time, date: dosDate };
}

function writeU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value & 0xffff, true);
}

function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

type InternalEntry = {
  path: string;
  pathBytes: Uint8Array;
  data: Uint8Array;
  crc: number;
  localHeaderOffset: number;
};

/**
 * Build a ZIP archive (store only). Returns a Uint8Array suitable for Response body.
 */
export function buildStoreZip(
  entries: ZipEntryInput[],
  options?: { date?: Date },
): Uint8Array {
  const { time, date } = dosDateTime(options?.date);
  const prepared: InternalEntry[] = [];

  for (const entry of entries) {
    const path = normalizePath(entry.path);
    if (!path || path.endsWith("/")) continue;
    const data = toBytes(entry.data);
    prepared.push({
      path,
      pathBytes: encoder.encode(path),
      data,
      crc: crc32(data),
      localHeaderOffset: 0,
    });
  }

  // General purpose bit 11 = UTF-8 file names
  const gpFlag = 0x0800;
  const method = 0; // store
  const version = 20; // 2.0

  // Pass 1: size local + data
  let localSize = 0;
  for (const e of prepared) {
    localSize += 30 + e.pathBytes.length + e.data.length;
  }

  // Central directory size
  let centralSize = 0;
  for (const e of prepared) {
    centralSize += 46 + e.pathBytes.length;
  }
  const eocdSize = 22;
  const total = localSize + centralSize + eocdSize;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);

  let offset = 0;

  // Local file headers + data
  for (const e of prepared) {
    e.localHeaderOffset = offset;
    writeU32(view, offset, 0x04034b50);
    writeU16(view, offset + 4, version);
    writeU16(view, offset + 6, gpFlag);
    writeU16(view, offset + 8, method);
    writeU16(view, offset + 10, time);
    writeU16(view, offset + 12, date);
    writeU32(view, offset + 14, e.crc);
    writeU32(view, offset + 18, e.data.length);
    writeU32(view, offset + 22, e.data.length);
    writeU16(view, offset + 26, e.pathBytes.length);
    writeU16(view, offset + 28, 0); // extra length
    out.set(e.pathBytes, offset + 30);
    out.set(e.data, offset + 30 + e.pathBytes.length);
    offset += 30 + e.pathBytes.length + e.data.length;
  }

  const centralOffset = offset;

  // Central directory
  for (const e of prepared) {
    writeU32(view, offset, 0x02014b50);
    writeU16(view, offset + 4, version); // version made by
    writeU16(view, offset + 6, version); // version needed
    writeU16(view, offset + 8, gpFlag);
    writeU16(view, offset + 10, method);
    writeU16(view, offset + 12, time);
    writeU16(view, offset + 14, date);
    writeU32(view, offset + 16, e.crc);
    writeU32(view, offset + 20, e.data.length);
    writeU32(view, offset + 24, e.data.length);
    writeU16(view, offset + 28, e.pathBytes.length);
    writeU16(view, offset + 30, 0); // extra
    writeU16(view, offset + 32, 0); // comment
    writeU16(view, offset + 34, 0); // disk start
    writeU16(view, offset + 36, 0); // internal attrs
    writeU32(view, offset + 38, 0); // external attrs
    writeU32(view, offset + 42, e.localHeaderOffset);
    out.set(e.pathBytes, offset + 46);
    offset += 46 + e.pathBytes.length;
  }

  // End of central directory
  writeU32(view, offset, 0x06054b50);
  writeU16(view, offset + 4, 0); // disk number
  writeU16(view, offset + 6, 0); // central dir disk
  writeU16(view, offset + 8, prepared.length);
  writeU16(view, offset + 10, prepared.length);
  writeU32(view, offset + 12, centralSize);
  writeU32(view, offset + 16, centralOffset);
  writeU16(view, offset + 20, 0); // comment length

  return out;
}

/** Safe path segment for archive filenames (ids, tags). */
export function sanitizeZipSegment(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "section"
  );
}

/**
 * Turn a project path into a nested related/ entry name.
 * `src/foo/Bar.tsx` -> `related/src/foo/Bar.tsx`
 */
export function relatedZipPath(projectPath: string, root = "related"): string {
  const cleaned = normalizePath(projectPath);
  return `${root}/${cleaned}`;
}
