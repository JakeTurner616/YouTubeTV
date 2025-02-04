/// <reference types="electron" />
/**
 * YouTube TV Desktop Client.
 * Copyright (c) 2021 Marcos Rodríguez Yélamo <marcosylrg@gmail.com>
 * 
 * MIT License
 * For more information, visit https://github.com/marcosrg9/YouTubeTV.
 */

import { app, session, BrowserWindow } from 'electron';
import { Renderer } from './renderers/main/main.renderer';
import { Dial } from './servers/DIAL';

// ✅ Import `node-fetch` as a polyfill for `fetch`
let fetch: any;

// ✅ Dynamically import uBlock Origin Core
let StaticNetFilteringEngine: any;

class Main {
    /** Contains DIAL server instance. */
    public dial: Dial;
    /** Contains the main renderer instance. */
    public renderer: Renderer;
    /** Contains the main application window. */
    public mainWindow: BrowserWindow | null = null;
    /** Contains uBlock Origin Core filtering engine. */
    private snfe: any = null;

    constructor() {
        this.renderer = new Renderer();
        this.dial = new Dial();
        this.initializeApp();
    }

    private async initializeApp(): Promise<void> {
        app.whenReady().then(async () => {
            // Dynamically import `node-fetch`
            fetch = (await import('node-fetch')).default;
            // ✅ Set global `fetch` in Node.js environment
            if (!globalThis.fetch) {
                globalThis.fetch = fetch as any;
            }

            this.mainWindow = new BrowserWindow({
                width: 1200,
                height: 800,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                }
            });

            try {
                // ✅ Import `@gorhill/ubo-core` dynamically
                const module = await import('@gorhill/ubo-core');
                StaticNetFilteringEngine = module.StaticNetFilteringEngine;

                // ✅ Initialize the Static Network Filtering Engine
                this.snfe = await StaticNetFilteringEngine.create();

                // ✅ Load EasyList and EasyPrivacy filter lists
                const filterLists = await Promise.all([
                    fetch('https://easylist.to/easylist/easylist.txt')
                        .then((r: Response) => r.text())
                        .then((raw: string) => ({ name: 'easylist', raw })),
                    fetch('https://easylist.to/easylist/easyprivacy.txt')
                        .then((r: Response) => r.text())
                        .then((raw: string) => ({ name: 'easyprivacy', raw })),
                    fetch('https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt')
                        .then((r: Response) => r.text())
                        .then((raw: string) => ({ name: 'ubo-filters', raw })),
                    fetch('https://raw.githubusercontent.com/ewpratten/youtube_ad_blocklist/refs/heads/master/blocklist.txt')
                    .then((r: Response) => r.text())
                    .then((raw: string) => ({ name: 'ubo-filters', raw })),

                ]);

                await this.snfe.useLists(filterLists);
                console.log('✅ Ad-blocking initialized using uBlock Origin Core');
            } catch (error) {
                console.error('❌ Failed to initialize uBlock Origin Core:', error);
            }

            // ✅ Use `webRequest` to dynamically block ads
            session.defaultSession.webRequest.onBeforeRequest(
                { urls: ['<all_urls>'] },
                (details, callback) => {
                    if (!this.snfe) return callback({});

                    const shouldBlock = this.snfe.matchRequest({
                        originURL: details.referrer || details.url,
                        url: details.url,
                        type: details.resourceType
                    }) !== 0;

                    if (shouldBlock) {
                        //console.log(`🚫 Blocked: ${details.url}`);
                        return callback({ cancel: true });
                    }

                    return callback({});
                }
            );

            // ✅ Load YouTube TV
            this.mainWindow.loadURL('https://tv.youtube.com/');
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });
    }
}

/** Contains the instance of the main process. */
export default new Main();
