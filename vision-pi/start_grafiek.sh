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

# Fullscreen black overlay (tkinter) with text
python3 - <<'PY' &
import tkinter as tk
from tkinter import font

root = tk.Tk()
root.configure(bg='black')
root.overrideredirect(True)
root.attributes('-topmost', True)
# Force fullscreen geometry to cover the entire display
w, h = root.winfo_screenwidth(), root.winfo_screenheight()
root.geometry(f"{w}x{h}+0+0")
root.attributes('-fullscreen', True)

# Add text label
label = tk.Label(
    root,
    text="Even geduld, de machine is aan het opstarten",
    bg='black',
    fg='white',
    font=('Arial', 24, 'normal')
)
label.place(relx=0.5, rely=0.5, anchor='center')

root.update_idletasks()
root.after(300000, root.destroy)  # safety timeout
root.mainloop()
PY
OVERLAY_PID=$!

# Wait 60 seconds with black overlay
sleep 60

# Start Chromium
chromium \
  --no-default-browser-check \
  --no-first-run \
  --password-store=basic \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --user-data-dir=/home/emile/.config/chromium-sweetgrafiek \
  --start-fullscreen \
  "https://sweet-web.sweetcontrol.be/graph" &

# Wait 5 seconds after Chrome opens, then remove overlay
sleep 5
kill $OVERLAY_PID 2>/dev/null || true
