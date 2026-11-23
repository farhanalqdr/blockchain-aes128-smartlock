#!/usr/bin/env python3
"""GPIO relay control for Raspberry Pi. Invoke: python3 relay_control.py lock|unlock.

Safety: refuses real actuation until HARDWARE_MODE=true. Check the GPIO pin,
relay polarity, power supply, and physical fail-safe wiring before enabling.
"""
import os
import sys
import time


def enabled(name, default="false"):
    return os.environ.get(name, default).strip().lower() in ("true", "1", "yes")


def main():
    if len(sys.argv) != 2 or sys.argv[1].lower() not in ("lock", "unlock"):
        print("Usage: python3 relay_control.py lock|unlock", file=sys.stderr)
        return 2

    action = sys.argv[1].lower()
    if not enabled("HARDWARE_MODE"):
        print("Physical relay blocked: set HARDWARE_MODE=true only after hardware verification", file=sys.stderr)
        return 2

    pin = int(os.environ.get("RELAY_GPIO_PIN", "17"))
    if not 0 <= pin <= 27:
        raise ValueError("RELAY_GPIO_PIN must be a BCM GPIO number between 0 and 27")
    pulse_ms = int(os.environ.get("UNLOCK_PULSE_MS", "1000"))
    if not 100 <= pulse_ms <= 5000:
        raise ValueError("UNLOCK_PULSE_MS must be between 100 and 5000 ms")

    try:
        import RPi.GPIO as gpio
    except ImportError:
        print("RPi.GPIO is required on the Raspberry Pi for physical operation", file=sys.stderr)
        return 2

    # Active-low boards energize at LOW and turn off at HIGH.
    active_state = gpio.LOW if enabled("RELAY_ACTIVE_LOW", "true") else gpio.HIGH
    inactive_state = gpio.HIGH if active_state == gpio.LOW else gpio.LOW
    initialized = False
    try:
        gpio.setwarnings(False)
        gpio.setmode(gpio.BCM)
        gpio.setup(pin, gpio.OUT, initial=inactive_state)
        initialized = True
        if action == "unlock":
            gpio.output(pin, active_state)
            time.sleep(pulse_ms / 1000.0)
        print(f"Relay action completed: {action}")
        return 0
    finally:
        if initialized:
            # Fail closed: always deenergize following an unlock pulse or exception.
            gpio.output(pin, inactive_state)
            gpio.cleanup(pin)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(f"Relay action failed: {error}", file=sys.stderr)
        sys.exit(1)
