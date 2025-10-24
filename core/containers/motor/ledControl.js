import { execSync } from "child_process";

const pins = {
  up: 17,
  down: 27,
  left: 22,
  right: 23,
  grab: 24,
  sugar: 25,
};

// Initialize all pins
for (const pin of Object.values(pins)) {
  try {
    execSync(`gpioset gpiochip0 ${pin}=0`);
  } catch (e) {
    console.warn(`⚠️ Couldn't init GPIO ${pin}:`, e.message);
  }
}

function resetLeds() {
  for (const pin of Object.values(pins)) {
    try {
      execSync(`gpioset gpiochip0 ${pin}=0`);
    } catch {}
  }
}

// --- NEW: control sugar lamp ---
let sugarBlinkInterval = null;

export function setSugarLamp(on) {
  const pin = pins.sugar;
  if (!pin) return;

  // Stop any running blink
  if (sugarBlinkInterval) {
    clearInterval(sugarBlinkInterval);
    sugarBlinkInterval = null;
    try { execSync(`gpioset gpiochip0 ${pin}=0`); } catch {}
  }

  if (on) {
    // Start blinking every 300 ms
    sugarBlinkInterval = setInterval(() => {
      try {
        execSync(`gpioset gpiochip0 ${pin}=1`);
        setTimeout(() => execSync(`gpioset gpiochip0 ${pin}=0`), 120);
      } catch {}
    }, 300);
  }
}

export function setDirection(direction) {
  console.log(`🟢 Blink direction: ${direction}`);
  resetLeds();

  const pin = pins[direction];
  if (pin === undefined) return;

  try {
    if (direction === "grab") {
      // Quick blink pattern for grab
      let count = 0;
      const blink = setInterval(() => {
        try {
          execSync(`gpioset gpiochip0 ${pin}=1`);
          setTimeout(() => execSync(`gpioset gpiochip0 ${pin}=0`), 100);
        } catch {}
        count++;
        if (count >= 5) clearInterval(blink);
      }, 200);
    } else {
      execSync(`gpioset gpiochip0 ${pin}=1`);
      setTimeout(() => {
        try { execSync(`gpioset gpiochip0 ${pin}=0`); } catch {}
      }, 200);
    }
  } catch (e) {
    console.warn(`⚠️ Failed to blink GPIO ${pin}:`, e.message);
  }
}

process.on("SIGINT", () => {
  resetLeds();
  process.exit();
});
