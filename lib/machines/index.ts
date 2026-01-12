/**
 * State Machines Module
 *
 * XState machines for complex application state management.
 */

// Workout Session Machine
export {
    getWorkoutStatus, workoutSessionMachine, type WorkoutMachineActor, type WorkoutMachineContext,
    type WorkoutMachineEvent, type WorkoutMachineStatus
} from './workout-session.machine';

export {
    useWorkoutMachine,
    useWorkoutSessionAdapter,
    type UseWorkoutMachineReturn
} from './use-workout-machine';

// Voice Coordinator Machine
export {
    getVoiceStatus, voiceCoordinatorMachine, type VoiceCoordinatorContext,
    type VoiceCoordinatorEvent,
    type VoiceCoordinatorStatus
} from './voice-coordinator.machine';

// Superset Machine
export {
    getCurrentSupersetExercise,
    getSupersetProgress, getSupersetStatus, supersetMachine, type SupersetEvent, type SupersetMachineContext, type SupersetPhaseStatus
} from './superset.machine';

// Sync Queue Machines
export {
    getSyncItemStatus, syncItemMachine,
    syncQueueMachine, type SyncItemContext,
    type SyncItemEvent, type SyncItemStatus, type SyncQueueContext,
    type SyncQueueEvent
} from './sync-item.machine';

// Rest Timer Actor
export {
    countdownActor,
    formatRestTime,
    formatRestTimeVerbose,
    getRecommendedRest,
    REST_PRESETS, restTimerActor, type RestPreset, type RestTimerEvent, type RestTimerInput
} from './rest-timer.actor';

