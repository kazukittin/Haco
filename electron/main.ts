import { app, BrowserWindow, Menu } from 'electron'
import path from 'path'
import { registerIPCHandlers } from './ipc-handlers'
import { setupFolderWatcher } from './library'

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Haco',
        icon: path.join(__dirname, '../icon/icon.png'),
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    })

    // メニューバーを完全に削除
    Menu.setApplicationMenu(null)

    // In development, load from Vite dev server
    if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
        mainWindow.webContents.openDevTools()
    } else {
        // In production, load the built index.html
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }
}

app.whenReady().then(() => {
    // IPCハンドラーを登録
    registerIPCHandlers()

    // フォルダ監視を開始
    setupFolderWatcher()

    createWindow()


    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
