import createClient from "openapi-fetch";
import { demoAssetUrl, demoUpload } from "~/demo/assets";
import type { components, paths } from "./schema";

export const api = createClient<paths>({
  baseUrl: "",
  fetch: import.meta.env.VITE_DEMO
    ? async (request) => (await import("~/demo/fetch")).demoFetch(request)
    : undefined,
});

export type NoteMeta = components["schemas"]["NoteMeta"];
export type Note = components["schemas"]["Note"];
export type Notebook = components["schemas"]["Notebook"];
export type Tag = components["schemas"]["Tag"];
export type TrashItem = components["schemas"]["TrashItem"];
export type Status = components["schemas"]["Status"];

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function unwrap<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await request;
  if (!response.ok) {
    const body = (error ?? {}) as { code?: string; message?: string };
    throw new ApiError(
      response.status,
      body.code ?? "unknown",
      body.message ?? response.statusText,
    );
  }
  return data as T;
}

/** Demo builds have no backend, so images come from bundled files or this visit's uploads. */
export function assetUrl(name: string) {
  return import.meta.env.VITE_DEMO ? demoAssetUrl(name) : `/api/assets/${name}`;
}

export type AssetUploaded = components["schemas"]["AssetUploaded"];

/** Sends raw image bytes; the generated client has no typed raw-body support. */
export async function uploadAsset(file: Blob): Promise<AssetUploaded> {
  if (import.meta.env.VITE_DEMO) return demoUpload(file);
  const response = await fetch("/api/assets", { method: "POST", body: file });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    throw new ApiError(
      response.status,
      body.code ?? "unknown",
      body.message ?? response.statusText,
    );
  }
  return response.json();
}
