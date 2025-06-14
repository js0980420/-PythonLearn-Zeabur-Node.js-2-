// WebSocket 連接和通訊管理
class WebSocketManager {
    constructor() {
        this.ws = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.messageQueue = [];
        this.heartbeatInterval = null;
        this.connectionTimeout = null;
        this.isReconnecting = false;
        
        // 確保在建構時初始化全局實例
        if (!window.wsManager) {
            window.wsManager = this;
        }
        
        // 等待 UI 管理器初始化
        this.waitForUI();
    }
    
    // 等待 UI 管理器初始化
    async waitForUI() {
        if (!window.UI) {
            console.log('⏳ 等待 UI 管理器初始化...');
            await new Promise(resolve => setTimeout(resolve, 100));
            await this.waitForUI();
        }
    }

    // 檢查連接狀態
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    // 建立 WebSocket 連接
    connect(roomName, userName) {
        // 防止重複連接
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            console.log('⚠️ 正在連接中，請稍候...');
            return;
        }

        this.currentUser = userName;
        this.currentRoom = roomName;
        
        // 智能檢測 WebSocket URL
        let wsUrl;
        try {
        // 檢查是否為本地開發環境
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' || 
                           window.location.hostname.includes('192.168.');
        
        if (isLocalhost) {
            console.log('🏠 檢測到本地開發環境');
                // 確保使用正確的端口
                const port = window.location.port || '3000';
                wsUrl = `ws://localhost:${port}`;
        } else {
            console.log('☁️ 檢測到雲端環境');
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl = `${protocol}//${window.location.host}`;
        }
        
            console.log(`🔌 準備連接到: ${wsUrl}`);
            console.log(`👤 用戶資訊: ${userName} @ ${roomName}`);
            
            // 如果已經有連接，先關閉它
            if (this.ws) {
                console.log('🔄 關閉現有連接...');
                this.ws.close();
                this.ws = null;
            }
            
            // 創建新的 WebSocket 連接
        this.ws = new WebSocket(wsUrl);
            console.log('📡 WebSocket 實例已創建');
            
            // 設置連接超時
            const connectionTimeout = setTimeout(() => {
                if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
                    console.log('❌ 連接超時，正在重試...');
                    this.ws.close();
                    this.handleReconnection();
                }
            }, 5000);
            
            // 連接成功
        this.ws.onopen = () => {
                clearTimeout(connectionTimeout);
                console.log('✅ WebSocket 連接成功!');
            this.reconnectAttempts = 0;
                
                // 發送加入房間請求
            this.sendMessage({
                type: 'join_room',
                    room: roomName,
                    userName: userName
            });

                // 啟動心跳
                this.startHeartbeat();
                
                // 處理未發送的消息
            this.processMessageQueue();
                
                // 更新UI狀態
                if (window.UI && typeof window.UI.showSuccessToast === 'function') {
                    window.UI.showSuccessToast('已連接到服務器');
                }
            };
            
