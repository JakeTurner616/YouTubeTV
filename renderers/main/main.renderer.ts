import { readFile } from 'fs/promises';
import { platform } from 'os';
import { cwd } from 'process';
import { join } from 'path';
import { Settings } from '../settings/settings.renderer';
import electronLocalshortcut from 'electron-localshortcut';

import {
    app,
    BrowserWindow,
    nativeImage,
    Menu,
    ipcMain
} from 'electron';

export interface resolution {

    /** Screen width */
    width: number
    /** Screen height */
    height: number

}

interface windowParams {

    bounds: Electron.Rectangle
    fullscreen: boolean
    cursor: boolean

}

export class Renderer {

    /** userAgent allowed by YouTube TV. */
    private readonly userAgent: string = 'Mozilla/5.0 (X11; Linux i686) AppleWebKit/534.24 (KHTML, like Gecko) Chrome/11.0.696.77 Large Screen Safari/534.24 GoogleTV/092754';

    /** Electron process */
    private window: BrowserWindow;

    /** Settings window */
    private settings: Settings | null;

    /** Cursor visibility flag. */
    private _cursor: boolean = false;

    /** YouTube TV url with path/params */
    private readonly _url: string = 'https://www.youtube.com/tv?';

    /** JavaScript injection code */
    private jsic: string = '';

    /** JavaScript injection title bar styles */
    private titleBar: string = '';

    constructor() {

        // Set app menu to null.
        Menu.setApplicationMenu(null);

        app.on('ready', () => {

            this.createWindow();

            this.listenWindowMoveEvents();

            this.url = '__DFT__';

            this.window.webContents.on('dom-ready', () => this.injectJSCode.bind(this));

            this.setAccelerators();

            if (platform() === 'darwin') {
                this.window.on('enter-full-screen', () => this.fullScreen = true)
                this.window.on('leave-full-screen', () => this.fullScreen = false)
            }

            this.window.on('close', () => {
                if (this.settings) {
                    this.settings.destroy();
                    this.settings = null;
                }
            })
        })
            .on('window-all-closed', () => { app.quit() })
    }

    /** Create a new renderer window. */
    private createWindow() {

        this.window = new BrowserWindow({
            width: 1230,
            height: 720,
            titleBarStyle: platform() === 'darwin' ? 'hiddenInset' : 'default',
            fullscreen: false,
            fullscreenable: true,
            title: 'YouTube TV',
            backgroundColor: '#282828',
            icon: nativeImage.createFromPath(join(cwd(), 'build', 'icon.png')),
            webPreferences: {
                nodeIntegration: true,
                webSecurity: true,
                contextIsolation: false
            }
        });

        process.nextTick(() => this.loadSettings());

    }

