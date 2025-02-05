import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import electronLocalshortcut from 'electron-localshortcut';
import main from '../../main';

// Listen for logs from the renderer
ipcMain.on('renderer-log', (_, ...args) => {
    console.log('[AdBlock listener]:', ...args);
});

export class Settings {

    private window: BrowserWindow;

    constructor() {
        app.whenReady().then(() => {

            this.window = new BrowserWindow({
                resizable: false,
                fullscreen: false,
                width: 400,
                height: 500,
                title: 'Settings',
                backgroundColor: '#181818',
                webPreferences: {
                    contextIsolation: false,
                    nodeIntegration: true
                }
            });

            ipcMain.on('update', (_, params: { width: number, height: number, reload: boolean }) => {
                const { renderer } = main;
                renderer.setMaxRes(params);
            });



            // Optionally, you could also register additional shortcuts if needed:
            // electronLocalshortcut.register(this.window, 'ctrl+shift+z', () => { ... });

            this.window.loadFile(join(__dirname, 'index.html'));
        });
    }

    public destroy() {
        if (this.window) {
            // Unregister all local shortcuts for this window.
            electronLocalshortcut.unregisterAll(this.window);
            this.window.destroy();
        }
    }
}