            // 接收消息
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                    console.log('📨 收到消息:', message.type);
                this.handleMessage(message);
            } catch (error) {
                    console.error('❌ 解析消息失敗:', error);
            }
        };

            // 連接關閉
        this.ws.onclose = (event) => {
                clearTimeout(connectionTimeout);
                console.log(`🔌 連接關閉 [${event.code}]`);
                this.cleanup();
                
                // 非正常關閉才重連
                if (event.code !== 1000) {
                    this.handleReconnection();
                }
                
                // 更新UI狀態
                if (window.UI && typeof window.UI.showWarningToast === 'function') {
                    window.UI.showWarningToast('與服務器的連接已斷開');
                }
            };
            
            // 連接錯誤
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket 錯誤:', error);
                // 不在這裡處理重連，讓 onclose 處理
            };

        } catch (error) {
            console.error('❌ 建立連接時發生錯誤:', error);
            this.handleReconnection();
        }
    }
    
    // 清理資源
    cleanup() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        if (this.ws) {
            this.ws.onclose = null; // 防止重複觸發
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.onopen = null;
            
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.close();
            }
            this.ws = null;
        }
    }
    
    // 處理重連
    handleReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('❌ 重連次數已達上限');
            if (window.UI && typeof window.UI.showErrorToast === 'function') {
                window.UI.showErrorToast('無法連接到服務器，請刷新頁面重試');
            }
            return;
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
        
        console.log(`🔄 準備第 ${this.reconnectAttempts} 次重連，等待 ${delay}ms...`);
        
        if (window.UI && typeof window.UI.showInfoToast === 'function') {
            window.UI.showInfoToast(`正在重新連接 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        }
        
        setTimeout(() => {
            if (this.currentRoom && this.currentUser) {
                this.connect(this.currentRoom, this.currentUser);
            }
        }, delay);
    }
    
    // 更新連接狀態UI
    updateConnectionStatus(isConnected, message = '') {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.className = isConnected ? 'connected' : 'disconnected';
            statusElement.textContent = isConnected ? '已連接' : (message || '未連接');
        }
        
        // 更新在線用戶顯示
        const onlineUsersElement = document.getElementById('onlineUsers');
        if (onlineUsersElement) {
            onlineUsersElement.style.opacity = isConnected ? '1' : '0.5';
        }
    }
    
    // 更新在線用戶列表
    updateUserList(users) {
        const userListElement = document.getElementById('userList');
        if (!userListElement) return;
        
        userListElement.innerHTML = '';
        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'user-item';
            userElement.textContent = user.name;
            if (user.name === this.currentUser) {
                userElement.classList.add('current-user');
            }
            userListElement.appendChild(userElement);
        });
        
        // 更新用戶計數
        const userCountElement = document.getElementById('userCount');
        if (userCountElement) {
            userCountElement.textContent = users.length;
        }
    }
    
    // 開始心跳
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected()) {
                this.sendMessage({ type: 'ping' });
            }
        }, 20000);
    }
    
    // 停止心跳
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // 發送消息
    sendMessage(message) {
        if (this.isConnected()) {
            try {
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('❌ 發送消息失敗:', error);
                this.messageQueue.push(message);
            }
        } else {
            this.messageQueue.push(message);
        }
    }

    // 處理消息
    handleMessage(message) {
        console.log('📨 收到消息:', message.type);
        
        // 確保 UI 管理器已初始化
        if (!window.UI) {
            console.error('❌ UI 管理器尚未初始化');
            return;
        }
        
        switch (message.type) {
            case 'room_joined':
                console.log('✅ 成功加入房間:', message);
                // 更新在線用戶列表
                if (message.users && Array.isArray(message.users)) {
                    window.UI.updateOnlineUsers(message.users);
                }
                break;
            
            case 'user_joined':
                console.log('👋 新用戶加入:', message.user);
                this.handleUserJoined(message);
                break;
            
            case 'user_left':
                console.log('👋 用戶離開:', message);
                this.handleUserLeft(message);
                break;
            
            case 'code_change':
                console.log('📝 收到代碼變更:', message);
                this.handleCodeChange(message);
                break;
            
            case 'chat_message':
                console.log('💬 收到聊天消息:', message);
                this.handleChatMessage(message);
                break;
            
            case 'error':
                console.error('❌ 收到錯誤消息:', message);
                this.handleError(message);
                break;
            
            case 'pong':
                // 心跳回應，不需要處理
                break;
            
            default:
                console.warn('⚠️ 未知消息類型:', message.type);
        }
    }

    // 處理加入房間成功
    handleRoomJoined(message) {
        console.log('✅ 成功加入房間:', message);
        this.updateUserList(message.users);
        
        // 更新房間信息
        const roomNameElement = document.getElementById('roomName');
        if (roomNameElement) {
            roomNameElement.textContent = message.roomId;
        }
        
        // 顯示歡迎消息
        if (window.chatManager) {
            window.chatManager.addSystemMessage(`歡迎 ${message.userName} 加入房間！`);
        }
    }

    // 處理用戶加入
    handleUserJoined(message) {
        if (!window.UI) return;
        
        console.log('👋 處理用戶加入:', message);
        const users = window.UI.getOnlineUsers() || [];
        users.push(message.user);
        window.UI.updateOnlineUsers(users);
    }

    // 處理用戶離開
    handleUserLeft(message) {
        if (!window.UI) return;
        
        console.log('👋 處理用戶離開:', message);
        const users = window.UI.getOnlineUsers() || [];
        const updatedUsers = users.filter(user => 
            user.id !== message.userId && 
            user.userName !== message.userName
        );
        window.UI.updateOnlineUsers(updatedUsers);
    }
    
    // 處理錯誤
    handleError(message) {
        const errorMessage = message.error || message.message || '發生未知錯誤';
        console.error('❌ 收到錯誤:', errorMessage);
        
        // 顯示錯誤提示
        if (window.UI && typeof window.UI.showErrorToast === 'function') {
            window.UI.showErrorToast(errorMessage);
        }
        
        // 添加系統錯誤消息到聊天室
        if (window.chatManager && typeof window.chatManager.addSystemMessage === 'function') {
            window.chatManager.addSystemMessage(`❌ ${errorMessage}`);
        }
    }

    // 處理聊天消息
    async handleChatMessage(message) {
        console.log('💬 處理聊天消息:', message);
        
        if (!window.Chat || !window.Chat.initialized) {
            console.error('❌ 聊天系統未初始化');
            return;
        }
        
        window.Chat.addMessage(message.userName, message.message);
    }

    // 處理代碼變更
    handleCodeChange(message) {
        if (!window.Editor) {
            console.error('❌ 編輯器未初始化');
            return;
        }

        // 如果是自己發送的代碼變更，忽略
        if (message.userName === this.currentUser) {
            return;
        }

        // 應用遠程代碼變更
        window.Editor.setCode(message.code, message.version);
        console.log(`✅ 已應用來自 ${message.userName} 的代碼變更`);
    }

    // 處理消息隊列
    processMessageQueue() {
        while (this.messageQueue.length > 0 && this.isConnected()) {
            const message = this.messageQueue.shift();
            this.sendMessage(message);
        }
    }

    // 等待UI和聊天管理器初始化
    async waitForManagers() {
        let attempts = 0;
        const maxAttempts = 20;
        const retryInterval = 1000;
        
        while (attempts < maxAttempts) {
            // 檢查UI管理器
            const uiReady = window.UI && window.UI.initialized;
            
            // 檢查聊天管理器
            const chatReady = window.Chat && window.Chat.manager && window.Chat.manager.initialized;
            
            if (uiReady && chatReady) {
                console.log('✅ UI和聊天管理器已就緒');
                return true;
            }
            
            console.log(`⏳ 等待管理器初始化... (第${attempts + 1}次嘗試)`);
            
            // 詳細的狀態日誌
            if (!uiReady) {
                if (window.UI) {
                    console.log('- UI管理器狀態: 已創建但未初始化');
                } else {
                    console.log('- UI管理器狀態: 未創建');
                }
            }
            
            if (!chatReady) {
                if (window.Chat) {
                    if (window.Chat.manager) {
                        console.log('- 聊天管理器狀態: 已創建但未初始化');
                    } else {
                        console.log('- 聊天管理器狀態: Chat存在但manager未創建');
                    }
                } else {
                    console.log('- 聊天管理器狀態: Chat對象未創建');
                }
            }
            
            // 如果Chat對象存在但manager未創建，嘗試初始化
            if (window.Chat && !window.Chat.manager && typeof window.Chat.initialize === 'function') {
                console.log('🔄 嘗試初始化聊天管理器...');
                try {
                    window.Chat.initialize();
                } catch (error) {
                    console.error('❌ 聊天管理器初始化失敗:', error);
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, retryInterval));
            attempts++;
        }
        
        console.error('❌ 等待管理器初始化超時');
        return false;
    }
}

// 創建全局實例
window.wsManager = new WebSocketManager(); 