    /**
     * Inject a JavaScript code into the renderer process to patch events and add some features.
     * @param script Type of script to be injected.
     * */
    private async injectJSCode(script: 'all' | 'patchs' | 'titlebar' = 'all') {
        try {
            if (this.jsic === '') {
                this.jsic = await readFile(join(__dirname, 'injection.js'), { encoding: 'utf8' });
            }

            if (platform() === 'darwin' && this.titleBar === '') {
                this.titleBar = await readFile(join(__dirname, 'titleBar.js'), { encoding: 'utf8' });
            }

            const adBypassScript = `
(function monitorYouTubeAds() {
    const { ipcRenderer } = require('electron');

    // Log messages to both the Electron console and the browser console.
    function log(message) {
        try {
            ipcRenderer.send('renderer-log', message);
        } catch (e) {
            console.error("IPC logging failed:", e);
        }
        console.log(message);
    }

    // Checks if an element is visible.
    function isVisible(el) {
        return el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
    }

    // Simulate a full user click by dispatching mousedown, mouseup, and click events.
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

    // Returns the skip ad button using a reliable selector.
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

    // Returns the survey skip button if present.
    function getSurveySkipButton() {
        try {
            const surveySkipButton = document.querySelector('ytlr-skip-button-renderer[idomkey="survey-skip"]');
            if (!surveySkipButton) {
                log("Survey skip button not found.");
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

    // Hide only the offending sponsored element inside a virtual list row.
    // We look for the ad slot renderer that is marked as an ad (via its content).
    function hideSponsoredAdSlot() {
        try {
            // Query for ad slot renderers (adjust the selector if needed).
            const adSlots = document.querySelectorAll('ytlr-ad-slot-renderer[idomkey="ytlr-ad-slot-renderer"]');
            adSlots.forEach(slot => {
                // Check if this ad slot contains the "Sponsored" label.
                if (slot.innerText && slot.innerText.includes('Sponsored')) {
                    // Hide the offending element without removing the entire row.
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
    // Flags to ensure we click only once per ad cycle.
    let skipClicked = false;
    let surveySkipClicked = false;

    // Wait for the <video> element to appear.
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

    // Start a MutationObserver that monitors the document for ad changes and sponsored ad elements.
    function startObserver() {
        const observer = new MutationObserver(mutations => {
            try {
                // Look for the countdown element that indicates a skippable ad.
                const countdownEl = document.querySelector('.ytlr-skip-ad-timer-renderer__countdown');
                if (countdownEl) {
                    log("Ad detected: Countdown present (" + countdownEl.innerText + ").");
                    // Force the video playback rate to 8x during the ad.
                    if (videoElement.playbackRate !== 8.0) {
                        videoElement.playbackRate = 8.0;
                        log("Playback rate set to 8x for ad.");
                    } else {
                        log("Playback rate already 8x during ad.");
                    }
                    // Attempt to click the regular skip button if it hasn't been clicked yet.
                    if (!skipClicked) {
                        const skipBtn = getSkipButton();
                        if (skipBtn) {
                            log("Attempting to click the skip button.");
                            simulateClick(skipBtn);
                            skipClicked = true;
                        }
                    }
                } else {
                    // If no ad countdown is found, assume the ad has ended.
                    if (videoElement && videoElement.playbackRate !== 1.0) {
                        videoElement.playbackRate = 1.0;
                        log("No ad detected. Restoring playback rate to 1x.");
                    }
                    if (skipClicked || surveySkipClicked) {
                        log("Ad ended. Resetting click flags.");
                    }
                    skipClicked = false;
                    surveySkipClicked = false;
                }

                // Check for the survey ad skip element.
                const surveySkipBtn = getSurveySkipButton();
                if (surveySkipBtn && !surveySkipClicked) {
                    log("Survey ad detected. Attempting to click the survey skip button.");
                    simulateClick(surveySkipBtn);
                    surveySkipClicked = true;
                }

                // Hide only the specific ad slot that is sponsored.
                hideSponsoredAdSlot();
            } catch (error) {
                log("MutationObserver error: " + error);
            }
        });

        // Observe changes in the document's child list, subtree, attributes, and character data.
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
`;

            
            
            


            if (script === 'all') {
                this.window.webContents.executeJavaScript(this.jsic);
                this.window.webContents.executeJavaScript(adBypassScript); // Inject the ad speed-up script
                if (platform() === 'darwin') this.window.webContents.executeJavaScript(this.titleBar);
            } else if (script === 'patchs') {
                this.window.webContents.executeJavaScript(this.jsic);
                this.window.webContents.executeJavaScript(adBypassScript);
            } else if (script === 'titlebar') {
                if (platform() === 'darwin') this.window.webContents.executeJavaScript(this.titleBar);
            }
        } catch (error) {
            debugger;
        }
    }


    public setMaxRes(params: { width: number, height: number, reload: boolean }) {

        const { width, height, reload } = params;

        this.localStorageQuery('set', 'maxRes', { width, height });

        if (reload) {
            this.setResEmulator(width, height);
            this.window.webContents.reload();
        } else this.updateWindowParams();

    }

    /** Emulate a screen with assigned parameters */
    private setResEmulator(emuWidth: number = 3840, emuHeight: number = 2160) {

        // Delete all listeners.
        this.window.removeAllListeners('resize');

        // Performs an initial calculation.
        this.calcEmulatedDisplay(emuWidth, emuHeight);

        // Add a listener to the window to recalculate the emulator.
        this.window.on('resize', () => {
            this.calcEmulatedDisplay(emuWidth, emuHeight);
            this.updateWindowParams();
        });
    }

    private calcEmulatedDisplay(emuWidth: number, emuHeight: number) {

        // Get the current window size.
        const [width, height] = this.window.getSize();

        this.window.webContents.disableDeviceEmulation();

        this.window.webContents.enableDeviceEmulation({
            screenSize: { width: emuWidth, height: emuHeight },
            viewSize: { width: width / emuWidth, height: height / emuHeight },
            scale: width / emuWidth,
            screenPosition: 'mobile',
            viewPosition: { x: 0.5, y: 0.5 },
            deviceScaleFactor: 0
        })

    }

    /**
     * Listen keyboard shortcuts to perform some actions.
     */
    private setAccelerators() {

        // Register a local shortcut to toggle the settings window.
        electronLocalshortcut.register(this.window, 'ctrl+s', () => {
            if (this.settings) {
                this.settings.destroy();
                this.settings = null;
            } else {
                this.settings = new Settings();
            }
        });

        // Toggle full-screen mode for the renderer window.
        electronLocalshortcut.register(this.window, 'ctrl+f', () => {
            this.fullScreen = !this.window.isFullScreen();
        });

        // Toggle the DevTools.
        //electronLocalshortcut.register(this.window, 'ctrl+d', () => {
        //    this.window.webContents.toggleDevTools();
        //});

        // Toggle cursor visibility.
        electronLocalshortcut.register(this.window, 'ctrl+a', () => {
            this.cursor = null;
        });
    }

