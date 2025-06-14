const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { spawn } = require('child_process');
const { handleAIRequest, checkAIAvailability, executePythonCode } = require('./ai-assistant');

// 基本配置
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// 配置 express 中間件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket 服務器配置
const wss = new WebSocket.Server({ 
    server,
    maxPayload: 1024 * 1024 * 2, // 2MB
    perMessageDeflate: false, // 禁用壓縮以提高性能
    clientTracking: true, // 啟用客戶端追蹤
    verifyClient: (info) => {
        console.log('🔍 新的連接請求:', {
            origin: info.origin,
            secure: info.secure,
            path: info.req.url
        });
        return true; // 接受所有連接
    }
});

// 添加 WebSocket 服務器錯誤處理
wss.on('error', (error) => {
    console.error('❌ WebSocket 服務器錯誤:', error);
});

wss.on('listening', () => {
    console.log('✅ WebSocket 服務器已準備好接受連接');
});

// 路由配置
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/teacher', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teacher.html'));
});

app.get('/config', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'config.html'));
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
    console.error('❌ 服務器錯誤:', err);
    res.status(500).send('服務器內部錯誤');
});

// 404 處理
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// 全域變數
const rooms = {};
const users = {};
const teacherMonitors = new Set();

// WebSocket 連接處理
wss.on('connection', (ws, req) => {
    console.log('👤 新用戶連接');
    console.log(`   IP: ${req.socket.remoteAddress}`);
    console.log(`   路徑: ${req.url}`);
    
    // 初始化連接狀態
    ws.isAlive = true;
    ws.userId = null;
    ws.userName = null;
    ws.currentRoom = null;
    
    // 設置 ping 超時
    ws.pingTimeout = setTimeout(() => {
        console.log('❌ Ping 超時，關閉連接');
        ws.terminate();
    }, 30000);
    
    // 心跳檢測
    ws.on('pong', () => {
        ws.isAlive = true;
        clearTimeout(ws.pingTimeout);
        ws.pingTimeout = setTimeout(() => {
            console.log('❌ Ping 超時，關閉連接');
            ws.terminate();
        }, 30000);
    });
    
    // 消息處理
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            console.log('📨 收到消息:', message.type);
            
    switch (message.type) {
        case 'join_room':
                    handleJoinRoom(ws, message);
            break;
                case 'chat_message':
                    handleChatMessage(ws, message);
                    break;
        case 'leave_room':
            handleLeaveRoom(ws, message);
            break;
        case 'code_change':
            handleCodeChange(ws, message);
            break;
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
            break;
        default:
                    console.warn('⚠️ 未知消息類型:', message.type);
        }
    } catch (error) {
            console.error('❌ 處理消息時發生錯誤:', error);
            sendErrorToClient(ws, '消息處理失敗: ' + error.message);
        }
    });
    
    // 連接關閉處理
    ws.on('close', () => {
        clearTimeout(ws.pingTimeout);
        if (ws.currentRoom) {
            handleLeaveRoom(ws, { room: ws.currentRoom });
        }
        console.log('👋 用戶斷開連接');
    });
    
    // 錯誤處理
    ws.on('error', (error) => {
        console.error('❌ WebSocket 錯誤:', error);
        clearTimeout(ws.pingTimeout);
    });
});

// 定期清理斷開的連接
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log('🧹 清理斷開的連接');
            clearTimeout(ws.pingTimeout);
            return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

// 處理加入房間
function handleJoinRoom(ws, message) {
    const { room, userName } = message;
    
    // 驗證輸入
    if (!room || !userName) {
        sendErrorToClient(ws, '房間名稱和用戶名不能為空');
        return;
    }
    
    // 檢查用戶名是否已存在
    const existingUsers = Array.from(wss.clients)
        .filter(client => client.currentRoom === room)
        .map(client => client.userName);
    
    if (existingUsers.includes(userName)) {
        sendErrorToClient(ws, '該用戶名已被使用');
        return;
    }

    // 更新用戶信息
    ws.userName = userName;
    ws.currentRoom = room;
    ws.userId = generateUserId();
    
    // 獲取房間用戶列表
    const roomUsers = Array.from(wss.clients)
        .filter(client => client.currentRoom === room)
        .map(client => ({
            id: client.userId,
            name: client.userName
        }));
    
    // 通知其他用戶
    broadcastToRoom(room, {
        type: 'user_joined',
        user: {
            id: ws.userId,
            name: ws.userName
        }
    }, ws);
    
    // 發送加入成功消息
        ws.send(JSON.stringify({
        type: 'room_joined',
        roomId: room,
        userId: ws.userId,
        userName: ws.userName,
        users: roomUsers
    }));
    
    console.log(`✅ 用戶 ${userName} 加入房間 ${room}`);
}

// 處理離開房間
function handleLeaveRoom(ws, message) {
    const room = message.room || ws.currentRoom;
    if (!room) return;
    
    // 通知其他用戶
    broadcastToRoom(room, {
        type: 'user_left',
        userId: ws.userId,
        userName: ws.userName
    }, ws);
    
    // 清理用戶信息
    ws.currentRoom = null;
    ws.userName = null;
    ws.userId = null;
    
    console.log(`👋 用戶離開房間 ${room}`);
}

// 處理聊天消息
function handleChatMessage(ws, message) {
    if (!ws.currentRoom || !ws.userName) {
        sendErrorToClient(ws, '您需要先加入房間才能發送消息');
        return;
    }

    // 檢查消息內容
    if (!message.message || typeof message.message !== 'string') {
        sendErrorToClient(ws, '無效的消息格式');
        return;
    }

    // 廣播消息到房間
    const chatMessage = {
        type: 'chat_message',
        userId: ws.userId,
        userName: ws.userName,
        message: message.message,
        timestamp: Date.now()
    };

    // 廣播給所有房間成員（包括發送者）
    broadcastToRoom(ws.currentRoom, chatMessage);
    console.log(`💬 用戶 ${ws.userName} 在房間 ${ws.currentRoom} 發送消息`);
}

// 處理代碼變更
function handleCodeChange(ws, message) {
    if (!ws.currentRoom) {
        sendErrorToClient(ws, '請先加入房間');
        return;
    }

    console.log('📝 處理代碼變更:', {
        room: ws.currentRoom,
        user: ws.userName,
        codeLength: message.code.length
    });

    // 廣播代碼變更到房間內的所有用戶（包括發送者）
    broadcastToRoom(ws.currentRoom, {
        type: 'code_change',
        code: message.code,
        userName: ws.userName,
        timestamp: Date.now(),
        version: message.version
    });

    console.log(`✅ 已廣播代碼變更到房間 ${ws.currentRoom} 的所有用戶`);
}

// 廣播消息到房間
function broadcastToRoom(room, message, excludeWs = null) {
    wss.clients.forEach((client) => {
        if (client !== excludeWs && 
            client.currentRoom === room && 
            client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// 發送錯誤消息給客戶端
function sendErrorToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'error',
            message: message
        }));
    }
}

// 生成用戶ID
function generateUserId() {
    return Math.random().toString(36).substring(2, 15);
}

// 服務器關閉時清理
wss.on('close', () => {
    clearInterval(interval);
});

// 啟動服務器
server.listen(PORT, () => {
    console.log(`🚀 服務器已啟動: http://localhost:${PORT}`);
    console.log('✨ WebSocket 服務器已準備就緒');
});

// 錯誤處理
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ 端口 ${PORT} 已被占用，請嘗試其他端口`);
        } else {
        console.error('❌ 服務器錯誤:', error);
    }
    process.exit(1);
});
