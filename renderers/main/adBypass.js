(function monitorYouTubeAds() {
    const { ipcRenderer } = require('electron');
  
    function log(message) {
      try {
        ipcRenderer.send('renderer-log', message);
      } catch (e) {
        console.error("IPC logging failed:", e);
      }
      console.log(message);
    }
  
    function isVisible(el) {
      return el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
    }
  
    function simulateClick(el) {
      try {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
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
          log("Dispatched " + evtName + " event on button.");
        });
      } catch (error) {
        log("simulateClick error: " + error);
      }
    }
  
    function getSkipButton() {
      try {
        const renderer = document.querySelector('ytlr-skip-ad-renderer[idomkey="skip_ad"]');
        if (!renderer) {
          log("Skip ad renderer not found.");
          return null;
        }
        const skipButton = renderer.querySelector('ytlr-skip-button-renderer[idomkey="skip_button"]');
        if (!skipButton) {
          log("Skip button not found inside renderer.");
          return null;
        }
        if (!isVisible(skipButton)) {
          log("Skip button found but not visible.");
          return null;
        }
        log("Skip button found and visible.");
        return skipButton;
      } catch (error) {
        log("getSkipButton error: " + error);
        return null;
      }
    }
  
    function getSurveySkipButton() {
      try {
        const surveySkipButton = document.querySelector('ytlr-skip-button-renderer[idomkey="survey-skip"]');
        if (!surveySkipButton) {
          return null;
        }
        if (!isVisible(surveySkipButton)) {
          log("Survey skip button found but not visible.");
          return null;
        }
        log("Survey skip button found and visible.");
        return surveySkipButton;
      } catch (error) {
        log("getSurveySkipButton error: " + error);
        return null;
      }
    }
  
    function hideSponsoredAdSlot() {
      try {
        const adSlots = document.querySelectorAll('ytlr-ad-slot-renderer[idomkey="ytlr-ad-slot-renderer"]');
        adSlots.forEach(slot => {
          if (slot.innerText && slot.innerText.includes('Sponsored')) {
            slot.style.visibility = 'hidden';
            slot.style.display = 'none';
            log("Hid a sponsored ad slot renderer.");
          }
        });
      } catch (error) {
        log("hideSponsoredAdSlot error: " + error);
      }
    }
  
    let videoElement = null;
    let skipClicked = false;
    let surveySkipClicked = false;
  
    function waitForVideo() {
      try {
        videoElement = document.querySelector('video');
        if (videoElement) {
          log("Video element found. Starting MutationObserver.");
          startObserver();
        } else {
          log("Waiting for video element...");
          setTimeout(waitForVideo, 1000);
        }
      } catch (error) {
        log("waitForVideo error: " + error);
        setTimeout(waitForVideo, 1000);
      }
    }
  
    function startObserver() {
      const observer = new MutationObserver(mutations => {
        try {
          const countdownEl = document.querySelector('.ytlr-skip-ad-timer-renderer__countdown');
          if (countdownEl) {
            log("Ad detected: Countdown present (" + countdownEl.innerText + ").");
            // Immediately mute the video to prevent any audio popping.
            if (videoElement && !videoElement.muted) {
              videoElement.muted = true;
              log("Video muted immediately upon ad detection.");
            }
            if (videoElement.playbackRate !== 8.0) {
              videoElement.playbackRate = 8.0;
              log("Playback rate set to 8x for ad.");
            } else {
              log("Playback rate already 8x during ad.");
            }
            if (!skipClicked) {
              const skipBtn = getSkipButton();
              if (skipBtn) {
                log("Attempting to click the skip button.");
                simulateClick(skipBtn);
                skipClicked = true;
              }
            }
          } else {
            // Restore normal playback and unmute once the ad is over.
            if (videoElement && videoElement.playbackRate !== 1.0) {
              videoElement.playbackRate = 1.0;
              log("No ad detected. Restoring playback rate to 1x.");
            }
            if (videoElement && videoElement.muted) {
              videoElement.muted = false;
              log("Video unmuted after ad.");
            }
            if (skipClicked || surveySkipClicked) {
              log("Ad ended. Resetting click flags.");
            }
            skipClicked = false;
            surveySkipClicked = false;
          }
          const surveySkipBtn = getSurveySkipButton();
          if (surveySkipBtn && !surveySkipClicked) {
            log("Survey ad detected. Attempting to click the survey skip button.");
            simulateClick(surveySkipBtn);
            surveySkipClicked = true;
          }
          hideSponsoredAdSlot();
        } catch (error) {
          log("MutationObserver error: " + error);
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
      log("MutationObserver started.");
    }
  
    waitForVideo();
  })();
  