    /**
     * Performs a query to the local storage of the renderer process.
     * @param type Query type.
     * @param key Key of the object to be stored in the localStorage.
     * @param value Value to be set for the given key.
     */
    public async localStorageQuery(type: 'set', key: string, value: any): Promise<any>;
    public async localStorageQuery(type: 'delete', key: any): Promise<any>;
    public async localStorageQuery(type: 'get', key: any): Promise<any>;
    public async localStorageQuery(type: 'clear'): Promise<any>;
    public async localStorageQuery(type: 'raw', data: string): Promise<any>;
    public async localStorageQuery(type: 'get' | 'set' | 'delete' | 'clear' | 'raw', key?: string, value?: any, data?: string): Promise<any> {

        if (type === 'get' || type === 'set' || type === 'delete' || type === 'clear' || type === 'raw') {

            let query = 'localStorage.';

            if (type === 'get') query += `getItem('${key}')`
            else if (type === 'set') {

                if (typeof value === 'object') value = `'${JSON.stringify(value)}'`;
                query += `setItem('${key}', ${value})`;

            } else if (type === 'delete') query += `removeItem('${key}')`
            else if (type === 'clear') query += 'clear()'
            else if (type === 'raw') query = data as string;

            const unresolvedQuery = this.window.webContents.executeJavaScript(query);

            if (type === 'get') {
                try {

                    const resolver = await unresolvedQuery;
                    const parsed = JSON.parse(resolver);
                    return Promise.resolve(parsed);

                } catch (error) {
                    return unresolvedQuery;
                }
            } else return unresolvedQuery;

        } else return Promise.reject('unknown query type');
    }

    private listenWindowMoveEvents() {
        this.window.on('moved', () => { this.updateWindowParams() })
    }

    private getWindowParams() {

        const bounds = this.window.getBounds();
        const fullscreen = this.window.isFullScreen();
        const cursor = this._cursor ? true : false;

        return { bounds, fullscreen, cursor } as windowParams;

    }

    private updateWindowParams() {
        const params = this.getWindowParams();
        this.localStorageQuery('set', 'windowParams', params);
    }

    private loadSettings() {

        this.localStorageQuery('get', 'windowParams')
            .then((data: windowParams) => {

                this.window.setBounds(data.bounds)
                this.window.fullScreen = data.fullscreen;
                this.cursor = data.cursor;

                this.window.on('resized', () => {
                    this.updateWindowParams();
                });

            });

        this.localStorageQuery('get', 'maxRes')
            .then((data: resolution) => {

                // If the usen has not set a resolution, set the default one.
                if (!data) this.setResEmulator();
                else {
                    if (data.width && data.height) this.setResEmulator(data.width, data.height)
                    else this.setResEmulator();
                }
            })
            .catch(err => {
                // If the data is invalid or not available, set the default resolution.
                this.setResEmulator(3840, 2160);
            })

    }

    /**
     * Load new user connection **and reload the renderer process**.\
     * If value is '\_\_DFT\_\_', the default YouTube TV url will be loaded.
     * */
    public set url(value: string) {
        let url = value;
        if (typeof value !== 'string') return;
        if (value.length < 1) return;
        if (value === '__DFT__') url = '';

        this.window.loadURL(this._url + url, { userAgent: this.userAgent })
            .then(() => {
                this.injectJSCode();
            })
            .catch(async () => {

                ipcMain.once('restored', () => { this.url = value });

                this.injectJSCode('titlebar');
                const offline = await readFile(join(__dirname, 'offline_banner.js'), { encoding: 'utf8' });
                this.window.webContents.executeJavaScript(offline);

            })
    }

    public set urlByDial(value: string) {
        if (typeof value !== 'string') return;
        if (value.length < 1) return;

        this.window.fullScreen = true;

        this.window.webContents.loadURL(this._url + value, { userAgent: this.userAgent })
            .then(() => {
                this.injectJSCode();
            })
            // This should never happen...
            .catch(async () => {

                ipcMain.once('restored', () => { this.urlByDial = value });

                this.injectJSCode('titlebar');
                const offline = await readFile(join(__dirname, 'offline_banner.js'), { encoding: 'utf8' });
                this.window.webContents.executeJavaScript(offline);

            })
    }

    public set fullScreen(value: boolean | null) {
        if (value === null) {
            this.fullScreen = !this.window.isFullScreen();
            return;
        } else {
            if (typeof value !== 'boolean') return;
            this.window.fullScreen = value;
            this.updateWindowParams();
        }
    }

    /** Toggle cursor visibility */
    public set cursor(value: boolean | null) {
        if (typeof value !== 'boolean') this._cursor = !this._cursor
        else this._cursor = value;

        if (this._cursor) {
            this.window.webContents.insertCSS('html {cursor: default;}');
        } else if (!this._cursor) {
            this.window.webContents.insertCSS('html {cursor: none;}');
        } else {
            this.window.webContents.insertCSS('html {cursor: none;}');
        }

        this.updateWindowParams();
    }

}