/**
 * Minimal store-only ZIP for SectionPack downloads (no deps).
 * Layout mirrors the classic slice zip shape used by the inspector.
 */

export type ZipEntryInput = {
  path: string;
  data: string | Uint8Array;
};

const encoder = new TextEncoder();

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

function crc32(bytes: Uint8Array): number {
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
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const c of chunks) len += c.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Build a store-only (method 0) ZIP archive. */
export function buildStoreZip(entries: ZipEntryInput[]): Uint8Array {
  const { time, date } = dosDateTime();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const path = normalizePath(entry.path);
    if (!path) continue;
    const nameBytes = encoder.encode(path);
    const data = toBytes(entry.data);
    const crc = crc32(data);
    const size = data.byteLength;

    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(time),
      u16(date),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data,
    ]);

    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(time),
      u16(date),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);

    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralDir = concat(centrals);
  const localBlob = concat(locals);
  const eocd = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(centrals.length),
    u16(centrals.length),
    u32(centralDir.length),
    u32(localBlob.length),
    u16(0),
  ]);

  return concat([localBlob, centralDir, eocd]);
}

export function sanitizeZipSegment(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "section";
}

export type PackLike = {
  id: string;
  label: string;
  description: string;
  tags: string[];
  promptRole: string;
  contentHash: string;
  component: string;
  content: string;
  css: string;
  related: Record<string, string>;
  promptMarkdown: string;
  promptShortMarkdown: string;
  behaviorBriefMarkdown: string;
  cursorRuleMarkdown: string;
  templateSnippet: string;
  fileTree: unknown;
  byteSizes: unknown;
  importGraph: unknown;
  generatedAt: string;
};

export type MultiPackLike = {
  ids: string[];
  recipeId?: string;
  recipeLabel?: string;
  packs: PackLike[];
  promptMarkdown: string;
  promptShortMarkdown: string;
  behaviorBriefMarkdown: string;
  fileTree: unknown;
  totalBytes: number;
  generatedAt: string;
};

function packEntries(pack: PackLike, root: string): ZipEntryInput[] {
  const entries: ZipEntryInput[] = [
    { path: `${root}/README.md`, data: pack.promptMarkdown },
    { path: `${root}/NATURAL_LANGUAGE.md`, data: pack.behaviorBriefMarkdown },
    { path: `${root}/component.tsx`, data: pack.component },
    { path: `${root}/content.ts`, data: pack.content },
    { path: `${root}/styles.css`, data: pack.css },
    {
      path: `${root}/meta.json`,
      data: JSON.stringify(
        {
          id: pack.id,
          label: pack.label,
          description: pack.description,
          tags: pack.tags,
          promptRole: pack.promptRole,
          contentHash: pack.contentHash,
          fileTree: pack.fileTree,
          byteSizes: pack.byteSizes,
          importGraph: pack.importGraph,
          generatedAt: pack.generatedAt,
        },
        null,
        2,
      ),
    },
    { path: `${root}/template.tsx`, data: pack.templateSnippet },
    { path: `${root}/cursor-rule.md`, data: pack.cursorRuleMarkdown },
  ];

  for (const [projectPath, src] of Object.entries(pack.related ?? {})) {
    const safe = projectPath.replace(/\\/g, "/").replace(/^\/+/, "");
    entries.push({ path: `${root}/related/${safe}`, data: src });
  }

  return entries;
}

export function buildSectionZip(pack: PackLike): {
  bytes: Uint8Array;
  filename: string;
} {
  const idSeg = sanitizeZipSegment(pack.id);
  const hash8 = pack.contentHash.slice(0, 8);
  const root = `section-${idSeg}`;
  const bytes = buildStoreZip(packEntries(pack, root));
  return { bytes, filename: `section-${idSeg}-${hash8}.zip` };
}

export function buildMultiSectionZip(multi: MultiPackLike): {
  bytes: Uint8Array;
  filename: string;
} {
  const idParts = multi.ids.map(sanitizeZipSegment);
  const idsSlug =
    idParts.length <= 4
      ? idParts.join("-")
      : `${idParts.slice(0, 3).join("-")}-plus${idParts.length - 3}`;
  const root = `multi-${idsSlug}`;
  const entries: ZipEntryInput[] = [
    { path: `${root}/README.md`, data: multi.promptMarkdown },
    {
      path: `${root}/NATURAL_LANGUAGE.md`,
      data: multi.behaviorBriefMarkdown,
    },
    {
      path: `${root}/meta.json`,
      data: JSON.stringify(
        {
          ids: multi.ids,
          recipeId: multi.recipeId ?? null,
          recipeLabel: multi.recipeLabel ?? null,
          fileTree: multi.fileTree,
          totalBytes: multi.totalBytes,
          generatedAt: multi.generatedAt,
        },
        null,
        2,
      ),
    },
  ];

  for (const p of multi.packs) {
    entries.push(
      ...packEntries(p, `${root}/sections/${sanitizeZipSegment(p.id)}`),
    );
  }

  const bytes = buildStoreZip(entries);
  const hash8 = multi.packs[0]?.contentHash?.slice(0, 8) ?? "pack";
  return { bytes, filename: `multi-${idsSlug}-${hash8}.zip` };
}
