export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
