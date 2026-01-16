/**
 * Service: ProgramsService
 *
 * Backend-style service layer:
 * - builds an in-memory search index once
 * - supports cursor-like pagination
 * - joins install state (local today, remote tomorrow)
 */

import { LocalBundledCatalogRepo } from '@/lib/data/program-catalog.repo';
import { AsyncStorageProgramInstallRepo, type InstalledProgramKey } from '@/lib/data/program-install.repo';
import { saveProgram } from '@/lib/db/storage';
import type { DifficultyLevel, ProgramDisplayItem, ProgramId, ProgramType, WorkoutProgram } from '@/lib/domain/program';
import { toProgramDisplayItem, toStorageFormat } from '@/lib/services/programs';

export type CatalogFilters = {
  type?: ProgramType;
  difficulty?: DifficultyLevel;
};

export type CatalogQuery = {
  q?: string;
  filters?: CatalogFilters;
  limit: number;
  offset: number;
};

export type CatalogListItem = ProgramDisplayItem & {
  installed: boolean;
};

type IndexedProgram = {
  program: WorkoutProgram;
  haystack: string; // lowercased concat for fast includes()
};

export class ProgramsService {
  private catalogRepo = new LocalBundledCatalogRepo();
  private installRepo = new AsyncStorageProgramInstallRepo();

  private index: IndexedProgram[] | null = null;

  private ensureIndex() {
    if (this.index) return;
    const all = this.catalogRepo.getAll();
    this.index = all.map((p) => ({
      program: p,
      haystack: [
        p.id,
        p.name,
        p.description,
        p.type,
        p.difficulty,
        ...(p.tags ?? []),
        ...(p.muscleGroups ?? []),
        ...(p.equipment ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    }));
  }

  getTotalCount(): number {
    return this.catalogRepo.getAll().length;
  }

  getById(id: ProgramId): WorkoutProgram | undefined {
    return this.catalogRepo.getById(id);
  }

  async listCatalog(query: CatalogQuery): Promise<{ total: number; items: CatalogListItem[] }> {
    this.ensureIndex();
    const idx = this.index!;

    const q = (query.q ?? '').trim().toLowerCase();
    const type = query.filters?.type;
    const difficulty = query.filters?.difficulty;

    const filtered = idx
      .filter(({ program, haystack }) => {
        if (q && !haystack.includes(q)) return false;
        if (type && program.type !== type) return false;
        if (difficulty && program.difficulty !== difficulty) return false;
        return true;
      })
      .map(({ program }) => program);

    const page = filtered.slice(query.offset, query.offset + query.limit);

    const installedKeys = await this.installRepo.getInstalledKeys();
    const installedIdSet = new Set(
      installedKeys.filter((k): k is Extract<InstalledProgramKey, { kind: 'catalogId' }> => k.kind === 'catalogId').map((k) => k.value)
    );
    const installedNameSet = new Set(
      installedKeys.filter((k): k is Extract<InstalledProgramKey, { kind: 'name' }> => k.kind === 'name').map((k) => k.value.toLowerCase())
    );

    const items = page.map((p) => {
      const display = toProgramDisplayItem(p, 'builtin');
      const installed = installedIdSet.has(p.id) || installedNameSet.has(p.name.toLowerCase());
      return { ...display, installed };
    });

    return { total: filtered.length, items };
  }

  async installProgramsByCatalogIds(ids: ProgramId[]): Promise<number> {
    let added = 0;
    for (const id of ids) {
      const p = this.getById(id);
      if (!p) continue;
      // toStorageFormat is now async to support lazy-loaded Kaggle data
      const storage = await toStorageFormat(p);
      await saveProgram(storage);
      added++;
    }
    return added;
  }
}

export const programsService = new ProgramsService();


