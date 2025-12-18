#!/usr/bin/env python3
import os
os.environ.setdefault("QT_QPA_PLATFORM", "xcb")  # Qt/Wayland fix

import cv2 as cv
import numpy as np
import tflite_runtime.interpreter as tflite
import time, serial, glob, traceback, sys
import requests  # HTTP client to talk to Core/API

BASE_DIR = "/home/emile/clawTM"
MODEL_PATH = os.path.join(BASE_DIR, "model.tflite")
LABELS_PATH = os.path.join(BASE_DIR, "labels.txt")

# ---- Camera / ROI ----
# SMALL  (224,168,192,144)   # 30% area
# MEDIUM (160,120,320,240)   # 50% area
# LARGE  (96,72,448,336)     # 70% area
ROI = (125, 50, 420, 350)  # x, y, w, h

# ---- Thresholds and timings ----
PROB_THR       = 0.80   # min. confidence for a class
STABLE_TIME    = 2.0    # seconds the same class must be stable
SHOW_TEXT_TIME = 5.0    # seconds to show big text after drop
COOLDOWN       = 4.0    # seconds between two drops
TARGET_FPS     = 10.0   # max FPS
RESTART_DELAY  = 5.0    # seconds to wait before restart
MAX_CAMERA_FAILS = 10   # consecutive read errors before restart
TRAY_HEARTBEAT_INTERVAL = 5.0   # seconds between heartbeat PINGs
TRAY_HEARTBEAT_TIMEOUT = 0.5    # max wait time for PONG
MAX_TRAY_HEARTBEAT_FAILS = 10    # after so many misses -> restart
EMPTY_UNSURE_THR = 0.50         # if empty prob stays below this...
EMPTY_UNSURE_TIME = 20.0        # ...for this long, force a tray clear

# Headless recovery prevents OpenCV windows from grabbing focus on kiosk restarts
HEADLESS_AFTER_RECOVERY = os.environ.get(
    "HEADLESS_AFTER_RECOVERY",
    "1"
).lower() not in ("0", "false", "no")

WINDOW_TITLE = "TM LIVE classifier + tray + Core HTTP"

# ---- Arduino (tray) ----
ARDUINO_BAUD = 115200

# ---- Core API (HTTP to Core Pi / API) ----
# IMPORTANT:
# - CORE_URL must point to your core-value endpoint
# - You can override via env var CORE_API_URL if needed
CORE_URL = os.environ.get(
    "CORE_API_URL",
    "https://sweet-api.sweetcontrol.be/api/core-value"
)

# Mapping from label -> numeric effect value sent to Core API.
# Keep label strings in sync with labels.txt (order does not matter).
VALUE_MAP = {
    "insuline": -45,
    "Cola": 35,
    "Schoen": -19,
    "Appel": 11,
    "Donut": 21,  # New label - adjust value as needed
    "gewicht": -12,  # New label - adjust value as needed
    # "Niks" deliberately has no numeric value
}


class RecoverableHardwareError(RuntimeError):
    """Used to signal hardware problems that require a restart."""


def wait_and_exit(msg=None):
    """Show error and wait for ENTER so the terminal window does not close immediately."""
    if msg:
        print("\n" + "=" * 60)
        print("FATAL ERROR:")
        print(msg)
        print("=" * 60)
    else:
        print("\nProgram finished.")
    try:
        input("\nPress ENTER to close this window...")
    except EOFError:
        # If there is no stdin (some desktop setups), just exit
        pass
    sys.exit(1)


def load_labels(path):
    """
    Reads labels.txt and supports both:
      - '0 Cola'
      - 'Cola'
    """
    if not os.path.exists(path):
        wait_and_exit(f"labels.txt not found at: {path}")
    lines = [l.strip() for l in open(path).read().splitlines() if l.strip()]
    if not lines:
        wait_and_exit("labels.txt is empty.")
    labels = []
    for l in lines:
        if " " in l and l.split(" ", 1)[0].isdigit():
            _, name = l.split(" ", 1)
            labels.append(name.strip())
        else:
            labels.append(l)
    return labels


def is_empty_label(label: str) -> bool:
    """Return True if the label is considered 'empty' / no-object."""
    return label.strip().lower() in ("nothing", "niets", "niks", "empty", "none")


