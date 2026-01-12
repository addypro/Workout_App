/**
 * Gym Service
 * 
 * Location-based gym discovery using OpenStreetMap (free).
 * Enables standardized gym IDs for cross-user analytics.
 */

import * as Location from 'expo-location';

// ============================================
// TYPES
// ============================================

export interface GymLocation {
    id: string;                   // UUID or OSM ID
    name: string;
    osmId?: string;               // OpenStreetMap ID for standardization
    latitude: number;
    longitude: number;
    address?: string;
    distance?: number;            // meters from user
}

interface OSMPlace {
    place_id: number;
    osm_id: number;
    osm_type: string;
    display_name: string;
    lat: string;
    lon: string;
    type: string;
    importance: number;
}

// ============================================
// LOCATION HELPERS
// ============================================

/**
 * Request location permission and get current position
 */
export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            console.log('[Gym Service] Location permission denied');
            return null;
        }

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        return {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        };
    } catch (error) {
        console.error('[Gym Service] Error getting location:', error);
        return null;
    }
}

/**
 * Calculate distance between two points (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// ============================================
// OPENSTREETMAP NOMINATIM API (FREE)
// ============================================

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

/**
 * Search for nearby gyms using OpenStreetMap Nominatim
 * This is FREE but rate-limited (1 request/second)
 */
export async function searchNearbyGyms(
    latitude: number,
    longitude: number,
    radiusMeters: number = 2000
): Promise<GymLocation[]> {
    try {
        // Search for fitness centers near the location
        const url = `${NOMINATIM_BASE_URL}/search?` + new URLSearchParams({
            q: 'gym fitness center',
            format: 'json',
            limit: '10',
            lat: latitude.toString(),
            lon: longitude.toString(),
            bounded: '1',
            viewbox: getBoundingBox(latitude, longitude, radiusMeters),
        });

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'AntigravityWorkoutApp/1.0',
            },
        });

        if (!response.ok) {
            throw new Error(`OSM API error: ${response.status}`);
        }

        const places: OSMPlace[] = await response.json();

        // Convert to GymLocation and add distance (don't filter by type - OSM types are inconsistent)
        const gyms: GymLocation[] = places
            .map(place => {
                const lat = parseFloat(place.lat);
                const lon = parseFloat(place.lon);
                const distance = calculateDistance(latitude, longitude, lat, lon);

                return {
                    id: `osm-${place.osm_id}`,
                    name: extractGymName(place.display_name),
                    osmId: place.osm_id.toString(),
                    latitude: lat,
                    longitude: lon,
                    address: place.display_name,
                    distance,
                };
            })
            .sort((a, b) => (a.distance || 0) - (b.distance || 0));

        console.log(`[Gym Service] Found ${gyms.length} gyms near location`);
        return gyms;
    } catch (error) {
        console.error('[Gym Service] Error searching gyms:', error);
        return [];
    }
}

export async function searchGymsByName(
    query: string,
    latitude?: number,
    longitude?: number
): Promise<GymLocation[]> {
    try {
        // Add gym-related terms to improve search results
        const searchQuery = query.toLowerCase().includes('gym') ||
            query.toLowerCase().includes('fitness') ||
            query.toLowerCase().includes('club')
            ? query
            : `${query} gym fitness`;

        const params: Record<string, string> = {
            q: searchQuery,
            format: 'json',
            limit: '15',
            addressdetails: '1',
        };

        if (latitude && longitude) {
            params.lat = latitude.toString();
            params.lon = longitude.toString();
        }

        const url = `${NOMINATIM_BASE_URL}/search?` + new URLSearchParams(params);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'AntigravityWorkoutApp/1.0',
            },
        });

        if (!response.ok) {
            throw new Error(`OSM API error: ${response.status}`);
        }

        const places: OSMPlace[] = await response.json();

        return places.map(place => {
            const lat = parseFloat(place.lat);
            const lon = parseFloat(place.lon);
            const distance = latitude && longitude
                ? calculateDistance(latitude, longitude, lat, lon)
                : undefined;

            return {
                id: `osm-${place.osm_id}`,
                name: extractGymName(place.display_name),
                osmId: place.osm_id.toString(),
                latitude: lat,
                longitude: lon,
                address: place.display_name,
                distance,
            };
        });
    } catch (error) {
        console.error('[Gym Service] Error searching by name:', error);
        return [];
    }
}

// ============================================
// HELPERS
// ============================================

/**
 * Create bounding box for location search
 */
function getBoundingBox(lat: number, lon: number, radiusMeters: number): string {
    const latDelta = radiusMeters / 111320;
    const lonDelta = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));

    const minLon = lon - lonDelta;
    const minLat = lat - latDelta;
    const maxLon = lon + lonDelta;
    const maxLat = lat + latDelta;

    return `${minLon},${maxLat},${maxLon},${minLat}`;
}

/**
 * Extract clean gym name from OSM display_name
 * "Planet Fitness, 123 Main St, City, State" → "Planet Fitness"
 */
function extractGymName(displayName: string): string {
    const parts = displayName.split(',');
    return parts[0].trim();
}

/**
 * Create a custom gym (when not found in OSM)
 */
export function createCustomGym(
    name: string,
    latitude: number,
    longitude: number
): GymLocation {
    return {
        id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        latitude,
        longitude,
    };
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)}m`;
    }
    const miles = meters / 1609.34;
    return `${miles.toFixed(1)} mi`;
}
