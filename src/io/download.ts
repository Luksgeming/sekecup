const inTauri = () => '__TAURI_INTERNALS__' in window;

/** Saves a file: a native save dialog on desktop, a browser download on the web. */
export async function saveFile(blob: Blob, filename: string): Promise<boolean> {
  if (inTauri()) {
    const [{ save }, { writeFile }] = await Promise.all([import('@tauri-apps/plugin-dialog'), import('@tauri-apps/plugin-fs')]);
    const path = await save({ defaultPath: filename });
    if (!path) return false;
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return true;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function pickFile(accept: string): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files?.[0]));
    input.addEventListener('cancel', () => resolve(undefined));
    input.click();
  });
}

export function safeFilename(name: string): string {
  return name.trim().replace(/[^\p{L}\p{N} _-]+/gu, '').replace(/\s+/g, '-') || 'rumah';
}
