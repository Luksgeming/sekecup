import { parseCommand, type Command } from '../plan/commands';

/** The command line under the drawing: shows the active tool's prompt and runs typed commands. */
export function createCommandLine(
  form: HTMLFormElement,
  run: (cmd: Command) => void,
): { setPrompt: (text: string) => void } {
  const input = form.querySelector('input')!;
  const prompt = form.querySelector('label')!;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    run(parseCommand(input.value));
    input.value = '';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') input.blur();
  });
  return { setPrompt: (text) => (prompt.textContent = text) };
}
