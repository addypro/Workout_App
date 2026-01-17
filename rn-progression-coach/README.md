# Progression Coach (React Native / Expo)

An offline-first workout app that:
- Loads a library of programs (36 in `src/data/programs.json`)
- Generates *suggested weights* per set based on last performance & target effort
- Lets the user override load (too easy/hard) and feeds that back into next session
- Carries *additive context* across programs (exercise e1RM, typical RPE, increment size)

## Run

```bash
npm install
npm run start
```

## Key idea

Programs contain **sets/reps/rest** but `weight` is null. The app computes the suggested load using the progression engine.

- Strength LP profiles: linear increases with deload rules
- Hypertrophy: double-progression (hit top reps → add weight; else add reps)
- Conditioning/mobility: time/distance progression and/or completion tracking

## Where to look

- `src/domain/progression/*` – progression rules
- `src/db/*` – SQLite schema + queries
- `src/screens/*` – UI flow

