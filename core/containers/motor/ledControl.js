import { execSync } from "child_process";

const pins = {
  up: 17,
  down: 27,
  left: 22,
  right: 23,
  grab: 24,
};

// Initialize all pins as output and off
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

export function setDirection(direction) {
  console.log(`🟢 Blink direction: ${direction}`);
  resetLeds();

  const pin = pins[direction];
  if (pin === undefined) return;

  try {
    if (direction === "grab") {
      // Special blink pattern for grab: 3 quick flashes
      let count = 0;
      const blink = setInterval(() => {
        try {
          execSync(`gpioset gpiochip0 ${pin}=1`);
          setTimeout(() => execSync(`gpioset gpiochip0 ${pin}=0`), 100);
        } catch {}
        count++;
        if (count >= 5) clearInterval(blink);
      }, 200); // delay between blinks
    } else {
      // Normal single blink for directions
      execSync(`gpioset gpiochip0 ${pin}=1`);
      setTimeout(() => {
        try {
          execSync(`gpioset gpiochip0 ${pin}=0`);
        } catch {}
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
