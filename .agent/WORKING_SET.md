# WORKING_SET (Gamified Paths + Adaptive Programs)

## Primary entry points (Expo Router)

- app/_layout.tsx
- app/(tabs)/_layout.tsx

## Where users start/execute workouts (must integrate)

- app/(tabs)/index.tsx                         (Home)
- app/workout/quick.tsx                        (Quick workout)
- app/workout/[id].tsx                         (Active workout)
- app/workout/[id]/preview.tsx                 (Preview from program)
- app/workout/[id]/summary.tsx                 (Post-workout summary — XP + PlanDelta UI)

## Where Paths should live (existing surfaces)

- app/(tabs)/explore.tsx                       (Discover programs + challenges entry)
- app/challenges.tsx OR app/(tabs)/explore/*   (Your challenges surface)
- app/leagues.tsx                              (League loop)
- app/onboarding/screener.tsx                  (Onboarding quiz / goal capture)

## Programs (template + instances)

- app/(tabs)/browse.tsx                        (Program list section)
- app/program/[id]/edit.tsx                    (Program details/edit)
- app/program/import-review.tsx                (Imported templates)

## Coach surfaces (only if we decide to support coach-assigned paths)

- app/(tabs)/coach.tsx
- app/coach/programs/*

## Domain + services (additive, minimal edits)

- src/services/progress/ProgressController.ts
- src/services/progress/__tests__/*
- src/domain/paths/*                           (Challenge catalog, Path graph, Instances)
- src/services/onboarding/*                    (config-driven onboarding)
- src/storage/*or src/lib/db/*                (wherever you persist stats/instances)

## UI components (paths)

- src/components/paths/*
