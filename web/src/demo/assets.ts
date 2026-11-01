import { ApiError, type AssetUploaded } from "~/api/client";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** Images added during the visit, kept as object URLs until reload. */
const uploaded = new Map<string, string>();

export function demoAssetUrl(name: string) {
  return uploaded.get(name) ?? `${import.meta.env.BASE_URL}demo-assets/${name}`;
}

export function demoUpload(file: Blob): AssetUploaded {
  const ext = EXTENSIONS[file.type];
  if (!ext) throw new ApiError(415, "unsupported_asset", "unsupported image");
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const stem = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  const name = `${stem}.${ext}`;
  uploaded.set(name, URL.createObjectURL(file));
  return { name, path: `../.assets/${name}` };
}
