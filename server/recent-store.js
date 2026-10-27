import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class RecentSearchStore {
  constructor(filePath = path.resolve('data/recent-searches.json'), limit = 20) {
    this.filePath = filePath;
    this.limit = limit;
    this.pendingWrite = Promise.resolve();
  }

  async list() {
    try {
      const saved = await readFile(this.filePath, 'utf8');
      const entries = JSON.parse(saved);
      return Array.isArray(entries) ? entries.slice(0, this.limit) : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async add(term, when = new Date().toISOString()) {
    const write = async () => {
      const current = await this.list();
      const entries = [
        { term, when },
        ...current.filter((entry) => entry.term.toLocaleLowerCase() !== term.toLocaleLowerCase()),
      ].slice(0, this.limit);
      await mkdir(path.dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
      return entries;
    };

    const operation = this.pendingWrite.then(write);
    this.pendingWrite = operation.catch(() => {});
    return operation;
  }
}
