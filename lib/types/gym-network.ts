/**
 * Gym Network Types
 * 
 * TypeScript interfaces for the Gym Network schema.
 * Matches the Supabase database schema in 20250112_gym_network.sql
 */

// ============================================
// Enums
// ============================================

export type GymSubscriptionStatus = 'free' | 'basic' | 'premium' | 'enterprise';
export type GymPartnershipTier = 'bronze' | 'silver' | 'gold' | 'platinum' | null;
export type GymMemberStatus = 'active' | 'inactive' | 'banned' | 'pending';
export type GymMemberRole = 'member' | 'vip' | 'staff' | 'manager';
export type GymCoachRole = 'staff' | 'owner' | 'freelance' | 'partner';
export type GymCoachStatus = 'active' | 'inactive' | 'pending' | 'terminated';
export type GymSource = 'user' | 'osm' | 'google' | 'partner' | 'admin';

// ============================================
// Core Types
// ============================================

/**
 * Gym entity - Physical gym location
 */
export interface Gym {
    id: string;

    // Basic info
    name: string;
    slug?: string;
    description?: string;

    // Location (stored as PostGIS geography, returned as GeoJSON or lat/lng)
    location?: {
        type: 'Point';
        coordinates: [number, number]; // [longitude, latitude]
    } | null;
    address?: string;
    city?: string;
    state?: string;
    country: string;
    postal_code?: string;

    // External IDs for standardization
    osm_id?: string;
    google_place_id?: string;

    // Ownership
    owner_id?: string;

    // Business info
    phone?: string;
    email?: string;
    website?: string;

    // Operating hours
    operating_hours: OperatingHours;

    // Subscription/Partnership
    subscription_status: GymSubscriptionStatus;
    partnership_tier: GymPartnershipTier;

    // Amenities
    equipment_types: string[];
    amenities: string[];

    // Stats
    member_count: number;
    avg_rating?: number;
    review_count: number;

    // Verification
    is_verified: boolean;
    verified_at?: string;
    verified_by?: string;

    // Source
    created_by?: string;
    source: GymSource;

    // Timestamps
    created_at: string;
    updated_at: string;
}

/**
 * Operating hours for a gym
 */
export interface OperatingHours {
    monday?: DayHours;
    tuesday?: DayHours;
    wednesday?: DayHours;
    thursday?: DayHours;
    friday?: DayHours;
    saturday?: DayHours;
    sunday?: DayHours;
}

export interface DayHours {
    open: string;  // "06:00"
    close: string; // "22:00"
    is_24h?: boolean;
    is_closed?: boolean;
}

/**
 * Gym member - User membership in a gym
 */
export interface GymMember {
    id: string;
    gym_id: string;
    user_id: string;

    // Status
    status: GymMemberStatus;
    role: GymMemberRole;

    // Tracking
    joined_at: string;
    left_at?: string;
    last_check_in?: string;
    total_visits: number;

    // Privacy
    visible_in_leaderboard: boolean;
    visible_to_other_members: boolean;

    // Timestamps
    created_at: string;
    updated_at: string;
}

/**
 * Gym coach - Coach assignment to a gym
 */
export interface GymCoach {
    id: string;
    gym_id: string;
    coach_id: string; // References coach_profiles.id

    // Role
    role: GymCoachRole;
    status: GymCoachStatus;

    // Permissions
    can_view_member_list: boolean;
    can_view_traffic_data: boolean;
    can_post_announcements: boolean;
    can_manage_equipment: boolean;

    // Revenue
    revenue_share_percent?: number;

    // Employment
    started_at: string;
    ended_at?: string;

    // Timestamps
    created_at: string;
    updated_at: string;
}

/**
 * Gym traffic - Aggregated analytics per hour
 */
export interface GymTraffic {
    id: string;
    gym_id: string;

    // Time
    hour_bucket: string; // ISO timestamp truncated to hour
    day_of_week: number; // 0-6 (Sunday-Saturday)

    // Metrics
    active_users: number;
    workouts_started: number;
    workouts_completed: number;

    // Equipment usage
    equipment_usage: Record<string, number>; // e.g., { "bench_press": 5, "squat_rack": 3 }

    // Popular exercises
    popular_exercises: Array<{
        name: string;
        count: number;
    }>;

    // Session info
    avg_session_duration?: number; // minutes
    busyness_score: number; // 0-100

    // Timestamps
    created_at: string;
    updated_at: string;
}

// ============================================
// API Response Types
// ============================================

/**
 * Nearby gym result from find_nearby_gyms function
 */
export interface NearbyGym {
    id: string;
    name: string;
    address?: string;
    distance_meters: number;
    member_count: number;
    avg_rating?: number;
}

/**
 * Busyness result from get_gym_busyness function
 */
export interface GymBusyness {
    current_busyness: number;
    typical_busyness: number;
    trend: 'busier' | 'quieter' | 'typical';
}

// ============================================
// Insert/Update Types
// ============================================

/**
 * Gym insert payload
 */
export interface GymInsert {
    name: string;
    slug?: string;
    description?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    osm_id?: string;
    google_place_id?: string;
    owner_id?: string;
    phone?: string;
    email?: string;
    website?: string;
    operating_hours?: OperatingHours;
    equipment_types?: string[];
    amenities?: string[];
    latitude?: number;  // Will be converted to PostGIS geography
    longitude?: number; // Will be converted to PostGIS geography
}

/**
 * Gym member insert payload
 */
export interface GymMemberInsert {
    gym_id: string;
    user_id: string;
    status?: GymMemberStatus;
    role?: GymMemberRole;
    visible_in_leaderboard?: boolean;
    visible_to_other_members?: boolean;
}

/**
 * Gym coach insert payload
 */
export interface GymCoachInsert {
    gym_id: string;
    coach_id: string;
    role?: GymCoachRole;
    can_view_member_list?: boolean;
    can_view_traffic_data?: boolean;
    can_post_announcements?: boolean;
    can_manage_equipment?: boolean;
    revenue_share_percent?: number;
}

// ============================================
// Utility Types
// ============================================

/**
 * Gym with computed distance (for nearby queries)
 */
export interface GymWithDistance extends Gym {
    distance_meters?: number;
}

/**
 * Gym member with user details (joined query)
 */
export interface GymMemberWithUser extends GymMember {
    user?: {
        id: string;
        email?: string;
        // Add other user fields as needed
    };
}

/**
 * Gym coach with profile details (joined query)
 */
export interface GymCoachWithProfile extends GymCoach {
    coach_profile?: {
        id: string;
        user_id: string;
        display_name: string;
        avatar_url?: string;
    };
}
