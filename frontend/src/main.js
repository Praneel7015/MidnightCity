import { startGame } from "./game/loop.js";

const canvas = document.getElementById("view");
const err = document.getElementById("boot-error");

startGame(canvas).catch((e) => {
  console.error(e);
  if (err) {
    err.hidden = false;
    err.textContent = `Could not start Midnight City: ${e.message || e}`;
  }
});
