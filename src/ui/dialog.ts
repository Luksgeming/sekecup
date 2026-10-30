// In-page dialogs. The macOS desktop webview silently answers window.prompt/confirm,
// so the app never relies on them.

function open(build: (form: HTMLFormElement) => HTMLElement | undefined, okLabel: string): Promise<FormData | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog';
    const form = document.createElement('form');
    form.method = 'dialog';
    const focusTarget = build(form);

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Batal';
    cancel.addEventListener('click', () => dialog.close());
    const ok = document.createElement('button');
    ok.type = 'submit';
    ok.value = 'ok';
    ok.className = 'primary';
    ok.textContent = okLabel;
    actions.append(cancel, ok);
    form.append(actions);
    dialog.append(form);
    document.body.append(dialog);

    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ok' ? new FormData(form) : null);
      dialog.remove();
    });
    dialog.showModal();
    (focusTarget ?? ok).focus();
  });
}

export async function askText(message: string, value: string): Promise<string | null> {
  const data = await open((form) => {
    const label = document.createElement('label');
    label.textContent = message;
    const input = document.createElement('input');
    input.name = 'value';
    input.value = value;
    input.autocomplete = 'off';
    label.append(input);
    form.append(label);
    queueMicrotask(() => input.select());
    return input;
  }, 'OK');
  return data ? String(data.get('value') ?? '') : null;
}

export async function confirmDialog(message: string, okLabel = 'Lanjut'): Promise<boolean> {
  const data = await open((form) => {
    const p = document.createElement('p');
    p.textContent = message;
    form.append(p);
    return undefined;
  }, okLabel);
  return data !== null;
}
