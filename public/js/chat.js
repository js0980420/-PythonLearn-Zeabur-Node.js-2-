// 聊天功能管理
class ChatManager {
    constructor() {
        this.chatContainer = null;
        this.chatInput = null;
        this.initialized = false;
        this.initializationAttempts = 0;
        this.maxInitializationAttempts = 10;
    }

    // 初始化聊天功能
    initialize() {
        console.log('🔍 開始初始化聊天模組...');
        
        // 確保DOM完全準備好
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeAfterDelay());
        } else {
            this.initializeAfterDelay();
        }
    }

    // 延遲初始化
    initializeAfterDelay() {
        setTimeout(() => this.attemptInitialization(), 500);
    }

    // 嘗試初始化
    attemptInitialization() {
        this.initializationAttempts++;
        console.log(`🔍 嘗試初始化聊天室 (第${this.initializationAttempts}次)...`);
        
        // 獲取必要的DOM元素
        this.chatContainer = document.getElementById('chatContainer');
        this.chatInput = document.getElementById('chatInput');
        
        // 檢查元素是否存在
        if (!this.chatContainer || !this.chatInput) {
            console.log('⚠️ 聊天元素未找到，創建元素...');
            this.createChatElements();
            
            // 重新獲取元素
            this.chatContainer = document.getElementById('chatContainer');
            this.chatInput = document.getElementById('chatInput');
        }
        
        // 如果元素已存在，設置它們
        if (this.chatContainer && this.chatInput) {
            this.setupChatElements();
            return;
        }
        
        // 如果還沒找到元素且未達到最大嘗試次數，繼續嘗試
        if (this.initializationAttempts < this.maxInitializationAttempts) {
            setTimeout(() => this.attemptInitialization(), 1000);
        } else {
            console.error('❌ 聊天室初始化失敗，已達到最大嘗試次數');
        }
    }

    // 創建聊天元素
    createChatElements() {
        console.log('🔧 創建聊天元素...');
        
        const chatSection = document.getElementById('chatSection');
        if (!chatSection) {
            console.error('❌ 找不到聊天區域容器 #chatSection');
            return;
        }
        
        // 清空現有內容
        chatSection.innerHTML = '';
        
        // 創建聊天容器
        const container = document.createElement('div');
        container.id = 'chatContainer';
        container.className = 'chat-container p-2 mb-2';
        container.style.cssText = 'height: 300px; overflow-y: auto; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px;';
        chatSection.appendChild(container);
        
        // 創建輸入區域
        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        inputGroup.innerHTML = `
            <input type="text" class="form-control" id="chatInput" placeholder="輸入消息...">
            <button class="btn btn-primary" onclick="globalSendChat()">
                <i class="fas fa-paper-plane"></i>
            </button>
        `;
        chatSection.appendChild(inputGroup);
        
        console.log('✅ 聊天元素創建完成');
    }

    // 設置聊天元素
    setupChatElements() {
        if (this.initialized) return;
        
        console.log('✅ 設置聊天元素...');
        
        // 設置Enter鍵發送
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // 添加歡迎消息
        this.addSystemMessage('聊天室已準備就緒！可以開始對話了 💬');
        
        this.initialized = true;
        console.log('✅ 聊天模組初始化完成');
    }

    // 發送聊天消息
    sendMessage() {
        if (!this.initialized || !this.chatInput) {
            console.error('❌ 聊天模組未初始化完成，無法發送消息');
            return;
        }

        const message = this.chatInput.value.trim();
        if (!message) {
            console.log('❌ 消息為空，取消發送');
            return;
        }

        if (!wsManager || !wsManager.isConnected()) {
            console.error('❌ WebSocket未連接，無法發送消息');
            if (window.UI) {
                window.UI.showErrorToast('無法發送消息：未連接到伺服器');
            }
            return;
        }

        console.log('📤 發送聊天消息...');
        wsManager.sendMessage({
            type: 'chat_message',
            message: message
        });

        // 清空輸入框
        this.chatInput.value = '';
        
        // 聚焦輸入框
        this.chatInput.focus();
    }

    // 發送AI回應到聊天室
    sendAIResponseToChat(aiResponse) {
        if (!aiResponse || !wsManager.isConnected()) return;
        
        // 清理HTML標籤，保留文本內容
        const cleanResponse = this.stripHtmlTags(aiResponse);
        const formattedMessage = `🤖 AI助教回應：\n${cleanResponse}`;
        
        wsManager.sendMessage({
            type: 'chat_message',
            message: formattedMessage
        });
        
        // 顯示成功提示
        if (UI && UI.showSuccessToast) {
            UI.showSuccessToast('AI回應已分享到聊天室');
        }
        
        // 切換到聊天室查看
        if (UI && UI.switchToChat) {
            UI.switchToChat();
        }
    }

    // 清理HTML標籤
    stripHtmlTags(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // 處理列表項目
        const listItems = tempDiv.querySelectorAll('li');
        listItems.forEach(li => {
            li.innerHTML = '• ' + li.innerHTML;
        });
        
        // 獲取純文本
        let text = tempDiv.textContent || tempDiv.innerText || '';
        
        // 清理多餘的空行
        text = text.replace(/\n\s*\n/g, '\n').trim();
        
        return text;
    }

    // 添加聊天消息
    addMessage(userName, message, isSystem = false, isTeacher = false, roomName = '') {
        if (!this.chatContainer) {
            console.error('❌ 聊天容器未初始化');
            return;
        }
        
        console.log(`💬 添加聊天消息:`, { userName, isSystem, isTeacher, roomName });
        
        const messageDiv = document.createElement('div');
        let messageClass = 'chat-message';
        
        if (isSystem) {
            messageClass += ' system-message';
        } else if (isTeacher) {
            messageClass += ' teacher-message';
        }
        
        messageDiv.className = messageClass;
        
        // 動態設置消息樣式
        this.setChatMessageStyles(messageDiv, isSystem, isTeacher);
        
        if (message.includes('=== 程式碼衝突討論 ===')) {
            // 衝突代碼特殊格式
            messageDiv.innerHTML = this.formatConflictMessage(userName, message);
        } else {
            // 為教師消息添加特殊標識
            const userDisplay = isTeacher ? `👨‍🏫 ${userName}` : userName;
            const roomDisplay = roomName ? `<span class="chat-message-room">[${roomName}]</span> ` : '';
            const timeString = new Date().toLocaleTimeString('zh-TW', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            messageDiv.innerHTML = `
                <div class="chat-message-header">
                    <span class="chat-message-user">${userDisplay}</span>
                    ${roomDisplay}
                    <span class="chat-message-time">${timeString}</span>
                </div>
                <div class="chat-message-content">${this.escapeHtml(message)}</div>
            `;
        }
        
        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        // 如果是教師消息，播放提示音
        if (isTeacher) {
            this.playNotificationSound();
        }
    }

    // 設置聊天消息樣式
    setChatMessageStyles(messageDiv, isSystem = false, isTeacher = false) {
        if (isSystem) {
            messageDiv.style.cssText = `
                margin-bottom: 12px !important;
                padding: 10px 15px !important;
                border-radius: 8px !important;
                background: #e9ecef !important;
                border-left: 3px solid #6c757d !important;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1) !important;
                font-style: italic !important;
            `;
        } else if (isTeacher) {
            messageDiv.style.cssText = `
                margin-bottom: 12px !important;
                padding: 10px 15px !important;
                border-radius: 8px !important;
                background: #e8f5e8 !important;
                border-left: 3px solid #28a745 !important;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1) !important;
                font-weight: 500 !important;
            `;
        } else {
            messageDiv.style.cssText = `
                margin-bottom: 12px !important;
                padding: 10px 15px !important;
                border-radius: 8px !important;
                background: white !important;
                border-left: 3px solid #007bff !important;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1) !important;
            `;
        }
    }

    // 添加系統消息
    addSystemMessage(message) {
        this.addMessage('系統', message, true);
    }

    // 載入聊天歷史
    loadHistory(messages) {
        if (!this.chatContainer) {
            console.error('❌ 聊天容器未初始化，無法載入歷史');
            return;
        }
        
        console.log(`📜 載入聊天歷史: ${messages.length} 條消息`);
        this.chatContainer.innerHTML = '';
        
        messages.forEach(msg => {
            // 檢查是否為教師消息
            const isTeacher = msg.isTeacher || false;
            const isSystem = msg.type === 'system';
            
            console.log(`📝 載入消息: ${msg.userName} - ${msg.message.substring(0, 50)}... (教師: ${isTeacher})`);
            this.addMessage(msg.userName, msg.message, isSystem, isTeacher);
        });
        
        // 添加歷史載入完成的提示
        if (messages.length > 0) {
            this.addSystemMessage(`已載入 ${messages.length} 條歷史消息`);
        }
    }

    // 格式化衝突消息
    formatConflictMessage(userName, message) {
        const parts = message.split('\n');
        let formattedMessage = `<strong>${userName}:</strong><br>`;
        let inCodeBlock = false;
        
        parts.forEach(part => {
            if (part.includes('我的版本') || part.includes('服務器版本')) {
                formattedMessage += `<br><strong>${part}</strong><br>`;
                inCodeBlock = true;
            } else if (part.includes('請大家討論')) {
                inCodeBlock = false;
                formattedMessage += `<br><em>${part}</em>`;
            } else if (inCodeBlock && part.trim()) {
                formattedMessage += `<div class="conflict-code-block">${this.escapeHtml(part)}</div>`;
            } else if (part.trim()) {
                formattedMessage += this.escapeHtml(part) + '<br>';
            }
        });
        
        return formattedMessage;
    }

    // 轉義HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 滾動到底部
    scrollToBottom() {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    // 聚焦輸入框
    focusInput() {
        if (this.chatInput) {
            this.chatInput.focus();
        }
    }

    // 清除聊天記錄
    clearChat() {
        if (this.chatContainer) {
            this.chatContainer.innerHTML = '';
        }
    }

    // 播放提示音
    playNotificationSound() {
        try {
            if (window.AudioContext || window.webkitAudioContext) {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
                
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
            }
        } catch (error) {
            console.log('🔇 無法播放提示音:', error.message);
        }
    }
}

// 全局聊天管理器實例
const Chat = new ChatManager();

// 同時設置為window全域變數，確保在任何地方都能存取
window.Chat = Chat;

console.log('🔧 聊天管理器已創建');
console.log('✅ 全域 Chat 實例已創建並設置到 window.Chat:', Chat);

// 全局函數供HTML調用
function globalSendChat() {
    Chat.sendMessage();
} 