def find_arduino():
    """Search for an Arduino that returns PONG after PING."""
    for pat in ("/dev/ttyACM*", "/dev/ttyUSB*"):
        for dev in glob.glob(pat):
            try:
                s = serial.Serial(dev, ARDUINO_BAUD, timeout=0.3)
                time.sleep(0.3)
                s.reset_input_buffer()
                s.write(b"PING\n")
                time.sleep(0.3)
                r = s.read(128)
                if b"PONG" in r:
                    return s
                s.close()
            except Exception as e:
                print(f"[ARDUINO] Error probing {dev}: {e}")
    return None


def ensure_tray_serial():
    """Open the tray Arduino serial connection or raise a recoverable error."""
    ser = find_arduino()
    if not ser:
        raise RecoverableHardwareError(
            "Arduino not found. Check the USB cable and reset the Arduino."
        )
    print("Arduino found on", ser.port)
    return ser


def tray_ping(tray_ser, timeout=TRAY_HEARTBEAT_TIMEOUT):
    """
    Periodic heartbeat so we quickly detect disconnects.
    Returns True on PONG, False on timeout.
    """
    if not tray_ser or not getattr(tray_ser, "is_open", False):
        raise RecoverableHardwareError("Arduino serial port is closed.")

    old_timeout = getattr(tray_ser, "timeout", None)
    try:
        tray_ser.timeout = timeout
        tray_ser.reset_input_buffer()
        tray_ser.write(b"PING\n")
        tray_ser.flush()
        deadline = time.time() + timeout
        while time.time() < deadline:
            data = tray_ser.read(64)
            if data and b"PONG" in data:
                return True
        return False
    except Exception as e:
        raise RecoverableHardwareError(
            f"Arduino connection lost: {e}"
        ) from e
    finally:
        try:
            tray_ser.timeout = old_timeout
        except Exception:
            pass


def send_tray_command(tray_ser):
    """Send the TRAY command to the Arduino with proper error handling."""
    if not tray_ser:
        return
    try:
        tray_ser.write(b"TRAY\n")
    except Exception as e:
        raise RecoverableHardwareError(
            f"Arduino write error: {e}"
        ) from e


def ensure_camera(device_index=0):
    """Open the USB camera and configure basic resolution."""
    cap = cv.VideoCapture(device_index)
    cap.set(cv.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv.CAP_PROP_FRAME_HEIGHT, 480)
    if not cap.isOpened():
        cap.release()
        raise RecoverableHardwareError(
            "Could not open camera. Is the webcam connected?"
        )
    return cap


def cleanup_devices(cap=None, tray_ser=None, show_window=True):
    """Cleanly release camera and Arduino on exit."""
    if cap is not None:
        cap.release()
    if tray_ser is not None:
        try:
            tray_ser.close()
        except Exception:
            pass
    if show_window:
        cv.destroyAllWindows()


def send_to_core(val: int, label: str):
    """
    Send the numeric value + label to the Core/API over HTTP.

    The Core/API route:
      POST /api/core-value
      body: { value: number, label: string }
    """
    try:
        payload = {
            "value": val,
            "label": label,
        }
        # Short timeout so we never block the detection loop for long.
        r = requests.post(CORE_URL, json=payload, timeout=0.5)
        if not r.ok:
            print(f"[CORE] HTTP error: {r.status_code} {r.text}")
        else:
            print(f"[CORE] Sent value {val} ({label}) to Core/API over HTTP.")
    except Exception as e:
        print(f"[CORE] HTTP send error: {e}")


def make_interpreter():
    """Create and initialize the TFLite interpreter."""
    if not os.path.exists(MODEL_PATH):
        wait_and_exit(f"model.tflite not found at: {MODEL_PATH}")
    try:
        inter = tflite.Interpreter(model_path=MODEL_PATH, num_threads=2)
        inter.allocate_tensors()
        in_det = inter.get_input_details()[0]
        out_det = inter.get_output_details()[0]
        print("Input details:", in_det["shape"], in_det["dtype"])
        print("Output details:", out_det["shape"], out_det["dtype"])
        return inter, in_det, out_det
    except Exception as e:
        tb = traceback.format_exc()
        wait_and_exit(f"Error loading TFLite model:\n{e}\n\nTraceback:\n{tb}")


