(function monitorYouTubeAds() {
  const { ipcRenderer } = require('electron');
  
  // Improved logging with timestamps
  function log(message) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}`;
    try {
      ipcRenderer.send('renderer-log', formattedMessage);
    } catch (e) {
      console.error("IPC logging failed:", e);
    }
    console.log(formattedMessage);
  }
  
  // More reliable visibility check with additional validation
  function isVisible(el) {
    if (!el) return false;
    
    const style = window.getComputedStyle(el);
    return el.offsetParent !== null && 
           style.visibility !== 'hidden' && 
           style.display !== 'none' &&
           style.opacity !== '0' &&
           el.getBoundingClientRect().height > 0 &&
           el.getBoundingClientRect().width > 0;
  }
  
  // Enhanced click simulation with better error handling and validation
  function simulateClick(el, elementName = "button") {
    if (!el) {
      log(`Cannot click null ${elementName}`);
      return false;
    }
    
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        log(`${elementName} has zero dimensions, cannot click`);
        return false;
      }
      
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Check if coordinates are valid
      if (isNaN(centerX) || isNaN(centerY)) {
        log(`Invalid coordinates for ${elementName}: (${centerX}, ${centerY})`);
        return false;
      }
      
      log(`Attempting to click ${elementName} at coordinates (${centerX}, ${centerY})`);
      
      const events = ['mousedown', 'mouseup', 'click'];
      events.forEach(evtName => {
        const evt = new MouseEvent(evtName, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: centerX,
          clientY: centerY
        });
        el.dispatchEvent(evt);
        log(`Dispatched ${evtName} event on ${elementName}`);
      });
      
      return true;
    } catch (error) {
      log(`simulateClick error on ${elementName}: ${error}`);
      return false;
    }
  }
  
  // Multiple selector strategies for finding skip button
  function getSkipButton() {
    const selectors = [
      // Primary selectors (from original code)
      {
        renderer: 'ytlr-skip-ad-renderer[idomkey="skip_ad"]',
        button: 'ytlr-skip-button-renderer[idomkey="skip_button"]'
      },
      // Backup selectors (more general)
      {
        renderer: '.ytp-ad-skip-button-slot',
        button: '.ytp-ad-skip-button'
      },
      // Additional selector combinations
      {
        renderer: 'div[id="skip-button:"]',
        button: 'button'
      },
      {
        renderer: 'div[class*="skip"]',
        button: 'button'
      },
      // Direct button selectors (no renderer needed)
      {
        button: 'button[class*="skip"][class*="ad"]'
      },
      {
        button: 'button[aria-label*="Skip"]'
      },
      {
        button: '[data-testid="ad-skip-button"]'
      }
    ];
    
    try {
      // Try each selector strategy
      for (const selector of selectors) {
        let skipButton = null;
        
        // If renderer selector is provided, look for button inside renderer
        if (selector.renderer) {
          const renderer = document.querySelector(selector.renderer);
          if (renderer) {
            log(`Found ad renderer using selector: ${selector.renderer}`);
            skipButton = renderer.querySelector(selector.button);
          }
        } 
        // Otherwise look for button directly
        else if (selector.button) {
          skipButton = document.querySelector(selector.button);
        }
        
        // If button is found and visible, return it
        if (skipButton && isVisible(skipButton)) {
          log(`Skip button found and visible using selector: ${selector.button}`);
          return skipButton;
        } else if (skipButton) {
          log(`Skip button found but not visible using selector: ${selector.button}`);
        }
      }
      
      // Text-based button detection as fallback
      const allButtons = document.querySelectorAll('button');
      for (const button of allButtons) {
        const buttonText = button.innerText || button.textContent || '';
        if (buttonText.match(/skip|skip ad/i) && isVisible(button)) {
          log(`Skip button found using text content match: "${buttonText}"`);
          return button;
        }
      }
      
      return null;
    } catch (error) {
      log(`getSkipButton error: ${error}`);
      return null;
    }
  }
  
  // Expanded survey skip button detection
  function getSurveySkipButton() {
    // Primary strategy: Look for the renderer element by its unique idomkey.
    const renderer = document.querySelector('ytlr-skip-button-renderer[idomkey="survey-skip"]');
    if (renderer) {
      // Try to retrieve the nested clickable button within the renderer.
      const nestedButton = renderer.querySelector('ytlr-button');
      if (nestedButton && isVisible(nestedButton)) {
        log("Survey skip button found inside renderer using 'ytlr-skip-button-renderer[idomkey=\"survey-skip\"]' and nested ytlr-button.");
        return nestedButton;
      } else if (isVisible(renderer)) {
        // If the nested button isn't found but the renderer itself is visible, use it as a fallback.
        log("Survey skip renderer is visible and used as a fallback clickable element.");
        return renderer;
      }
    }
    
    // Secondary strategy: Directly look for any element with an aria-label exactly matching "Skip survey".
    const ariaLabelButton = document.querySelector('[aria-label="Skip survey"]');
    if (ariaLabelButton && isVisible(ariaLabelButton)) {
      log("Survey skip button found using [aria-label='Skip survey'] selector.");
      return ariaLabelButton;
    }
    
    // Tertiary strategy: Search for a formatted string element that contains the exact text "Skip survey".
    const formattedStrings = document.querySelectorAll('yt-formatted-string');
    for (const fs of formattedStrings) {
      const text = (fs.innerText || fs.textContent || "").trim();
      if (text === "Skip survey" && isVisible(fs)) {
        // Find the nearest ancestor that is a ytlr-button (or a clickable container)
        const parentButton = fs.closest('ytlr-button, button');
        if (parentButton && isVisible(parentButton)) {
          log("Survey skip button found via text match within ytlr-button.");
          return parentButton;
        }
      }
    }
    
    // Final fallback: Iterate through all buttons and ytlr-buttons using a text-based match.
    const allButtons = document.querySelectorAll('button, ytlr-button');
    for (const button of allButtons) {
      const buttonText = (button.innerText || button.textContent || "").toLowerCase();
      if (buttonText.match(/skip survey/) && isVisible(button)) {
        log(`Survey skip button found using text-based match: "${buttonText}"`);
        return button;
      }
    }
    
    log("Survey skip button not found.");
    return null;
  }
  
  
  // Safely hide ad elements WITHOUT hiding detection elements
  function hideAdElements() {
    try {
      // Safe list of ad elements that we can hide without affecting detection
      const safeSelectors = [
        'ytd-in-feed-ad-layout-renderer',
        'ytd-display-ad-renderer',
        'ytd-companion-slot-renderer',
        '.ytd-rich-item-renderer[is-ad]',
        '.ytd-video-masthead-ad-v3-renderer',
        '.ytd-banner-promo-renderer'
      ];
      
      let hiddenCount = 0;
      
      safeSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          // Do not hide if it contains any countdowns or skip buttons
          // to ensure our detection still works
          if (!element.querySelector('.ytLrSkipAdTimerRendererCountdown') && 
              !element.querySelector('.ytp-ad-text') && 
              !element.querySelector('.ytp-ad-skip-button')) {
            
            if (element.style.display !== 'none') {
              element.style.visibility = 'hidden';
              element.style.display = 'none';
              hiddenCount++;
            }
          }
        });
      });
      
      if (hiddenCount > 0) {
        log(`Safely hid ${hiddenCount} non-essential ad elements`);
      }
    } catch (error) {
      log(`hideAdElements error: ${error}`);
    }
  }
  
  // Improved ad detection without manipulating critical DOM elements
  function isAdPlaying() {
    try {
      // Method 1: Check for countdown elements
      const countdownSelectors = [
        '.ytLrSkipAdTimerRendererCountdown', 
        '.ytp-ad-text',
        '[class*="ad-text"]',
        '[class*="countdown"]'
      ];
      
      for (const selector of countdownSelectors) {
        const countdownEl = document.querySelector(selector);
        if (countdownEl && isVisible(countdownEl)) {
          log(`Ad detected: Countdown present (${countdownEl.innerText || 'no text'}).`);
          return true;
        }
      }
      
      // Method 2: Check for ad info button
      const infoButtonSelectors = [
        '.ytp-ad-info-dialog-ad-reasons',
        'button[class*="ad-info"]',
        'button[aria-label*="Why this ad"]',
        'button[title*="Why this ad"]'
      ];
      
      for (const selector of infoButtonSelectors) {
        const adInfoButton = document.querySelector(selector);
        if (adInfoButton && isVisible(adInfoButton)) {
          log(`Ad detected: Ad info button is visible (${selector})`);
          return true;
        }
      }
      
      // Method 3: Check for ad-specific elements
      const adElementSelectors = [
        '.ytp-ad-module',
        '.ytp-ad-player-overlay',
        '.ytp-ad-overlay-container',
        'div[id="ad-overlay"]',
        'div[id="player-ads"]'
      ];
      
      for (const selector of adElementSelectors) {
        const adElement = document.querySelector(selector);
        if (adElement && isVisible(adElement)) {
          log(`Ad detected: Ad element is visible (${selector})`);
          return true;
        }
      }
      
      // Method 4: Check for "Ad" or "Advertisement" text in visible elements
      const adLabelSelectors = [
        '.ytp-ad-preview-text',
        '.ytp-ad-duration-remaining',
        'span[class*="ad-label"]',
        'span[class*="ad-badge"]',
        'div[class*="ad-badge"]'
      ];
      
      for (const selector of adLabelSelectors) {
        const labels = document.querySelectorAll(selector);
        for (const label of labels) {
          if (isVisible(label)) {
            log(`Ad detected: Ad label element is visible (${selector})`);
            return true;
          }
        }
      }
      
      // Method 5: Look specifically for ad text in general containers
      const adTextIndicators = ["ad", "advertisement", "ad will end", "skip ad in", "skip ad", "video will play after ad"];
      const textContainers = document.querySelectorAll('span, div, p');
      
      for (const container of textContainers) {
        if (isVisible(container)) {
          const text = (container.innerText || container.textContent || '').toLowerCase();
          for (const indicator of adTextIndicators) {
            if (text.includes(indicator)) {
              const wordsInText = text.split(/\s+/);
              if (wordsInText.includes("ad") || wordsInText.includes("advertisement") || 
                  text.includes("ad will") || text.includes("skip ad")) {
                log(`Ad detected: Found text "${text}" in ${container.tagName}`);
                return true;
              }
            }
          }
        }
      }
      
      // Method 6: Check if the standard skip button exists
      const skipButton = getSkipButton();
      if (skipButton) {
        log('Ad detected: Skip button is present');
        return true;
      }
      
      // **New Method 7: Check for survey ad elements**
      // This specifically looks for survey ad containers that indicate a survey is active.
      const surveyAdSelectors = [
        'ytlr-instream-survey-ad', 
        'ytlr-instream-survey-ad-background-image-renderer'
      ];
      for (const selector of surveyAdSelectors) {
        const surveyAdEl = document.querySelector(selector);
        if (surveyAdEl && isVisible(surveyAdEl)) {
          log(`Survey ad detected: Element "${selector}" is visible.`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      log(`isAdPlaying error: ${error}`);
      return false;
    }
  }
  
  
  let videoElement = null;
  let skipClicked = false;
  let surveySkipClicked = false;
  let adDetectionInterval = null;
  let lastAdState = false;
  let consecutiveFailures = 0;
  let isVideoMuted = false; // Track if we muted the video
  let originalPlaybackRate = 1.0; // Track original playback rate
  const MAX_FAILURES = 5;
  
  // Improved video element finder
  function findVideoElement() {
    try {
      // Try multiple selectors for video
      const selectors = [
        'video',
        '.html5-main-video',
        '#movie_player video',
        '.video-stream'
      ];
      
      for (const selector of selectors) {
        const video = document.querySelector(selector);
        if (video && typeof video.play === 'function') {
          return video;
        }
      }
      
      return null;
    } catch (error) {
      log(`findVideoElement error: ${error}`);
      return null;
    }
  }
  
  function waitForVideo() {
    try {
      videoElement = findVideoElement();
      if (videoElement) {
        log("Video element found. Starting ad detection.");
        startAdDetection();
      } else {
        log("Waiting for video element...");
        setTimeout(waitForVideo, 1000);
      }
    } catch (error) {
      log(`waitForVideo error: ${error}`);
      consecutiveFailures++;
      
      if (consecutiveFailures > MAX_FAILURES) {
        log(`Too many consecutive failures (${consecutiveFailures}). Resetting...`);
        consecutiveFailures = 0;
      }
      
      setTimeout(waitForVideo, 1000);
    }
  }
  
  function handleAdState(isAdActive) {
    try {
      // If the ad state changed, log it
      if (isAdActive !== lastAdState) {
        log(`Ad state changed: ${isAdActive ? 'AD PLAYING' : 'NO AD PLAYING'}`);
        lastAdState = isAdActive;
        
        // Reset flags when switching away from an ad
        if (!isAdActive) {
          skipClicked = false;
          surveySkipClicked = false;
        }
      }
      
      if (isAdActive) {
        // Handle when an ad is playing
        
        // 1. Save current playback state if not already saved
        if (!isVideoMuted && videoElement && !videoElement.muted) {
          isVideoMuted = true;
          log("Remembering that video was unmuted before ad");
        }
        
        if (videoElement && videoElement.playbackRate !== 8.0) {
          if (originalPlaybackRate === 1.0) { // Only save if we haven't already
            originalPlaybackRate = videoElement.playbackRate || 1.0;
            log(`Saved original playback rate: ${originalPlaybackRate}x`);
          }
          
          // Try to speed up the video
          try {
            videoElement.playbackRate = 8.0;
            log("Playback rate set to 8x for ad.");
          } catch (e) {
            log(`Failed to set playback rate: ${e}`);
            try {
              // Try a more modest speed
              videoElement.playbackRate = 2.0;
              log("Playback rate set to 2x for ad (8x failed).");
            } catch (e2) {
              log(`Failed to set any increased playback rate: ${e2}`);
            }
          }
          
          // Ensure video is muted during ad
          if (videoElement && !videoElement.muted) {
            videoElement.muted = true;
            log("Video muted during ad.");
          }
        }
        
        // 2. Try to skip the ad if we haven't already
        if (!skipClicked) {
          const skipBtn = getSkipButton();
          if (skipBtn) {
            log("Attempting to click the skip button.");
            const success = simulateClick(skipBtn, "skip button");
            skipClicked = success;
            
            // If click failed, retry in 500ms
            if (!success) {
              setTimeout(() => {
                if (!skipClicked) {
                  const retryBtn = getSkipButton();
                  if (retryBtn) {
                    log("Retrying skip button click.");
                    skipClicked = simulateClick(retryBtn, "skip button (retry)");
                  }
                }
              }, 500);
            }
          }
        }
        
        // 3. Handle survey skip buttons
        if (!surveySkipClicked) {
          const surveySkipBtn = getSurveySkipButton();
          if (surveySkipBtn) {
            log("Attempting to click the survey skip button.");
            const success = simulateClick(surveySkipBtn, "survey skip button");
            surveySkipClicked = success;
            
            // If click failed, retry in 500ms
            if (!success) {
              setTimeout(() => {
                if (!surveySkipClicked) {
                  const retryBtn = getSurveySkipButton();
                  if (retryBtn) {
                    log("Retrying survey skip button click.");
                    surveySkipClicked = simulateClick(retryBtn, "survey skip button (retry)");
                  }
                }
              }, 500);
            }
          }
        }
      } else {
        // Handle when no ad is playing
        
        // Restore normal playback state
        if (videoElement) {
          // Restore original playback rate if we changed it
          if (videoElement.playbackRate !== originalPlaybackRate) {
            videoElement.playbackRate = originalPlaybackRate;
            log(`Restored original playback rate: ${originalPlaybackRate}x`);
          }
          
          // Unmute if we muted it and it wasn't muted before
          if (videoElement.muted && isVideoMuted === false) {
            videoElement.muted = false;
            log("Video unmuted after ad.");
          }
          
          // Reset tracking variables
          isVideoMuted = false;
          originalPlaybackRate = 1.0;
        }
      }
      
      // Always try to hide non-essential ad elements
      // but be careful not to hide elements we need for detection
      hideAdElements();
      
      // Reset consecutive failures counter on successful execution
      consecutiveFailures = 0;
    } catch (error) {
      log(`handleAdState error: ${error}`);
      consecutiveFailures++;
      
      if (consecutiveFailures > MAX_FAILURES) {
        log(`Too many consecutive failures (${consecutiveFailures}). Resetting ad detection...`);
        stopAdDetection();
        startAdDetection();
        consecutiveFailures = 0;
      }
    }
  }
  
  function startAdDetection() {
    log("Starting ad detection systems");
    
    // Create a dedicated observer just for ad detection elements
    // that should never be modified or hidden
    const criticalAdElementsSelector = [
      '.ytLrSkipAdTimerRendererCountdown',
      '.ytp-ad-text',
      '.ytp-ad-preview-text',
      '.ytp-ad-skip-button',
      '[class*="ad-text"]',
      '[class*="countdown"]'
    ].join(', ');
    
    // Initialize DOM observer with more targeted approach
    const observer = new MutationObserver(mutations => {
      try {
        let shouldCheck = false;
        
        // Check if any mutations are relevant to ad detection
        for (const mutation of mutations) {
          // Check if the mutation affects nodes that might be related to ads
          if (mutation.type === 'childList' || mutation.type === 'attributes') {
            // If the target or any added nodes match our critical elements
            // or contain text related to ads, we should check for ads
            const isAdRelated = 
              (mutation.target.matches && mutation.target.matches(criticalAdElementsSelector)) ||
              (mutation.target.querySelector && mutation.target.querySelector(criticalAdElementsSelector)) ||
              Array.from(mutation.addedNodes).some(node => 
                node.nodeType === 1 && // Element node
                ((node.matches && node.matches(criticalAdElementsSelector)) ||
                 (node.querySelector && node.querySelector(criticalAdElementsSelector)))
              );
              
            if (isAdRelated) {
              shouldCheck = true;
              break;
            }
            
            // Also check if text content contains ad-related keywords
            if (mutation.target.textContent && 
               (mutation.target.textContent.includes('ad') || 
                mutation.target.textContent.includes('Ad') || 
                mutation.target.textContent.includes('advertisement'))) {
              shouldCheck = true;
              break;
            }
          }
        }
        
        // Only perform the expensive isAdPlaying check if we have relevant mutations
        if (shouldCheck) {
          const isAdActive = isAdPlaying();
          handleAdState(isAdActive);
        }
      } catch (error) {
        log(`MutationObserver handler error: ${error}`);
      }
    });
    
    // Observe the entire document for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
    
    // Also set up an interval for periodic checks (backup)
    // This runs less frequently to minimize performance impact
    adDetectionInterval = setInterval(() => {
      try {
        // Refresh video element reference in case it changed
        const currentVideo = findVideoElement();
        if (currentVideo && currentVideo !== videoElement) {
          log("Video element changed, updating reference");
          videoElement = currentVideo;
        }
        
        const isAdActive = isAdPlaying();
        handleAdState(isAdActive);
      } catch (error) {
        log(`Interval check error: ${error}`);
        consecutiveFailures++;
        
        if (consecutiveFailures > MAX_FAILURES) {
          log(`Too many consecutive failures (${consecutiveFailures}). Resetting ad detection...`);
          stopAdDetection();
          startAdDetection();
          consecutiveFailures = 0;
        }
      }
    }, 2000); // Check every 2 seconds as a fallback
    
    // Add URL change detection for SPAs
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        log(`URL changed from ${lastUrl} to ${location.href}`);
        lastUrl = location.href;
        
        // Reset state
        skipClicked = false;
        surveySkipClicked = false;
        lastAdState = false;
        isVideoMuted = false;
        originalPlaybackRate = 1.0;
        
        // Refresh video element
        videoElement = findVideoElement();
        if (!videoElement) {
          log("Video element lost after URL change. Waiting for new video...");
          stopAdDetection();
          waitForVideo();
        }
      }
    });
    
    urlObserver.observe(document, { subtree: true, childList: true });
    
    // Initial check
    const isAdActive = isAdPlaying();
    handleAdState(isAdActive);
    
    log("All ad detection systems started successfully");
  }
  
  function stopAdDetection() {
    if (adDetectionInterval) {
      clearInterval(adDetectionInterval);
      adDetectionInterval = null;
      log("Stopped ad detection interval");
    }
  }
  
  // Start everything
  log("YouTube ad handler initialized");
  waitForVideo();
})();