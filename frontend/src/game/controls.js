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
    const on = (ev) => {
      ev.preventDefault();
      input[prop] = true;
    };
    const off = (ev) => {
      ev.preventDefault();
      input[prop] = false;
    };
    el.addEventListener("pointerdown", on);
    el.addEventListener("pointerup", off);
    el.addEventListener("pointerleave", off);
    el.addEventListener("pointercancel", off);
  }

  bindTouch(document.getElementById("btn-gas"), "throttle");
  bindTouch(document.getElementById("btn-brake"), "brake");
  bindTouch(document.getElementById("btn-left"), "left");
  bindTouch(document.getElementById("btn-right"), "right");
  bindTouch(document.getElementById("btn-reverse"), "reverse");

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
