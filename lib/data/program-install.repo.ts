/**
 * Data: ProgramInstallRepo
 *
 * Encapsulates how "My Programs" are stored.
 * Today: AsyncStorage via `lib/db/storage`.
 * Future: can sync to Supabase while keeping the UI/service contracts unchanged.
 */

import { getPrograms, type Program as StoredProgram } from '@/lib/db/storage';
import type { ProgramId } from '@/lib/domain/program';

export type InstalledProgramKey =
  | { kind: 'catalogId'; value: ProgramId }
  | { kind: 'name'; value: string };

export interface ProgramInstallRepo {
  /** Returns stored programs (My Programs) */
  getInstalledPrograms(): Promise<StoredProgram[]>;
  /**
   * Returns keys we can use to match catalog items to installed programs.
   * New installs should use `catalogId`; old installs fall back to name.
   */
  getInstalledKeys(): Promise<InstalledProgramKey[]>;
}

export class AsyncStorageProgramInstallRepo implements ProgramInstallRepo {
  async getInstalledPrograms(): Promise<StoredProgram[]> {
    return await getPrograms();
  }

  async getInstalledKeys(): Promise<InstalledProgramKey[]> {
    const programs = await this.getInstalledPrograms();

    const keys: InstalledProgramKey[] = [];
    for (const p of programs) {
      const parsed = p.parsedData;
      const catalogId =
        parsed && typeof parsed === 'object' && 'sourceProgramId' in parsed
          ? (parsed as any).sourceProgramId
          : undefined;

      if (typeof catalogId === 'string' && catalogId.length > 0) {
        keys.push({ kind: 'catalogId', value: catalogId });
      } else if (typeof p.name === 'string' && p.name.length > 0) {
        keys.push({ kind: 'name', value: p.name });
      }
    }
    return keys;
  }
}


