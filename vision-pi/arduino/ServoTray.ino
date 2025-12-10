#include <Servo.h>
#include <Arduino_LED_Matrix.h>

Servo servoL, servoR;
ArduinoLEDMatrix matrix;

// ---- SERVO RANGE ----
const int MIN_US = 500;      // absolute safe min for your servo
const int MAX_US = 2500;     // absolute safe max for your servo

// ---- TUNE THESE ----
const int SERVO_L_PIN = 9;
const int SERVO_R_PIN = 10;

// Left servo endpoints (microseconds) — tune these for your mechanics
// We keep the same rotation direction you're seeing now,
// but use almost full range for a big flip.
int L_UP_US   = 800;         // tray "UP" / rest (around 90°)
int L_DOWN_US = MAX_US;      // tray "DOWN" / dump (max in that direction)

// Fine alignment for the right side (+/- a few tens of µs)
int R_TRIM_US = 0;           // try e.g. +20 or -20 if sides aren't perfectly level

// Motion
const int STEP_US = 10;               // µs per step
const int STEP_DELAY_MS = 4;          // ms per step
const unsigned long HOLD_MS = 1000;   // 1 s holds

// Track last left-side position so we can sweep smoothly
int last_L_us;

// -------- LED MATRIX FLASHING --------
const unsigned long FLASH_INTERVAL_MS = 80;

bool flashing = false;
bool flashState = false;
unsigned long lastFlash = 0;

// two simple frames: all OFF / all ON
uint8_t flashOff[8][12];
uint8_t flashOn[8][12];

void initFlashFrames() {
  for (int y = 0; y < 8; y++) {
    for (int x = 0; x < 12; x++) {
      flashOff[y][x] = 0;
      flashOn[y][x]  = 1;
    }
  }
}

void startFlash() {
  flashing = true;
  flashState = false;
  lastFlash = 0;
  matrix.renderBitmap(flashOff, 8, 12);
}

void stopFlash() {
  flashing = false;
  matrix.renderBitmap(flashOff, 8, 12); // ensure off
}

// called frequently while the tray is moving / waiting
void flashUpdate() {
  if (!flashing) return;

  unsigned long now = millis();
  if (now - lastFlash >= FLASH_INTERVAL_MS) {
    lastFlash = now;
    flashState = !flashState;
    if (flashState) {
      matrix.renderBitmap(flashOn, 8, 12);
    } else {
      matrix.renderBitmap(flashOff, 8, 12);
    }
  }
}

// like delay(ms) but keeps LED matrix flashing
void waitWithFlash(unsigned long durationMs) {
  unsigned long start = millis();
  while (millis() - start < durationMs) {
    flashUpdate();
    delay(5);   // small sleep so we don't hammer the CPU
  }
}
// -------------------------------------

inline int mirrorRight(int left_us) {
  // Mirror around 1500 and add trim. Constrain to safe range.
  int r = (3000 - left_us) + R_TRIM_US;
  if (r < MIN_US)  r = MIN_US;
  if (r > MAX_US)  r = MAX_US;
  return r;
}

// Attach servos only when needed (so they don't hold position all the time)
void ensureServosAttached() {
  if (!servoL.attached()) {
    servoL.attach(SERVO_L_PIN, MIN_US, MAX_US);
  }
  if (!servoR.attached()) {
    servoR.attach(SERVO_R_PIN, MIN_US, MAX_US);
  }
}

void writeBoth(int l_us) {
  servoL.writeMicroseconds(l_us);
  servoR.writeMicroseconds(mirrorRight(l_us));
}

void smoothMoveMirrored(int l_from, int l_to) {
  int step = (l_to > l_from) ? STEP_US : -STEP_US;
  for (int u = l_from; u != l_to; u += step) {
    writeBoth(u);
    flashUpdate();              // keep flashing while moving
    delay(STEP_DELAY_MS);
  }
  writeBoth(l_to);
  last_L_us = l_to;
}

void traySequence() {
  // Attach servos only for the duration of the sequence
  ensureServosAttached();

  // Flash the LED matrix while the tray is doing its full drop sequence
  startFlash();

  // Down → wait → Up → Down → wait → Up (mirrored)
  smoothMoveMirrored(last_L_us, L_DOWN_US);
  waitWithFlash(HOLD_MS);

  smoothMoveMirrored(last_L_us, L_UP_US);
  smoothMoveMirrored(last_L_us, L_DOWN_US);
  waitWithFlash(HOLD_MS);

  smoothMoveMirrored(last_L_us, L_UP_US);

  stopFlash();

  // Detach so servos don't fight the wooden support or hold torque
  servoL.detach();
  servoR.detach();
}

void setup() {
  // Attach once at boot to move to a known safe rest position,
  // then immediately detach so they don't hold.
  servoL.attach(SERVO_L_PIN, MIN_US, MAX_US);
  servoR.attach(SERVO_R_PIN, MIN_US, MAX_US);

  last_L_us = L_UP_US;
  writeBoth(last_L_us);

  servoL.detach();
  servoR.detach();

  Serial.begin(115200);
  Serial.println("TRAYCTRL READY");

  // LED matrix init
  matrix.begin();
  initFlashFrames();
  matrix.renderBitmap(flashOff, 8, 12);  // start OFF
}

void loop() {
  // Simple line protocol: TRAY, PING, and quick tuning:
  static String line;
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (line.length()) {
        handleCmd(line);
        line = "";
      }
    } else line += c;
  }

  // (nothing else here – traySequence() handles its own flashing)
}

void handleCmd(String cmd) {
  cmd.trim(); cmd.toUpperCase();

  if (cmd == "PING") { Serial.println("PONG"); return; }
  if (cmd == "TRAY") { Serial.println("SEQ START"); traySequence(); Serial.println("SEQ DONE"); return; }

  // Live tuning from the Pi/laptop if needed:
  // e.g. "SET LUP 1520", "SET LDOWN 790", "SET RTRIM 20"
  if (cmd.startsWith("SET LUP ")) {
    int v = cmd.substring(8).toInt();
    if (v >= MIN_US && v <= MAX_US) {
      L_UP_US = v;
      Serial.println("OK LUP");
    } else {
      Serial.println("ERR");
    }
    return;
  }

  if (cmd.startsWith("SET LDOWN ")) {
    int v = cmd.substring(10).toInt();
    if (v >= MIN_US && v <= MAX_US) {
      L_DOWN_US = v;
      Serial.println("OK LDOWN");
    } else {
      Serial.println("ERR");
    }
    return;
  }

  if (cmd.startsWith("SET RTRIM ")) {
    int v = cmd.substring(10).toInt();
    if (v > -400 && v < 400) {
      R_TRIM_US = v;
      Serial.println("OK RTRIM");
    } else {
      Serial.println("ERR");
    }
    return;
  }

  Serial.println("ERR CMD");
}
