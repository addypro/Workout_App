#!/usr/bin/env python3
"""
Hevy Exercise Database - API Fetcher
Uses the official Hevy API to fetch ALL exercise templates.

REQUIRES: HEVY_API_KEY environment variable
Get your API key from: Hevy App > Account Settings > API Access
"""

import os
import requests
import json
import time

def fetch_hevy_exercises():
    """Fetch all exercises from Hevy API."""
    
    api_key = os.environ.get('HEVY_API_KEY')
    if not api_key:
        print("❌ Error: HEVY_API_KEY environment variable not set")
        print("\nTo get your API key:")
        print("1. Open Hevy app or web")
        print("2. Go to Account Settings > API Access")
        print("3. Generate a new API key")
        print("\nThen run: HEVY_API_KEY=your_key python3 scripts/fetch-hevy-api.py")
        return None
    
    print("=" * 70)
    print("HEVY API EXERCISE FETCHER")
    print("=" * 70)
    
    base_url = "https://api.hevyapp.com/v1/exercise_templates"
    headers = {
        "accept": "application/json",
        "api-key": api_key
    }
    
    all_exercises = []
    page = 1
    page_size = 100  # Max allowed
    
    while True:
        print(f"Fetching page {page} (pageSize={page_size})...")
        
        try:
            response = requests.get(
                base_url,
                headers=headers,
                params={"page": page, "pageSize": page_size},
                timeout=15
            )
            
            if response.status_code == 401:
                print("❌ Authentication failed. Invalid API key.")
                return None
            
            if response.status_code != 200:
                print(f"❌ API error: {response.status_code}")
                print(response.text)
                break
            
            data = response.json()
            templates = data.get("exercise_templates", [])
            
            if not templates:
                print(f"✓ No more exercises on page {page}. Done!")
                break
            
            for template in templates:
                exercise = {
                    "id": template.get("id"),
                    "name": template.get("title"),
                    "muscle_group": template.get("primary_muscle_group"),
                    "secondary_muscles": template.get("secondary_muscle_groups", []),
                    "equipment": template.get("equipment_category"),
                    "exercise_type": template.get("exercise_type"),
                    "is_custom": template.get("is_custom", False),
                }
                all_exercises.append(exercise)
            
            print(f"  ✓ Got {len(templates)} exercises. Total: {len(all_exercises)}")
            
            # Check if we got fewer than page_size (last page)
            if len(templates) < page_size:
                break
            
            page += 1
            time.sleep(0.3)  # Rate limit
            
        except Exception as e:
            print(f"❌ Error: {e}")
            break
    
    # Sort by name
    all_exercises.sort(key=lambda x: x["name"] or "")
    
    # Separate default vs custom exercises
    default_exercises = [e for e in all_exercises if not e["is_custom"]]
    custom_exercises = [e for e in all_exercises if e["is_custom"]]
    
    # Save to JSON
    output = {
        "meta": {
            "source": "Hevy API v1",
            "total_count": len(all_exercises),
            "default_exercises": len(default_exercises),
            "custom_exercises": len(custom_exercises),
            "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        },
        "exercises": default_exercises  # Only default exercises (the official library)
    }
    
    with open('data/hevy_api_database.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print("\n" + "=" * 70)
    print("✅ FETCH COMPLETE!")
    print("=" * 70)
    print(f"   Total exercises: {len(all_exercises)}")
    print(f"   Default (official): {len(default_exercises)}")
    print(f"   Custom (user-created): {len(custom_exercises)}")
    print(f"\n📁 Saved to: data/hevy_api_database.json")
    
    # Show sample
    print("\n📋 Sample exercises:")
    for ex in default_exercises[:15]:
        muscles = ex['muscle_group'] or 'Unknown'
        equip = ex['equipment'] or 'Unknown'
        print(f"   {ex['name']:<45} | {muscles:<15} | {equip}")
    
    return all_exercises


if __name__ == "__main__":
    fetch_hevy_exercises()
