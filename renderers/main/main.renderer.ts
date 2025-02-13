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
    width: number;
    /** Screen height */
    height: number;
}

interface windowParams {
    bounds: Electron.Rectangle;
    fullscreen: boolean;
    cursor: boolean;
}

export class Renderer {

    /** userAgent allowed by YouTube TV. */
    private readonly userAgent: string =
      'Mozilla/5.0 (X11; Linux i686) AppleWebKit/534.24 (KHTML, like Gecko) Chrome/11.0.696.77 Large Screen Safari/534.24 GoogleTV/092754';

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

    /** External ad bypass injection code */
    private adBypass: string = '';

    /** External gamepad injection code */
    private gamepad: string = '';

    constructor() {

        // Set app menu to null.
        Menu.setApplicationMenu(null);

        app.on('ready', () => {

            this.createWindow();

            this.listenWindowMoveEvents();

            this.url = '__DFT__';

            // Call injectJSCode once the DOM is ready.
            this.window.webContents.on('dom-ready', () => this.injectJSCode());

            this.setAccelerators();

            if (platform() === 'darwin') {
                this.window.on('enter-full-screen', () => this.fullScreen = true);
                this.window.on('leave-full-screen', () => this.fullScreen = false);
            }

            this.window.on('close', () => {
                if (this.settings) {
                    this.settings.destroy();
                    this.settings = null;
                }
            });
        })
        .on('window-all-closed', () => { app.quit(); });
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
     * Inject JavaScript code into the renderer process.
     * Instead of inline scripts, external files (injection.js, titleBar.js, adBypass.js, gamepad.js)
     * are loaded and injected.
     * @param script Type of script to be injected.
     */
    private async injectJSCode(script: 'all' | 'patchs' | 'titlebar' = 'all') {
        try {
            // Load main injection script if not already loaded.
            if (this.jsic === '') {
                this.jsic = await readFile(join(__dirname, 'injection.js'), { encoding: 'utf8' });
            }
    
            // Load titleBar script on macOS if not already loaded.
            if (platform() === 'darwin' && this.titleBar === '') {
                this.titleBar = await readFile(join(__dirname, 'titleBar.js'), { encoding: 'utf8' });
            }
    
            // Load the ad bypass script from an external file.
            if (this.adBypass === '') {
                this.adBypass = await readFile(join(__dirname, 'adBypass.js'), { encoding: 'utf8' });
            }
    
            // Load the gamepad input handling script from an external file.
            if (this.gamepad === '') {
                this.gamepad = await readFile(join(__dirname, 'gamepad.js'), { encoding: 'utf8' });
            }
    
            // Decide which scripts to inject based on the provided parameter.
            if (script === 'all') {
                this.window.webContents.executeJavaScript(this.jsic);
                this.window.webContents.executeJavaScript(this.adBypass);
                this.window.webContents.executeJavaScript(this.gamepad);
                if (platform() === 'darwin') {
                    this.window.webContents.executeJavaScript(this.titleBar);
                }
            } else if (script === 'patchs') {
                this.window.webContents.executeJavaScript(this.jsic);
                this.window.webContents.executeJavaScript(this.adBypass);
                this.window.webContents.executeJavaScript(this.gamepad);
            } else if (script === 'titlebar') {
                if (platform() === 'darwin') {
                    this.window.webContents.executeJavaScript(this.titleBar);
                }
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
        });
    }

    /**
     * Listen for keyboard shortcuts to perform some actions.
     */
    private setAccelerators() {

        // Register a local shortcut to toggle the settings window.
        electronLocalshortcut.register(this.window, 'CommandOrControl+S', () => {
            if (this.settings) {
                this.settings.destroy();
                this.settings = null;
            } else {
                this.settings = new Settings();
            }
        });

        // Toggle full-screen mode for the renderer window.
        electronLocalshortcut.register(this.window, 'CommandOrControl+F', () => {
            this.fullScreen = !this.window.isFullScreen();
        });

        // Toggle the DevTools.
        // electronLocalshortcut.register(this.window, 'CommandOrControl+D', () => {
        //    this.window.webContents.toggleDevTools();
        // });

        // Toggle cursor visibility.
        electronLocalshortcut.register(this.window, 'CommandOrControl+A', () => {
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

            if (type === 'get') query += `getItem('${key}')`;
            else if (type === 'set') {

                if (typeof value === 'object') value = `'${JSON.stringify(value)}'`;
                query += `setItem('${key}', ${value})`;

            } else if (type === 'delete') query += `removeItem('${key}')`;
            else if (type === 'clear') query += 'clear()';
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
        this.window.on('moved', () => { this.updateWindowParams(); });
    }

    private getWindowParams() {
        const bounds = this.window.getBounds();
        const fullscreen = this.window.isFullScreen();
        const cursor = this._cursor ? true : false;
        return { bounds, fullscreen, cursor } as windowParams;
    }

    private updateWindowParams() {
        if (this.window.isDestroyed()) {
            console.warn("Window is destroyed; skipping updateWindowParams.");
            return;
        }
        const params = this.getWindowParams();
        this.localStorageQuery('set', 'windowParams', params);
    }
    
    private loadSettings() {
        this.localStorageQuery('get', 'windowParams')
            .then((data: windowParams) => {
                this.window.setBounds(data.bounds);
                this.window.fullScreen = data.fullscreen;
                this.cursor = data.cursor;
                this.window.on('resized', () => {
                    this.updateWindowParams();
                });
            });

        this.localStorageQuery('get', 'maxRes')
            .then((data: resolution) => {
                // If the user has not set a resolution, set the default one.
                if (!data) this.setResEmulator();
                else {
                    if (data.width && data.height) this.setResEmulator(data.width, data.height);
                    else this.setResEmulator();
                }
            })
            .catch(err => {
                // If the data is invalid or not available, set the default resolution.
                this.setResEmulator(3840, 2160);
            });
    }

    /**
     * Load new user connection **and reload the renderer process**.
     * If value is '__DFT__', the default YouTube TV url will be loaded.
     */
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

                ipcMain.once('restored', () => { this.url = value; });

                this.injectJSCode('titlebar');
                const offline = await readFile(join(__dirname, 'offline_banner.js'), { encoding: 'utf8' });
                this.window.webContents.executeJavaScript(offline);
            });
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

                ipcMain.once('restored', () => { this.urlByDial = value; });

                this.injectJSCode('titlebar');
                const offline = await readFile(join(__dirname, 'offline_banner.js'), { encoding: 'utf8' });
                this.window.webContents.executeJavaScript(offline);
            });
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
        if (typeof value !== 'boolean') this._cursor = !this._cursor;
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