def preprocess_roi(frame, input_shape):
    """
    - Crop ROI
    - Resize to input_shape (usually 224x224)
    - BGR -> RGB
    - float32 in range 0..1
    """
    x, y, w, h = ROI
    roi = frame[y:y+h, x:x+w].copy()
    _, h_in, w_in, _ = input_shape   # [1, H, W, 3]
    resized = cv.resize(roi, (w_in, h_in), interpolation=cv.INTER_AREA)
    rgb = cv.cvtColor(resized, cv.COLOR_BGR2RGB)
    x = rgb.astype(np.float32) / 255.0
    x = np.expand_dims(x, 0)
    return x


def draw_center_text(img, text, seconds_left):
    """Draw a centered big text box with optional countdown."""
    h, w = img.shape[:2]
    font = cv.FONT_HERSHEY_SIMPLEX
    scale = 2.0
    (tw, th), _ = cv.getTextSize(text, font, scale, 4)
    x = (w - tw) // 2
    y = (h + th) // 2

    # Black background rectangle
    cv.rectangle(img, (x-25, y-th-25), (x+tw+25, y+25), (0,0,0), -1)
    cv.putText(img, text, (x, y), font, scale, (255,255,255), 4, cv.LINE_AA)

    # Optional countdown
    if seconds_left > 0:
        timer = f"{seconds_left:.1f}s"
        cv.putText(
            img,
            timer,
            (x+tw-40, y-th),
            cv.FONT_HERSHEY_SIMPLEX,
            0.7,
            (200,200,200),
            2,
            cv.LINE_AA,
        )


