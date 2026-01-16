/**
 * Challenge Service Index
 *
 * Public API for the Challenges module.
 * All challenge functionality should be imported from here.
 */

// Core service functions
export {
    checkDailyProgress,
    checkPRMilestones, getActiveChallenges, getAllTemplates, getChallengeProgress, getTemplate, getUserChallenges, joinChallenge, recordWorkoutForChallenge
} from './challenge-service';

// Types
export type {
    ChallengeCategory, ChallengePathConfig, ChallengeProgress,
    ChallengeRecommendation, ChallengeRules, ChallengeStatus, ChallengeTemplate, UserChallenge
} from './types';

// Templates
export {
    ALL_CHALLENGE_TEMPLATES, HYROX_ENGINE, IRON_WILL_75, RUNNERS_AWAKENING, THOUSAND_LB_CLUB
} from './templates';

