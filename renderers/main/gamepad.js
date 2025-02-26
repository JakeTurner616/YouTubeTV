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

  // ---------------------------------------
  // Helper: Simulate Search Box Focus
  // ---------------------------------------
  function simulateSearchFocus() {
    const searchButton = document.querySelector(
      'ytlr-search-text-box.ytlr-search-bar__search-text-box > ytlr-text-box'
    );
    if (searchButton) {
      searchButton.focus();

      // Create a series of mouse events to simulate a full click sequence.
      const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
      const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });

      searchButton.dispatchEvent(mouseDownEvent);
      searchButton.dispatchEvent(mouseUpEvent);
      searchButton.dispatchEvent(clickEvent);

      log('Simulated full click sequence on the search box.');
      log('[Controller Event] Search box focus triggered.');
    } else {
      log('Search button element not found.');
    }
  }

  // ---------------------------------------
  // Helper: Simulate a Key Press and Hold
  // ---------------------------------------
  let keyHoldState = {};
  const REPEAT_DELAY = 300; // Initial delay before repeating (ms)
  const REPEAT_RATE = 100;  // Time between subsequent repeats (ms)

  function simulateKeyPress(key, isPressed) {
    const target = document.activeElement || document.body;
    
    if (isPressed) {
      const currentTime = Date.now();
      if (
        !keyHoldState[key] ||
        (currentTime - keyHoldState[key].startTime >= REPEAT_DELAY &&
         currentTime - keyHoldState[key].lastRepeat >= REPEAT_RATE)
      ) {
        log("[Controller Event] Simulating keydown for: " + key);
        const keydownEvent = new KeyboardEvent("keydown", {
          key: key,
          code: key,
          keyCode:
            key === "Enter" ? 13 : key === "Escape" ? 27 :
            key === "ArrowUp" ? 38 : key === "ArrowDown" ? 40 :
            key === "ArrowLeft" ? 37 : key === "ArrowRight" ? 39 :
            key === "Backspace" ? 8 : 0,
          bubbles: true,
          cancelable: true,
          composed: true,
          repeat: keyHoldState[key] ? true : false
        });
        target.dispatchEvent(keydownEvent);
        
        if (!keyHoldState[key]) {
          keyHoldState[key] = {
            startTime: currentTime,
            lastRepeat: currentTime
          };
        } else {
          keyHoldState[key].lastRepeat = currentTime;
        }
      }
    } else if (keyHoldState[key]) {
      log("[Controller Event] Simulating keyup for: " + key);
      const keyupEvent = new KeyboardEvent("keyup", {
        key: key,
        code: key,
        keyCode:
          key === "Enter" ? 13 : key === "Escape" ? 27 :
          key === "ArrowUp" ? 38 : key === "ArrowDown" ? 40 :
          key === "ArrowLeft" ? 37 : key === "ArrowRight" ? 39 :
          key === "Backspace" ? 8 : 0,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      target.dispatchEvent(keyupEvent);
      delete keyHoldState[key];
    }
  }

  // ---------------------------------------
  // Gamepad Input Handling and Key Simulation
  // ---------------------------------------
  // Mapping from gamepad button indices to keyboard keys.
  const buttonMapping = {
    0: "Enter",      // A button
    1: "Escape",     // B button
    2: "Backspace",  // X button (Xbox) / Square button (PlayStation)
    12: "ArrowUp",   // D-pad Up
    13: "ArrowDown", // D-pad Down
    14: "ArrowLeft", // D-pad Left
    15: "ArrowRight" // D-pad Right
  };

  // Joystick axis mapping
  const axisMapping = {
    0: { negative: "ArrowLeft", positive: "ArrowRight" }, // Left stick X-axis
    1: { negative: "ArrowUp", positive: "ArrowDown" }     // Left stick Y-axis
  };

  // Object to track the previous pressed state of each button per gamepad.
  const buttonState = {};
  // Object to track the previous axis values per gamepad.
  const axisState = {};
  
  // Joystick configuration.
  const DEADZONE = 0.5;            
  const AXIS_ACTIVATION_DELAY = 200; 
  let lastAxisActivation = {};
  // Track active joystick directions.
  let activeAxisDirections = {};

  // -------------------------------
  // Track only the latest controller.
  // -------------------------------
  let currentGamepadIndex = null;
  let isPolling = false;
  let isConnected = false;

  // Clear any existing event listeners to prevent duplication.
  const oldListeners = window._gamepadListeners || [];
  oldListeners.forEach(listener => {
    window.removeEventListener('gamepadconnected', listener.connect);
    window.removeEventListener('gamepaddisconnected', listener.disconnect);
  });

  // Updated connect listener: always set the current gamepad to the newly connected one.
  const connectListener = function(e) {
    const gp = e.gamepad;
    log("Gamepad connected: index=" + gp.index + ", id=" + gp.id +
        ", buttons=" + gp.buttons.length + ", axes=" + gp.axes.length);
    
    // Always update to the latest connected gamepad.
    currentGamepadIndex = gp.index;
    log("Selected (latest) gamepad index updated to: " + currentGamepadIndex);
    
    // Initialize state tracking.
    buttonState[gp.index] = new Array(gp.buttons.length).fill(false);
    axisState[gp.index] = new Array(gp.axes.length).fill(0);
    lastAxisActivation[gp.index] = {};
    activeAxisDirections[gp.index] = {};
    
    for (const axisIndex in axisMapping) {
      lastAxisActivation[gp.index][axisIndex] = 0;
      activeAxisDirections[gp.index][axisIndex] = 0;
    }
    
    isConnected = true;
    if (!isPolling) {
      isPolling = true;
      requestAnimationFrame(pollGamepads);
    }
  };

  const disconnectListener = function(e) {
    const gp = e.gamepad;
    log("Gamepad disconnected: index=" + gp.index + ", id=" + gp.id);
    
    // Clean up state for this gamepad.
    delete buttonState[gp.index];
    delete axisState[gp.index];
    delete lastAxisActivation[gp.index];
    delete activeAxisDirections[gp.index];
    
    if (gp.index === currentGamepadIndex) {
      // Find a new gamepad to use if available.
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
      if (newSelected !== null) {
        log("New selected (latest) gamepad index: " + currentGamepadIndex);
      } else {
        log("No gamepads remaining connected");
        isConnected = false;
      }
    }
  };

  // Store new listeners for potential future cleanup.
  window._gamepadListeners = window._gamepadListeners || [];
  window._gamepadListeners.push({
    connect: connectListener,
    disconnect: disconnectListener
  });

  // Add event listeners.
  window.addEventListener('gamepadconnected', connectListener);
  window.addEventListener('gamepaddisconnected', disconnectListener);

  // Check for already connected gamepads.
  const initialGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < initialGamepads.length; i++) {
    const gp = initialGamepads[i];
    if (gp) {
      log("Already connected gamepad: index=" + gp.index + ", id=" + gp.id);
      
      // Initialize state tracking.
      buttonState[gp.index] = new Array(gp.buttons.length).fill(false);
      axisState[gp.index] = new Array(gp.axes.length).fill(0);
      lastAxisActivation[gp.index] = {};
      activeAxisDirections[gp.index] = {};
      
      for (const axisIndex in axisMapping) {
        lastAxisActivation[gp.index][axisIndex] = 0;
        activeAxisDirections[gp.index][axisIndex] = 0;
      }
      
      // Use the most recently found gamepad.
      currentGamepadIndex = gp.index;
      isConnected = true;
    }
  }

  // Rate limiting for logging.
  let lastLogTime = 0;
  const LOG_INTERVAL = 5000; // Log connected controllers every 5 seconds.

  // Process joystick input with deadzone.
  function processJoystick(gpIndex, axisIndex, value) {
    const prevValue = axisState[gpIndex][axisIndex];
    const axis = axisMapping[axisIndex];
    
    if (!axis) return; // Skip unmapped axes.
    
    // Apply deadzone.
    if (Math.abs(value) < DEADZONE) {
      value = 0;
    }
    
    // Determine direction (-1, 0, 1).
    const currentDirection = value === 0 ? 0 : (value < 0 ? -1 : 1);
    const prevDirection = activeAxisDirections[gpIndex][axisIndex];
    
    if (currentDirection !== prevDirection) {
      // Release previous key.
      if (prevDirection < 0 && axis.negative) {
        simulateKeyPress(axis.negative, false);
      } else if (prevDirection > 0 && axis.positive) {
        simulateKeyPress(axis.positive, false);
      }
      
      // Press new key.
      if (currentDirection < 0 && axis.negative) {
        simulateKeyPress(axis.negative, true);
      } else if (currentDirection > 0 && axis.positive) {
        simulateKeyPress(axis.positive, true);
      }
      
      activeAxisDirections[gpIndex][axisIndex] = currentDirection;
    } else if (currentDirection !== 0) {
      // Continue holding the key.
      const key = currentDirection < 0 ? axis.negative : axis.positive;
      if (key) {
        simulateKeyPress(key, true);
      }
    }
    
    axisState[gpIndex][axisIndex] = value;
  }

  // Poll gamepad state.
  function pollGamepads() {
    if (!isPolling) return;
    
    const currentTime = Date.now();
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    
    // Log connected controllers periodically.
    if (currentTime - lastLogTime > LOG_INTERVAL) {
      const connectedCount = Array.from(gamepads).filter(g => g !== null).length;
      if (connectedCount > 0) {
        log("Connected controllers: " + connectedCount);
      }
      lastLogTime = currentTime;
    }

    if (currentGamepadIndex !== null) {
      const gp = gamepads[currentGamepadIndex];
      if (gp && buttonState[gp.index]) {
        // Process buttons.
        for (let index = 0; index < gp.buttons.length; index++) {
          const button = gp.buttons[index];
          const wasPressed = buttonState[gp.index][index];
          
          // Special handling for button 3 (search focus).
          if (index === 3) {
            if (button.pressed && !wasPressed) {
              simulateSearchFocus();
            }
          } else if (buttonMapping.hasOwnProperty(index)) {
            const key = buttonMapping[index];
            if (key) {
              if (button.pressed !== wasPressed || button.pressed) {
                simulateKeyPress(key, button.pressed);
              }
            }
          }
          
          // Update button state.
          buttonState[gp.index][index] = button.pressed;
        }
        
        // Process joystick axes.
        for (let index = 0; index < gp.axes.length; index++) {
          if (axisMapping.hasOwnProperty(index)) {
            processJoystick(gp.index, index, gp.axes[index]);
          }
        }
      }
    }
    
    if (isConnected) {
      requestAnimationFrame(pollGamepads);
    } else {
      isPolling = false;
    }
  }

  // Start polling if gamepads are connected.
  if (isConnected && !isPolling) {
    isPolling = true;
    requestAnimationFrame(pollGamepads);
  }
  
  // Cleanup function.
  window._cleanupGamepadHandler = function() {
    isPolling = false;
    isConnected = false;
    
    // Release any held keys.
    for (const key in keyHoldState) {
      const target = document.activeElement || document.body;
      const keyupEvent = new KeyboardEvent("keyup", {
        key: key,
        code: key,
        keyCode:
          key === "Enter" ? 13 : key === "Escape" ? 27 :
          key === "ArrowUp" ? 38 : key === "ArrowDown" ? 40 :
          key === "ArrowLeft" ? 37 : key === "ArrowRight" ? 39 :
          key === "Backspace" ? 8 : 0,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      target.dispatchEvent(keyupEvent);
    }
    keyHoldState = {};
    
    window._gamepadListeners.forEach(listener => {
      window.removeEventListener('gamepadconnected', listener.connect);
      window.removeEventListener('gamepaddisconnected', listener.disconnect);
    });
    window._gamepadListeners = [];
    log("Gamepad handler cleaned up");
  };
  
  log("Gamepad handler initialized");
})();
