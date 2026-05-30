"""
MatchPro™ — Scheduler
Runs via OpenClaw cron — called as: python3 scheduler.py morning|evening
"""
import sys, os

# Ensure we can import sibling modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine import run_cycle

if __name__ == "__main__":
    cycle_type = sys.argv[1] if len(sys.argv) > 1 else "morning"
    if cycle_type not in ("morning", "evening"):
        print(f"Usage: python3 scheduler.py morning|evening")
        sys.exit(1)
    run_cycle(cycle_type)
