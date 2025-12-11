#this script starts the browser and covers the desktop with a black overlay 
#(called from autostart config)

#!/usr/bin/env bash

# Ensure X is ready
export DISPLAY=${DISPLAY:-:0}
for _ in {1..20}; do
  if xdpyinfo >/dev/null 2>&1; then
    break
  fi
  sleep 0.3
done
sleep 0.5

# Hide desktop to prevent user interaction during startup
# Remove LXDE panel/taskbar and desktop icons (pcmanfm)
pkill lxpanel 2>/dev/null || true
pkill pcmanfm 2>/dev/null || true

# Black out background and hide cursor
xsetroot -solid black 2>/dev/null || true
unclutter -idle 0.1 -root 2>/dev/null &

# Fullscreen black overlay (tkinter)
python3 - <<'PY' &
import tkinter as tk
root = tk.Tk()
root.configure(bg='black')
root.overrideredirect(True)
root.attributes('-topmost', True)
# Force fullscreen geometry to cover the entire display
w, h = root.winfo_screenwidth(), root.winfo_screenheight()
root.geometry(f"{w}x{h}+0+0")
root.attributes('-fullscreen', True)
root.update_idletasks()
root.after(300000, root.destroy)  # safety timeout
root.mainloop()
PY
OVERLAY_PID=$!

# API health check URL (Core API endpoint)
API_URL="${CORE_API_URL:-https://sweet-api.sweetcontrol.be/api/sugar}"
CHECK_INTERVAL=10  # Check every 10 seconds
MAX_FAILURES=3     # Restart after 3 consecutive failures
CHROMIUM_PID=""    # Will be set when Chromium starts

# Function to check if Core API is accessible
check_api_health() {
  # Use curl with timeout to check API
  # Returns 0 if API is healthy, 1 if there's an error (Cloudflare error, connection failure, etc.)
  local response
  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$API_URL" 2>/dev/null)
  
  # HTTP 200-299 = healthy
  # HTTP 502, 503, 504 = Cloudflare/backend errors
  # HTTP 000 = connection failure/timeout
  if [[ "$response" =~ ^[2][0-9][0-9]$ ]]; then
    return 0  # Healthy
  else
    echo "[MONITOR] API check failed: HTTP $response"
    return 1  # Unhealthy
  fi
}

# Function to start Chromium
start_chromium() {
  chromium \
    --no-default-browser-check \
    --no-first-run \
    --password-store=basic \
    --disable-session-crashed-bubble \
    --disable-infobars \
    --user-data-dir=/home/emile/.config/chromium-sweetgrafiek \
    --start-fullscreen \
    "https://sweet-web.sweetcontrol.be/grafiek" &
  CHROMIUM_PID=$!
  echo "[MONITOR] Chromium started with PID $CHROMIUM_PID"
}

# Function to kill Chromium
kill_chromium() {
  if [[ -n "$CHROMIUM_PID" ]] && kill -0 "$CHROMIUM_PID" 2>/dev/null; then
    echo "[MONITOR] Killing Chromium (PID $CHROMIUM_PID)"
    kill "$CHROMIUM_PID" 2>/dev/null || true
    sleep 2
    # Force kill if still running
    kill -9 "$CHROMIUM_PID" 2>/dev/null || true
  fi
  # Also kill any remaining chromium processes
  pkill -f "chromium.*sweet-web.sweetcontrol.be" 2>/dev/null || true
  sleep 1
}

# Start Chromium initially
start_chromium

# Keep overlay for at least 5 seconds to cover the desktop
sleep 7
kill $OVERLAY_PID 2>/dev/null || true

# Monitoring loop
failure_count=0
while true; do
  sleep "$CHECK_INTERVAL"
  
  # Check if Chromium process is still running
  if ! kill -0 "$CHROMIUM_PID" 2>/dev/null; then
    echo "[MONITOR] Chromium process not found, restarting..."
    failure_count=$MAX_FAILURES  # Force restart
  else
    # Check API health
    if check_api_health; then
      # API is healthy, reset failure count
      if [[ $failure_count -gt 0 ]]; then
        echo "[MONITOR] API is healthy again, resetting failure count"
      fi
      failure_count=0
    else
      failure_count=$((failure_count + 1))
      echo "[MONITOR] API check failed ($failure_count/$MAX_FAILURES)"
    fi
  fi
  
  # Restart Chromium if we've hit the failure threshold
  if [[ $failure_count -ge $MAX_FAILURES ]]; then
    echo "[MONITOR] Restarting Chromium due to API failures or process crash"
    kill_chromium
    sleep 2
    start_chromium
    failure_count=0
  fi
done
