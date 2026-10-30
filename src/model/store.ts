import type { Project } from './types';

const MAX_HISTORY = 200;

export class Store {
  private current: Project;
  private past: Project[] = [];
  private future: Project[] = [];
  private listeners = new Set<(p: Project) => void>();

  constructor(initial: Project) {
    this.current = initial;
  }

  get project(): Project {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  apply(next: Project): void {
    if (next === this.current) return;
    this.past.push(this.current);
    if (this.past.length > MAX_HISTORY) this.past.shift();
    this.future = [];
    this.set(next);
  }

  undo(): void {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(this.current);
    this.set(prev);
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.current);
    this.set(next);
  }

  load(p: Project): void {
    this.past = [];
    this.future = [];
    this.set(p);
  }

  subscribe(fn: (p: Project) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(p: Project): void {
    this.current = p;
    for (const fn of this.listeners) fn(p);
  }
}
