#!/usr/bin/env python3
"""
ExerciseDB Complete Fetch Script

Fetches ALL exercises from ExerciseDB API, respecting rate limits.
Runs until complete, with automatic retry and resume capability.

Usage:
    python3 scripts/fetch-exercisedb-complete.py

The script will:
1. Resume from where it left off (using exercisedb-cache.json)
2. Wait when rate limited
3. Save progress after each batch
4. Rebuild the mapping when complete
"""

import json
import time
import os
import sys
import ssl
from datetime import datetime, timedelta
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

# SSL context for macOS compatibility
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# Configuration
API_BASE = "https://exercisedb.dev/api/v1"
DATA_DIR = Path(__file__).parent.parent / "data"
CACHE_FILE = DATA_DIR / "exercisedb-cache.json"
STATE_FILE = DATA_DIR / ".exercisedb-fetch-state.json"

# Rate limit settings - conservative to avoid getting blocked
PAGE_SIZE = 20  # Smaller pages = more consistent
DELAY_BETWEEN_REQUESTS = 4.0  # 4 seconds between requests to avoid rate limits
DELAY_ON_RATE_LIMIT = 120  # 2 minutes when rate limited
MAX_RETRIES = 5
TOTAL_EXERCISES = 1500  # Approximate total in ExerciseDB

def load_state():
    """Load fetch progress state"""
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            return json.load(f)
    return {"offset": 0, "last_fetch": None, "exercises": []}

def save_state(state):
    """Save fetch progress state"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def load_cache():
    """Load existing cache"""
    if CACHE_FILE.exists():
        with open(CACHE_FILE) as f:
            return json.load(f)
    return {"exercises": [], "fetchedAt": None, "source": "exercisedb-api-v1"}

def save_cache(exercises):
    """Save exercises to cache file"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    cache = {
        "exercises": exercises,
        "fetchedAt": datetime.now().isoformat(),
        "source": "exercisedb-api-v1",
        "count": len(exercises)
    }
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)

def fetch_page(offset, retries=0):
    """Fetch a page of exercises from the API"""
    url = f"{API_BASE}/exercises?limit={PAGE_SIZE}&offset={offset}"
    
    try:
        req = Request(url, headers={"User-Agent": "ExerciseDB-Fetcher/1.0"})
        with urlopen(req, timeout=30, context=ssl_context) as response:
            if response.status == 200:
                data = json.loads(response.read())
                return data if isinstance(data, list) else []
    except HTTPError as e:
        if e.code == 429:  # Rate limited
            print(f"   ⚠️  Rate limited. Waiting {DELAY_ON_RATE_LIMIT}s...")
            time.sleep(DELAY_ON_RATE_LIMIT)
            if retries < MAX_RETRIES:
                return fetch_page(offset, retries + 1)
            return None
        print(f"   ❌ HTTP Error: {e.code}")
        return None
    except URLError as e:
        print(f"   ❌ URL Error: {e.reason}")
        if retries < MAX_RETRIES:
            time.sleep(5)
            return fetch_page(offset, retries + 1)
        return None
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None
    
    return []

def normalize_exercise(ex):
    """Normalize exercise data structure"""
    return {
        "exerciseId": ex.get("id", ""),
        "name": ex.get("name", ""),
        "gifUrl": ex.get("gifUrl", ""),
        "targetMuscles": [ex.get("target", "")] if ex.get("target") else [],
        "bodyParts": [ex.get("bodyPart", "")] if ex.get("bodyPart") else [],
        "equipments": [ex.get("equipment", "")] if ex.get("equipment") else [],
        "secondaryMuscles": ex.get("secondaryMuscles", []),
        "instructions": ex.get("instructions", [])
    }

def main():
    print("🏋️  ExerciseDB Complete Fetch")
    print("=" * 50)
    
    # Load existing state and cache
    state = load_state()
    cache = load_cache()
    exercises = cache.get("exercises", [])
    
    # Build ID set for deduplication
    existing_ids = {ex["exerciseId"] for ex in exercises}
    
    offset = state.get("offset", 0)
    if exercises:
        print(f"📁 Resuming from offset {offset}")
        print(f"   Already have {len(exercises)} exercises")
    
    consecutive_empty = 0
    
    while offset < TOTAL_EXERCISES:
        # Show progress
        progress = (offset / TOTAL_EXERCISES) * 100
        print(f"\n  Fetching offset={offset}... ({progress:.1f}%)")
        
        # Fetch page
        page_data = fetch_page(offset)
        
        if page_data is None:
            print("   ⚠️  Failed to fetch, waiting 5 minutes and retrying...")
            state["offset"] = offset
            save_state(state)
            save_cache(exercises)
            time.sleep(300)  # Wait 5 minutes instead of stopping
            continue  # Retry the same offset
        
        if len(page_data) == 0:
            consecutive_empty += 1
            if consecutive_empty >= 3:
                print("\n✅ Reached end of exercises!")
                break
        else:
            consecutive_empty = 0
            
            # Add new exercises
            new_count = 0
            for ex in page_data:
                normalized = normalize_exercise(ex)
                if normalized["exerciseId"] and normalized["exerciseId"] not in existing_ids:
                    exercises.append(normalized)
                    existing_ids.add(normalized["exerciseId"])
                    new_count += 1
            
            print(f"   Added {new_count} new exercises (total: {len(exercises)})")
        
        # Update state
        offset += PAGE_SIZE
        state["offset"] = offset
        state["last_fetch"] = datetime.now().isoformat()
        
        # Save progress every page
        save_state(state)
        save_cache(exercises)
        
        # Rate limit delay
        time.sleep(DELAY_BETWEEN_REQUESTS)
    
    # Complete!
    print("\n" + "=" * 50)
    print(f"✅ Fetch complete!")
    print(f"   Total exercises: {len(exercises)}")
    print(f"   Cache file: {CACHE_FILE}")
    print(f"\n📋 Run this to rebuild the mapping:")
    print(f"   npx ts-node scripts/build-exercisedb-mapping.ts")
    
    # Clean up state file
    if STATE_FILE.exists():
        STATE_FILE.unlink()
    
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⏸️  Interrupted. Progress saved. Run again to continue.")
        sys.exit(1)
