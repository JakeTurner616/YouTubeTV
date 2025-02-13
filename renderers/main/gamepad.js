(function handleGamepadInput() {
    // Define a local log function.
    function log(message) {
      try {
        require('electron').ipcRenderer.send('renderer-log', message);
      } catch (e) {
        console.error("IPC logging failed:", e);
      }
      console.log(message);
    }
  
    // Helper: Simulate Search Box Focus.
    function simulateSearchFocus() {
      const searchButton = document.querySelector(
        'ytlr-search-text-box.ytlr-search-bar__search-text-box > ytlr-text-box'
      );
      if (searchButton) {
        // Focus the element directly.
        searchButton.focus();
        // Create a series of mouse events to simulate a full click sequence.
        const mouseDownEvent = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        const mouseUpEvent = new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        searchButton.dispatchEvent(mouseDownEvent);
        searchButton.dispatchEvent(mouseUpEvent);
        searchButton.dispatchEvent(clickEvent);
        log('Simulated full click sequence on the search box.');
      } else {
        console.error('Search button element not found.');
      }
    }
  
    // Helper: Simulate a Key Event.
    function simulateKeyEvent(key) {
      log("Simulating key event for: " + key);
      const target = document.activeElement || document.body;
      const keydownEvent = new KeyboardEvent("keydown", {
        key: key,
        code: key,
        keyCode: key === "Enter" ? 13 : key === "Escape" ? 27 :
                 key === "ArrowUp" ? 38 : key === "ArrowDown" ? 40 :
                 key === "ArrowLeft" ? 37 : key === "ArrowRight" ? 39 : 0,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      target.dispatchEvent(keydownEvent);
      setTimeout(() => {
        const keyupEvent = new KeyboardEvent("keyup", {
          key: key,
          code: key,
          keyCode: key === "Enter" ? 13 : key === "Escape" ? 27 :
                   key === "ArrowUp" ? 38 : key === "ArrowDown" ? 40 :
                   key === "ArrowLeft" ? 37 : key === "ArrowRight" ? 39 : 0,
          bubbles: true,
          cancelable: true,
          composed: true
        });
        target.dispatchEvent(keyupEvent);
        log("Simulated keyup for: " + key);
      }, 50);
    }
  
    // Mapping from gamepad button indices to keyboard keys.
    // (Note: index 3 is intentionally left out because it is used to focus search.)
    const buttonMapping = {
      0: "Enter",      // A button
      1: "Escape",     // B button
      12: "ArrowUp",   // D-pad Up
      13: "ArrowDown", // D-pad Down
      14: "ArrowLeft", // D-pad Left
      15: "ArrowRight" // D-pad Right
    };
  
    // Object to track per-button state for each gamepad.
    const buttonState = {};
  
    // Variable to track the currently selected gamepad (highest index wins).
    let currentGamepadIndex = null;
  
    // Nonlinear delay function.
    function getDelay(heldTime) {
      const initialDelay = 500; // ms
      const minDelay = 100;     // ms
      const factor = 1000;      // time constant (ms)
      return Math.max(minDelay, initialDelay - (initialDelay - minDelay) * (1 - Math.exp(-heldTime / factor)));
    }
  
    // Gamepad connect/disconnect events.
    window.addEventListener('gamepadconnected', function (e) {
      const gp = e.gamepad;
      log("Gamepad connected: index=" + gp.index + ", id=" + gp.id +
          ", buttons=" + gp.buttons.length + ", axes=" + gp.axes.length);
      if (currentGamepadIndex === null || gp.index > currentGamepadIndex) {
        currentGamepadIndex = gp.index;
        log("Selected gamepad index updated to: " + currentGamepadIndex);
      }
      buttonState[gp.index] = new Array(gp.buttons.length).fill(null).map(() => ({
        holdStart: null,
        lastSimulated: 0
      }));
    });
  
    window.addEventListener('gamepaddisconnected', function (e) {
      const gp = e.gamepad;
      log("Gamepad disconnected: index=" + gp.index + ", id=" + gp.id);
      delete buttonState[gp.index];
      if (gp.index === currentGamepadIndex) {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        let newSelected = null;
        for (let i = 0; i < gamepads.length; i++) {
          const candidate = gamepads[i];
          if (candidate) {
            if (newSelected === null || candidate.index > newSelected) {
              newSelected = candidate.index;
            }
          }
        }
        currentGamepadIndex = newSelected;
        log("New selected gamepad index: " + currentGamepadIndex);
      }
    });
  
    // Poll gamepad state.
    function pollGamepads() {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      if (currentGamepadIndex !== null) {
        const gp = gamepads[currentGamepadIndex];
        if (gp && buttonState[gp.index]) {
          gp.buttons.forEach((button, index) => {
            const now = Date.now();
            const state = buttonState[gp.index][index];
            if (button.pressed) {
              // On first press, record holdStart and trigger the action immediately.
              if (state.holdStart === null) {
                state.holdStart = now;
                if (index === 3) {
                  // For button index 3 (Y/Triangle), focus the search box.
                  simulateSearchFocus();
                } else {
                  const key = buttonMapping[index];
                  if (key) {
                    simulateKeyEvent(key);
                  }
                }
                state.lastSimulated = now;
              } else {
                // For held buttons, repeat the event based on the delay.
                const heldTime = now - state.holdStart;
                const delay = getDelay(heldTime);
                if (now - state.lastSimulated >= delay) {
                  if (index === 3) {
                    simulateSearchFocus();
                  } else {
                    const key = buttonMapping[index];
                    if (key) {
                      simulateKeyEvent(key);
                    }
                  }
                  state.lastSimulated = now;
                }
              }
            } else {
              // Reset state when button is released.
              state.holdStart = null;
              state.lastSimulated = 0;
            }
          });
          gp.axes.forEach((axis, index) => {
            if (Math.abs(axis) > 0.1) {
              log("Gamepad[" + gp.index + "] Axis " + index + " value: " + axis);
            }
          });
        }
      }
      requestAnimationFrame(pollGamepads);
    }
  
    requestAnimationFrame(pollGamepads);
  })();
  