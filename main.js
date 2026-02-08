// const { app, BrowserWindow } = require('electron');
// const path = require('path');
// const serve = require('electron-serve').default;
// const { ipcMain, app } = require('electron');
// const fs = require('fs');
// const path = require('path');
// // Chỉ định thư mục 'out' (Next.js export)
// const loadURL = serve({ directory: 'out' });

// function createWindow() {
//     const win = new BrowserWindow({
//         width: 1200,
//         height: 800,
//         webPreferences: {
//             nodeIntegration: false,
//             contextIsolation: true,
//             preload: path.join(__dirname, 'preload.js')
//         }
//     });

//     if (!app.isPackaged) {
//         win.loadURL('http://localhost:3000');
//     } else {
//         loadURL(win);
//     }
// }


// ipcMain.on('save-data-backup', (event, data) => {
//     // Đường dẫn lưu file: Documents/TallyBackups/data.json
//     const dir = path.join(app.getPath('documents'), 'TallyBackups');
//     const filePath = path.join(dir, 'backup_votes.json');

//     // Tạo thư mục nếu chưa có
//     if (!fs.existsSync(dir)) {
//         fs.mkdirSync(dir, { recursive: true });
//     }

//     // Ghi đè hoặc nối thêm vào file
//     // Ở đây chúng ta ghi đè toàn bộ danh sách mới nhất để đồng bộ với DB
//     fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
//         if (err) console.error("Lưu file thất bại:", err);
//         else console.log("Đã backup vào:", filePath);
//     });
// });

// app.whenReady().then(createWindow);


const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const serve = require('electron-serve').default;
// Chỉ định thư mục 'out' (Next.js export)
const loadURL = serve({ directory: 'out' });
const { machineIdSync } = require('node-machine-id')

ipcMain.handle('get-machine-id', () => {
    return machineIdSync(true) // true = hashed (khuyến nghị)
})

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: app.isPackaged
                ? path.join(process.resourcesPath, 'preload.js')
                : path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (!app.isPackaged) {
        win.loadURL('http://localhost:3000');
        // Mở DevTools để debug nếu cần
        // win.webContents.openDevTools();
    } else {
        loadURL(win);
    }
}

ipcMain.handle('save-data-backup', async (_event, data) => {
    try {
        const exeDir = path.dirname(process.execPath);
        const dir = path.join(exeDir, 'DuLieuBauCu_2026_Backups');

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const filePath = path.join(
            dir,
            `${data?.meta?.dbName || 'BauCu2026_DB'}_backup.json`
        );

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

        return { success: true, filePath };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('restore-data-backup', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (canceled || filePaths.length === 0) return null;

    try {
        const content = fs.readFileSync(filePaths[0], 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error("Lỗi đọc file restore:", error);
        return { error: "Không thể đọc file" };
    }
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});