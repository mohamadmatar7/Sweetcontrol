#this script starts the browser (called from autostart config)

#!/usr/bin/env bash

# wait for desktop to load
sleep 10

chromium \
  --no-default-browser-check \
  --no-first-run \
  --password-store=basic \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --user-data-dir=/home/emile/.config/chromium-sweetgrafiek \
  --start-fullscreen \
  "https://sweet-web.sweetcontrol.be/grafiek"
