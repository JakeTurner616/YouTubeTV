import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import { join } from 'path';
import main from '../../main';

// Listen for logs from the renderer
ipcMain.on('renderer-log', (_, ...args) => {
    console.log('[Renderer Log]:', ...args);
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

			// Register a global shortcut to toggle the DevTools.
			globalShortcut.register('ctrl+shift+d', () => { 
				this.window.webContents.toggleDevTools(); 
			});

			// Optionally, open the DevTools automatically on load:
			// this.window.webContents.openDevTools();

			this.window.loadFile(join(__dirname, 'index.html'));
		});
	}

	public destroy() {
		this.window.destroy();
	}
}