def run_detection(labels, interpreter, in_det, out_det, show_window=True):
    """Main detection loop: camera + Arduino + HTTP to Core."""
    tray_ser = None
    cap = None
    try:
        tray_ser = ensure_tray_serial()
        cap = ensure_camera()

        input_shape = in_det["shape"]

        # State for stable detection
        stable_label = None
        stable_since = None
        last_drop = 0.0

        # State for big text
        show_text = None
        show_until = 0.0

        last_print = 0.0
        frame_interval = 1.0 / TARGET_FPS
        frame_failures = 0
        last_tray_ping = 0.0
        tray_ping_failures = 0
        empty_unsure_since = None

        # Cache indices for empty labels so we can look up their probability fast
        empty_label_indices = [
            i for i, lbl in enumerate(labels) if is_empty_label(lbl)
        ]

        if show_window:
            print("TM LIVE detect with tray + Core HTTP… (Q = quit)")
        else:
            print("TM LIVE detect with tray + Core HTTP… (headless, Ctrl+C to stop)")

        while True:
            loop_start = time.time()

            ok, frame = cap.read()
            if not ok:
                frame_failures += 1
                print(f"[WARN] Could not read frame from camera (#{frame_failures}).")
                if frame_failures >= MAX_CAMERA_FAILS:
                    raise RecoverableHardwareError(
                        "Camera is not delivering frames anymore (too many read errors)."
                    )
                time.sleep(0.1)
                continue

            frame_failures = 0
            now = time.time()
            disp = frame.copy() if show_window else None

            # Heartbeat for the tray Arduino so we notice disconnects
            if now - last_tray_ping >= TRAY_HEARTBEAT_INTERVAL:
                last_tray_ping = now
                alive = tray_ping(tray_ser)
                if not alive:
                    tray_ping_failures += 1
                    print(f"[ARDUINO] Heartbeat missed ({tray_ping_failures}/{MAX_TRAY_HEARTBEAT_FAILS}).")
                    if tray_ping_failures >= MAX_TRAY_HEARTBEAT_FAILS:
                        raise RecoverableHardwareError(
                            "Arduino is no longer responding to heartbeat (check USB cable)."
                        )
                else:
                    tray_ping_failures = 0

            if show_window:
                # Draw ROI rectangle on preview
                x, y, w, h = ROI
                cv.rectangle(disp, (x,y), (x+w,y+h), (0,255,0), 2)

            # PREPROCESS: only ROI
            x_in = preprocess_roi(frame, input_shape)
            interpreter.set_tensor(in_det["index"], x_in)
            interpreter.invoke()
            out = interpreter.get_tensor(out_det["index"]).squeeze().astype(np.float32)

            # TM output usually already probabilities (sum ≈1, range [0,1])
            s = float(out.sum())
            if 0.99 <= s <= 1.01 and out.min() >= 0.0 and out.max() <= 1.0001:
                probs = out
            else:
                exps = np.exp(out - np.max(out))
                probs = exps / np.sum(exps)

            order = np.argsort(-probs)
            best = int(order[0])
            label_best = labels[best]
            p_best = float(probs[best])

            # Track probability for "empty"/"niks" label even if it is not on top
            p_empty = None
            if empty_label_indices:
                p_empty = float(np.max(probs[empty_label_indices]))

            # Debug: full list print every 0.5s
            if now - last_print > 0.5:
                tops = []
                for i in order[:len(labels)]:
                    tops.append(f"{labels[i]}:{probs[i]:.2f}")
                print("TOP:", ", ".join(tops))
                last_print = now

            if show_window:
                # Overlay text at top
                txt = f"{label_best} p:{p_best:.2f}"
                cv.putText(
                    disp,
                    txt,
                    (20, 40),
                    cv.FONT_HERSHEY_SIMPLEX,
                    0.9,
                    (0,255,0),
                    2,
                    cv.LINE_AA,
                )

                # Big text for recent drop
                if now < show_until and show_text:
                    draw_center_text(disp, show_text, show_until - now)

            # ---- tray + Core trigger logic ----
            armed = (now - last_drop) >= COOLDOWN
            empty = is_empty_label(label_best)

            # Only count non-empty with enough confidence
            candidate = label_best if (not empty and p_best >= PROB_THR) else None

            # If the model cannot be sure the tray is empty for a long period,
            # force a tray clear to avoid getting stuck with multiple objects.
            if p_empty is not None:
                if p_empty < EMPTY_UNSURE_THR:
                    if empty_unsure_since is None:
                        empty_unsure_since = now
                    elif (now - empty_unsure_since) >= EMPTY_UNSURE_TIME and armed:
                        print(
                            f"[SAFETY] Empty confidence low ({p_empty:.2f}) for "
                            f"{EMPTY_UNSURE_TIME:.0f}s -> forcing tray clear."
                        )
                        send_tray_command(tray_ser)
                        last_drop = now
                        empty_unsure_since = None
                        stable_label = None
                        stable_since = None
                        show_text = None
                else:
                    empty_unsure_since = None

            if candidate and armed:
                if stable_label == candidate:
                    if stable_since and (now - stable_since) >= STABLE_TIME:
                        print(f"[DROP] Object: {candidate} (p={p_best:.2f})")

                        # 1) Tilt tray via Arduino
                        send_tray_command(tray_ser)

                        # 2) Send value + label to Core/API over HTTP
                        val = VALUE_MAP.get(candidate)
                        if val is not None:
                            send_to_core(val, candidate)

                        last_drop = now
                        show_text = candidate
                        show_until = now + SHOW_TEXT_TIME
                        stable_label = None
                        stable_since = None
                else:
                    stable_label = candidate
                    stable_since = now
            else:
                stable_label = None
                stable_since = None

            if show_window:
                cv.imshow(WINDOW_TITLE, disp)
                k = cv.waitKey(1) & 0xFF
                if k in (ord('q'), 27):
                    break

            # ---- FPS limiter ----
            elapsed = time.time() - loop_start
            sleep_time = frame_interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

    finally:
        cleanup_devices(cap=cap, tray_ser=tray_ser, show_window=show_window)


def main():
    labels = load_labels(LABELS_PATH)
    print("Loaded labels:", labels)

    interpreter, in_det, out_det = make_interpreter()

    restart_attempt = 0
    headless_mode = False
    while True:
        try:
            run_detection(
                labels,
                interpreter,
                in_det,
                out_det,
                show_window=not headless_mode,
            )
            wait_and_exit("Program ended normally.")
        except RecoverableHardwareError as e:
            restart_attempt += 1
            if HEADLESS_AFTER_RECOVERY and not headless_mode:
                headless_mode = True
                print("[INFO] Headless recovery enabled: display window will stay hidden.")
            print("\n" + "=" * 60)
            print("HARDWARE PROBLEM:")
            print(e)
            print(f"Retrying in {RESTART_DELAY:.0f} seconds (attempt {restart_attempt}).")
            print("=" * 60)
            time.sleep(RESTART_DELAY)
        except KeyboardInterrupt:
            wait_and_exit("Program interrupted manually.")
        except Exception as e:
            tb = traceback.format_exc()
            wait_and_exit(f"Unexpected runtime error:\n{e}\n\nTraceback:\n{tb}")


if __name__ == "__main__":
    main()
