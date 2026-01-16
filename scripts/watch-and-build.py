#!/usr/bin/env python3
"""
Watch & Build Pipeline

Monitors the ExerciseDB fetch progress and automatically runs the mapping
builder when new exercises are fetched.

Usage:
    python3 scripts/watch-and-build.py [--once] [--interval SECONDS]

Options:
    --once      Run mapping once and exit (don't watch)
    --interval  Seconds between progress checks (default: 30)
"""

import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

# Configuration
DATA_DIR = Path(__file__).parent.parent / "data"
CACHE_FILE = DATA_DIR / "exercisedb-cache.json"
MAPPING_FILE = DATA_DIR / "exercisedb-mapping.json"
STATE_FILE = DATA_DIR / ".exercisedb-fetch-state.json"

# Watch settings
CHECK_INTERVAL = 30  # seconds
STABLE_CYCLES_BEFORE_REBUILD = 3  # rebuild after N stable cycles


def get_cache_count() -> int:
    """Get the number of exercises in the cache."""
    if not CACHE_FILE.exists():
        return 0
    try:
        with open(CACHE_FILE) as f:
            cache = json.load(f)
            return len(cache.get("exercises", []))
    except Exception:
        return 0


def get_mapping_stats() -> dict:
    """Get current mapping statistics."""
    if not MAPPING_FILE.exists():
        return {"matched": 0, "total": 0}
    try:
        with open(MAPPING_FILE) as f:
            mapping = json.load(f)
            stats = mapping.get("stats", {})
            return {
                "matched": stats.get("matched", 0),
                "total": stats.get("totalTaxonomy", 0),
                "matchRate": stats.get("matchRate", "0%"),
            }
    except Exception:
        return {"matched": 0, "total": 0}


def is_fetcher_running() -> bool:
    """Check if the Python fetcher is still running."""
    return STATE_FILE.exists()


def run_mapping_builder():
    """Run the TypeScript mapping builder."""
    print("\n🔧 Running mapping builder...")
    try:
        result = subprocess.run(
            ["npx", "ts-node", "scripts/build-exercisedb-mapping.ts"],
            cwd=Path(__file__).parent.parent,
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode == 0:
            print("✅ Mapping rebuilt successfully!")
            # Show stats
            stats = get_mapping_stats()
            print(f"   Matched: {stats['matched']}/{stats['total']} ({stats['matchRate']})")
        else:
            print(f"❌ Mapping build failed: {result.stderr}")
    except subprocess.TimeoutExpired:
        print("❌ Mapping build timed out")
    except Exception as e:
        print(f"❌ Error running mapping builder: {e}")


def watch_and_build(interval: int = CHECK_INTERVAL):
    """Watch for changes and rebuild mapping when appropriate."""
    print("👀 Watch & Build Pipeline")
    print("=" * 50)
    
    last_count = get_cache_count()
    stable_cycles = 0
    last_rebuild_count = 0
    
    print(f"📦 Current cache: {last_count} exercises")
    print(f"📊 Current mapping: {get_mapping_stats()['matched']} matched")
    print(f"⏱️  Checking every {interval}s (will rebuild after {STABLE_CYCLES_BEFORE_REBUILD} stable cycles)")
    print("-" * 50)
    
    while True:
        try:
            time.sleep(interval)
            
            current_count = get_cache_count()
            fetcher_running = is_fetcher_running()
            
            timestamp = datetime.now().strftime("%H:%M:%S")
            
            if current_count > last_count:
                # New exercises fetched
                delta = current_count - last_count
                print(f"[{timestamp}] 📥 +{delta} exercises (total: {current_count})")
                stable_cycles = 0
            else:
                stable_cycles += 1
                status = "🔄 fetching" if fetcher_running else "✅ complete"
                print(f"[{timestamp}] {status} | {current_count} exercises | stable: {stable_cycles}/{STABLE_CYCLES_BEFORE_REBUILD}")
            
            # Rebuild conditions:
            # 1. Fetcher finished and we have new exercises since last rebuild
            # 2. Been stable for N cycles with new data
            should_rebuild = (
                (not fetcher_running and current_count > last_rebuild_count) or
                (stable_cycles >= STABLE_CYCLES_BEFORE_REBUILD and current_count > last_rebuild_count)
            )
            
            if should_rebuild:
                run_mapping_builder()
                last_rebuild_count = current_count
                stable_cycles = 0
                
                if not fetcher_running:
                    print("\n🎉 Fetch complete. Final mapping built.")
                    break
            
            last_count = current_count
            
        except KeyboardInterrupt:
            print("\n⏹️  Stopped watching.")
            break


def run_once():
    """Run the mapping builder once."""
    cache_count = get_cache_count()
    print(f"📦 Current cache: {cache_count} exercises")
    run_mapping_builder()


def main():
    args = sys.argv[1:]
    
    if "--once" in args:
        run_once()
    else:
        interval = CHECK_INTERVAL
        if "--interval" in args:
            try:
                idx = args.index("--interval")
                interval = int(args[idx + 1])
            except (IndexError, ValueError):
                pass
        watch_and_build(interval)


if __name__ == "__main__":
    main()
