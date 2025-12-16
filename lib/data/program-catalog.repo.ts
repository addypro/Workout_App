/**
 * Data: ProgramCatalogRepo
 *
 * A repository abstraction that lets us swap the catalog source later:
 * - today: bundled `programs-light.json` via `lib/services/programs`
 * - future: Supabase/remote sync
 */

import type { ProgramId, WorkoutProgram } from '@/lib/domain/program';
import { getAllPrograms as getAllBuiltinPrograms, getProgramById as getBuiltinProgramById } from '@/lib/services/programs';

export interface ProgramCatalogRepo {
  getAll(): WorkoutProgram[];
  getById(id: ProgramId): WorkoutProgram | undefined;
}

export class LocalBundledCatalogRepo implements ProgramCatalogRepo {
  getAll(): WorkoutProgram[] {
    return getAllBuiltinPrograms();
  }

  getById(id: ProgramId): WorkoutProgram | undefined {
    return getBuiltinProgramById(id);
  }
}


