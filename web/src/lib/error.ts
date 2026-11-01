import { toast } from "solid-sonner";

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export function reportError(e: unknown) {
  toast.error(errorMessage(e));
}
