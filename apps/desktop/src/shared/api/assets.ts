import { convertFileSrc } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./browserDevCommands";

export function coverImageSource(path?: string | null): string {
  const value = path?.trim();
  if (!value) {
    return "";
  }

  if (/^(data:|https?:|asset:|blob:)/i.test(value)) {
    return value;
  }

  return isTauriRuntime() ? convertFileSrc(value) : value;
}
