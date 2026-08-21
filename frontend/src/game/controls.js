export function createControls() {
  const input = {
    throttle: false,
    brake: false,
    reverse: false,
    left: false,
    right: false,
    reset: false,
  };

  const down = new Set();

  function applyKeys() {
    input.throttle = down.has("KeyW") || down.has("ArrowUp");
    input.brake = down.has("Space");
    input.reverse = down.has("KeyS") || down.has("ArrowDown");
    input.left = down.has("KeyA") || down.has("ArrowLeft");
    input.right = down.has("KeyD") || down.has("ArrowRight");
    input.reset = down.has("KeyR");
  }

  window.addEventListener("keydown", (e) => {
    down.add(e.code);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
    applyKeys();
  });
  window.addEventListener("keyup", (e) => {
    down.delete(e.code);
    applyKeys();
  });

  function bindTouch(el, prop) {
    if (!el) return;
    const on = (ev) => { ev.preventDefault(); input[prop] = true; };
    const off = (ev) => { ev.preventDefault(); input[prop] = false; };
    el.addEventListener("pointerdown", on);
    el.addEventListener("pointerup", off);
    el.addEventListener("pointerleave", off);
    el.addEventListener("pointercancel", off);
  }

  bindTouch(document.getElementById("btn-gas"), "throttle");
  bindTouch(document.getElementById("btn-brake"), "brake");

  // ── Joystick steer zone ────────────────────────────────────────────────────
  // Left half of screen: drag horizontally to steer. Threshold is small so any
  // intentional swipe registers immediately.
  const steerZone = document.getElementById("steer-zone");
  const steerKnob = document.getElementById("steer-knob");
  const STEER_THRESHOLD = 14; // px before left/right engages
  const STEER_FULL = 52;      // px for full lock
  let steerPointerId = null;
  let steerOriginX = 0;
  let steerOffsetX = 0;

  function updateSteer(dx) {
    steerOffsetX = Math.max(-STEER_FULL, Math.min(STEER_FULL, dx));
    if (steerKnob) {
      steerKnob.style.transform = `translateX(${steerOffsetX}px)`;
    }
    input.left  = dx < -STEER_THRESHOLD;
    input.right = dx > STEER_THRESHOLD;
  }

  if (steerZone) {
    steerZone.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      steerPointerId = e.pointerId;
      steerOriginX = e.clientX;
      steerZone.setPointerCapture(e.pointerId);
      updateSteer(0);
    });
    steerZone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== steerPointerId) return;
      e.preventDefault();
      updateSteer(e.clientX - steerOriginX);
    });
    const endSteer = (e) => {
      if (e.pointerId !== steerPointerId) return;
      steerPointerId = null;
      updateSteer(0);
      input.left = false;
      input.right = false;
    };
    steerZone.addEventListener("pointerup", endSteer);
    steerZone.addEventListener("pointercancel", endSteer);
    steerZone.addEventListener("pointerleave", endSteer);
  }

  const resetBtn = document.getElementById("btn-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", (e) => {
      e.preventDefault();
      input.reset = true;
    });
  }

  return input;
}

export function consumeReset(input) {
  if (!input.reset) return false;
  input.reset = false;
  return true;
}

export function isMobileUi() {
  return window.matchMedia("(pointer: coarse), (max-width: 900px)").matches;
}
