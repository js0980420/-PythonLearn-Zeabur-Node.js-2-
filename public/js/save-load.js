// save-load.js - 保存載入功能管理器
console.log('📄 載入 save-load.js 模組');

class SaveLoadManager {
    constructor() {
        this.slots = {};
        this.currentUser = null;
        this.currentRoom = null;
        this.isInitialized = false;
        this.loadRetryCount = 0;
        this.maxLoadRetries = 3;
        this.loadRetryDelay = 1000; // 1秒
        this.userSlots = {}; // 🆕 用戶槽位數據 {slotNumber: {name: string, code: string, timestamp: number}}
        
        console.log('💾 SaveLoadManager 初始化');
        // 注意：不在構造函數中載入槽位數據，等待用戶初始化後再載入
    }

    // 🆕 從本地存儲載入槽位數據（用戶隔離）
    loadSlotsFromStorage() {
        try {
            const userKey = this.getUserStorageKey();
            const stored = localStorage.getItem(userKey);
            if (stored) {
                this.userSlots = JSON.parse(stored);
                console.log(`📂 載入用戶 ${this.currentUser?.name || 'Unknown'} 的槽位數據:`, this.userSlots);
                this.updateSlotDisplayNames();
            } else {
                console.log(`📂 用戶 ${this.currentUser?.name || 'Unknown'} 暫無槽位數據`);
            }
        } catch (error) {
            console.error('❌ 載入槽位數據失敗:', error);
            this.userSlots = {};
        }
    }

    // 🆕 保存槽位數據到本地存儲（用戶隔離）
    saveSlotsToStorage() {
        try {
            const userKey = this.getUserStorageKey();
            localStorage.setItem(userKey, JSON.stringify(this.userSlots));
            console.log(`💾 用戶 ${this.currentUser?.name || 'Unknown'} 的槽位數據已保存到本地存儲`);
        } catch (error) {
            console.error('❌ 保存槽位數據失敗:', error);
        }
    }

    // 🆕 獲取用戶專屬的存儲鍵
    getUserStorageKey() {
        const userName = this.currentUser?.name || 'guest';
        const roomId = this.currentRoom || 'default';
        return `userCodeSlots_${userName}_${roomId}`;
    }

    // 🆕 更新UI中的槽位顯示名稱
    updateSlotDisplayNames() {
        for (let i = 1; i <= 4; i++) {
            const slot = this.userSlots[i];
            const saveSlotNameEl = document.getElementById(`slot${i}Name`);
            const loadSlotNameEl = document.getElementById(`loadSlot${i}Name`);
            
            if (slot) {
                const displayName = `${slot.name} (${new Date(slot.timestamp).toLocaleDateString()})`;
                if (saveSlotNameEl) saveSlotNameEl.textContent = displayName;
                if (loadSlotNameEl) loadSlotNameEl.textContent = displayName;
            } else {
                const defaultName = `槽位 ${i} (空)`;
                if (saveSlotNameEl) saveSlotNameEl.textContent = defaultName;
                if (loadSlotNameEl) loadSlotNameEl.textContent = defaultName;
            }
        }
    }

    // 🆕 保存到指定槽位
    saveToSlot(slotNumber) {
        console.log(`💾 保存到槽位 ${slotNumber}`);
        if (!this.checkInitialized() || !window.Editor) {
            this.showMessage("編輯器未準備好或未加入房間，無法保存。", "error");
            return;
        }
        
        const code = Editor.getCode();
        if (!code || code.trim() === '') {
            this.showMessage('程式碼內容為空，無法保存', 'warning');
            return;
        }

        // 檢查槽位是否已有內容
        const existingSlot = this.userSlots[slotNumber];
        if (existingSlot) {
            this.showSlotOverwriteDialog(slotNumber, code, existingSlot);
        } else {
            this.showSlotNameDialog(slotNumber, code);
        }
    }

    // 🆕 顯示槽位命名對話框
    showSlotNameDialog(slotNumber, code) {
        const modalHTML = `
            <div class="modal fade" id="slotNameModal" tabindex="-1" aria-labelledby="slotNameModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title" id="slotNameModalLabel">
                                <i class="fas fa-bookmark"></i> 保存到槽位 ${slotNumber}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="slotName" class="form-label">槽位名稱</label>
                                <input type="text" class="form-control" id="slotName" 
                                       placeholder="為此槽位命名..." 
                                       value="程式碼 - ${new Date().toLocaleDateString()}"
                                       maxlength="30">
                                <div class="form-text">最多30個字符</div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">程式碼預覽</label>
                                <pre class="bg-light p-2 rounded border" style="max-height: 150px; overflow-y: auto; font-size: 0.9em;">${this.escapeHtml(code)}</pre>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" onclick="globalExecuteSlotSave(${slotNumber})">
                                <i class="fas fa-save"></i> 保存
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除舊的模態框
        const existingModal = document.getElementById('slotNameModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新的模態框
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 顯示模態框
        const modal = new bootstrap.Modal(document.getElementById('slotNameModal'));
        modal.show();

        // 自動選擇輸入框內容
        setTimeout(() => {
            const nameInput = document.getElementById('slotName');
            if (nameInput) {
                nameInput.select();
            }
        }, 100);
    }

    // 🆕 顯示槽位覆蓋確認對話框
    showSlotOverwriteDialog(slotNumber, code, existingSlot) {
        const modalHTML = `
            <div class="modal fade" id="slotOverwriteModal" tabindex="-1" aria-labelledby="slotOverwriteModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title" id="slotOverwriteModalLabel">
                                <i class="fas fa-exclamation-triangle"></i> 覆蓋槽位 ${slotNumber}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle"></i>
                                槽位 ${slotNumber} 已有內容，確定要覆蓋嗎？
                            </div>
                            <div class="mb-3">
                                <label class="form-label">現有內容：</label>
                                <div class="bg-light p-2 rounded border">
                                    <strong>${this.escapeHtml(existingSlot.name)}</strong>
                                    <small class="text-muted d-block">保存時間: ${new Date(existingSlot.timestamp).toLocaleString()}</small>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label for="newSlotName" class="form-label">新的槽位名稱</label>
                                <input type="text" class="form-control" id="newSlotName" 
                                       placeholder="為此槽位命名..." 
                                       value="程式碼 - ${new Date().toLocaleDateString()}"
                                       maxlength="30">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-warning" onclick="globalExecuteSlotSave(${slotNumber}, true)">
                                <i class="fas fa-save"></i> 確認覆蓋
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除舊的模態框
        const existingModal = document.getElementById('slotOverwriteModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新的模態框
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 顯示模態框
        const modal = new bootstrap.Modal(document.getElementById('slotOverwriteModal'));
        modal.show();
    }

    // 🆕 執行槽位保存
    executeSlotSave(slotNumber, isOverwrite = false) {
        const nameInputId = isOverwrite ? 'newSlotName' : 'slotName';
        const nameInput = document.getElementById(nameInputId);
        const slotName = nameInput ? nameInput.value.trim() : '';
        
        if (!slotName) {
            this.showMessage('請輸入槽位名稱', 'warning');
            return;
        }

        const code = Editor.getCode();
        const slotData = {
            name: slotName,
            code: code,
            timestamp: Date.now()
        };

        // 保存到本地
        this.userSlots[slotNumber] = slotData;
        this.saveSlotsToStorage();
        this.updateSlotDisplayNames();

        // 關閉模態框
        const modalId = isOverwrite ? 'slotOverwriteModal' : 'slotNameModal';
        const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
        if (modal) modal.hide();

        this.showMessage(`已保存到槽位 ${slotNumber}: ${slotName}`, 'success');
        console.log(`✅ 槽位 ${slotNumber} 保存成功:`, slotData);
    }

    // 🆕 從槽位載入
    async loadFromSlot(slotId, retryCount = 0) {
        console.log(`📂 從槽位 ${slotId} 載入`);
        
        if (!this.isInitialized) {
            console.error('❌ SaveLoadManager 尚未初始化');
            return false;
        }

        try {
            // 檢查槽位是否存在
            if (!this.userSlots[slotId]) {
                console.error(`❌ 槽位 ${slotId} 不存在`);
                return false;
            }

            const slotData = this.userSlots[slotId];
            
            // 檢查數據完整性
            if (!slotData || !slotData.code) {
                console.error(`❌ 槽位 ${slotId} 數據無效`);
                return false;
            }

            // 設置代碼到編輯器
            if (window.Editor && Editor.setCode) {
                Editor.setCode(slotData.code);
                
                console.log(`✅ 槽位 ${slotId} 載入成功:`, slotData);
                this.loadRetryCount = 0; // 重置重試計數
                return true;
            } else {
                console.error('❌ 編輯器未就緒');
                
                // 如果編輯器未就緒且未超過最大重試次數，則重試
                if (retryCount < this.maxLoadRetries) {
                    console.log(`🔄 等待 ${this.loadRetryDelay}ms 後重試載入 (${retryCount + 1}/${this.maxLoadRetries})`);
                    
                    return new Promise(resolve => {
                        setTimeout(() => {
                            resolve(this.loadFromSlot(slotId, retryCount + 1));
                        }, this.loadRetryDelay);
                    });
                }
                
                return false;
            }
        } catch (error) {
            console.error(`❌ 載入槽位 ${slotId} 時發生錯誤:`, error);
            
            // 如果發生錯誤且未超過最大重試次數，則重試
            if (retryCount < this.maxLoadRetries) {
                console.log(`🔄 等待 ${this.loadRetryDelay}ms 後重試載入 (${retryCount + 1}/${this.maxLoadRetries})`);
                
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve(this.loadFromSlot(slotId, retryCount + 1));
                    }, this.loadRetryDelay);
                });
            }
            
            return false;
        }
    }

    // 🆕 顯示槽位載入確認對話框
    showSlotLoadConfirmDialog(slotNumber, slot) {
        const modalHTML = `
            <div class="modal fade" id="slotLoadModal" tabindex="-1" aria-labelledby="slotLoadModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-info text-white">
                            <h5 class="modal-title" id="slotLoadModalLabel">
                                <i class="fas fa-bookmark"></i> 載入槽位 ${slotNumber}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">槽位資訊：</label>
                                <div class="bg-light p-3 rounded border">
                                    <h6>${this.escapeHtml(slot.name)}</h6>
                                    <small class="text-muted">
                                        <i class="fas fa-clock"></i> 保存時間: ${new Date(slot.timestamp).toLocaleString()}
                                    </small>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">程式碼預覽：</label>
                                <pre class="bg-light p-2 rounded border" style="max-height: 200px; overflow-y: auto; font-size: 0.9em;">${this.escapeHtml(slot.code)}</pre>
                            </div>
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle"></i>
                                載入後將覆蓋目前編輯器中的內容
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-info" onclick="globalExecuteSlotLoad(${slotNumber})">
                                <i class="fas fa-download"></i> 確認載入
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除舊的模態框
        const existingModal = document.getElementById('slotLoadModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新的模態框
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 顯示模態框
        const modal = new bootstrap.Modal(document.getElementById('slotLoadModal'));
        modal.show();
    }

    // 🆕 執行槽位載入
    async globalExecuteSlotLoad(slotId) {
        console.log(`🔍 globalExecuteSlotLoad 被調用: ${slotId}`);
        
        try {
            const success = await this.loadFromSlot(slotId);
            
            if (success) {
                console.log(`SUCCESS: 已從槽位 ${slotId} 載入: ${this.userSlots[slotId].name}`);
            } else {
                console.error(`ERROR: 從槽位 ${slotId} 載入失敗`);
                // 顯示錯誤提示
                if (typeof showToast === 'function') {
                    showToast('error', `載入失敗：請稍後重試`);
                }
            }
            
            return success;
        } catch (error) {
            console.error('❌ globalExecuteSlotLoad 執行失敗:', error);
            // 顯示錯誤提示
            if (typeof showToast === 'function') {
                showToast('error', `載入失敗：${error.message}`);
            }
            return false;
        }
    }

    // 顯示提示訊息的備用函數
    showMessage(message, type = 'info') {
        if (window.UI && window.UI.showMessage) {
            window.UI.showMessage(message, type);
        } else {
            // 備用方案：使用 console 和 alert
            console.log(`${type.toUpperCase()}: ${message}`);
            if (type === 'error' || type === 'warning') {
                alert(message);
            }
        }
    }

    // 初始化
    initialize(userData) {
        if (this.isInitialized) {
            console.log('💾 SaveLoadManager 已經初始化');
            return;
        }

        const { userName, roomName } = userData;
        console.log(`💾 初始化 SaveLoadManager - 用戶: ${userName}, 房間: ${roomName}`);
        
        this.currentUser = userName;
        this.currentRoom = roomName;
        
        // 載入槽位數據
        this.loadSlots().then(() => {
            this.isInitialized = true;
            console.log(`💾 SaveLoadManager 已初始化 - 用戶: ${userName}, 房間: ${roomName}`);
        }).catch(error => {
            console.error('❌ SaveLoadManager 初始化失敗:', error);
        });
    }

    // 檢查是否已初始化
    checkInitialized() {
        if (!this.isInitialized) {
            const message = "SaveLoadManager尚未初始化。請先加入房間。";
            console.warn(message);
            this.showMessage(message, 'warning');
            return false;
        }
        return true;
    }

    // 保存當前代碼
    saveCode() {
        console.log("💾 開始保存代碼");
        if (!this.checkInitialized() || !window.Editor) {
            this.showMessage("編輯器未準備好或未加入房間，無法保存。", "error");
            return;
        }
        
        const code = Editor.getCode();
        if (!code || code.trim() === '') {
            this.showMessage('程式碼內容為空，無法保存', 'warning');
            return;
        }

        // 顯示保存對話框
        this.showSaveDialog(code);
    }

    // 顯示保存對話框
    showSaveDialog(code) {
        const modalHTML = `
            <div class="modal fade" id="saveCodeModal" tabindex="-1" aria-labelledby="saveCodeModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white">
                            <h5 class="modal-title" id="saveCodeModalLabel">
                                <i class="fas fa-save"></i> 保存程式碼
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="saveTitle" class="form-label">保存標題</label>
                                <input type="text" class="form-control" id="saveTitle" 
                                       placeholder="輸入保存標題（可選）" 
                                       value="程式碼保存 - ${new Date().toLocaleString()}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">程式碼預覽</label>
                                <pre class="bg-light p-2 rounded border" style="max-height: 150px; overflow-y: auto; font-size: 0.9em;">${this.escapeHtml(code)}</pre>
                            </div>
                            <div class="text-muted small">
                                <i class="fas fa-info-circle"></i> 
                                保存後其他房間成員將收到通知
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-success" onclick="globalExecuteSave()">
                                <i class="fas fa-save"></i> 確認保存
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除舊的模態框
        const existingModal = document.getElementById('saveCodeModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新的模態框
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 顯示模態框
        const modal = new bootstrap.Modal(document.getElementById('saveCodeModal'));
        modal.show();
    }

    // 執行保存
    executeSave() {
        const title = document.getElementById('saveTitle').value.trim();
        const code = Editor.getCode();

        const saveData = {
            type: 'save_code',
            code: code,
            title: title || `程式碼保存 - ${new Date().toLocaleString()}`,
            roomId: this.currentRoom,
            author: this.currentUser,
            timestamp: Date.now()
        };

        console.log('💾 發送保存請求:', saveData);

        // 通過 WebSocket 發送保存請求
        if (window.wsManager && window.wsManager.isConnected()) {
            window.wsManager.sendMessage(saveData);
            
            // 關閉模態框
            const modal = bootstrap.Modal.getInstance(document.getElementById('saveCodeModal'));
            if (modal) modal.hide();
            
            this.showMessage('保存請求已發送...', 'info');
        } else {
            this.showMessage('WebSocket 連接未建立，無法保存', 'error');
        }
    }

    // 顯示載入對話框
    showLoadDialog() {
        console.log("📂 顯示載入對話框");
        if (!this.checkInitialized()) {
            this.showMessage("未加入房間，無法載入歷史記錄。", "error");
            return;
        }
        this.requestHistory((history) => {
            this.displayLoadDialog(history);
        });
    }

    // 顯示載入界面
    displayLoadDialog(history) {
        let historyHTML = '';
        
        if (history.length === 0) {
            historyHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-inbox text-muted" style="font-size: 2rem;"></i>
                    <p class="text-muted mt-2">尚無保存的程式碼</p>
                    <small class="text-muted">請先保存一些程式碼再進行載入</small>
                </div>
            `;
        } else {
            historyHTML = history.map(item => `
                <div class="card mb-2 load-item" data-id="${item.id}">
                    <div class="card-body py-2">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <h6 class="mb-1">${this.escapeHtml(item.title)}</h6>
                                <small class="text-muted">
                                    <i class="fas fa-user"></i> ${this.escapeHtml(item.author)}
                                    <i class="fas fa-clock ms-2"></i> ${new Date(item.timestamp).toLocaleString()}
                                    <i class="fas fa-code-branch ms-2"></i> v${item.version}
                                </small>
                                <div class="mt-1">
                                    <small class="text-muted">
                                        程式碼預覽: ${item.code.split('\\n')[0].substring(0, 50)}...
                                    </small>
                                </div>
                            </div>
                            <div class="btn-group-vertical btn-group-sm">
                                <button class="btn btn-outline-primary btn-sm" 
                                        onclick="globalLoadSpecificCode('${item.id}')"
                                        title="載入此版本">
                                    <i class="fas fa-download"></i>
                                </button>
                                <button class="btn btn-outline-info btn-sm"
                                        onclick="globalPreviewCode('${item.id}')"
                                        title="預覽程式碼">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        const modalHTML = `
            <div class="modal fade" id="loadCodeModal" tabindex="-1" aria-labelledby="loadCodeModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-info text-white">
                            <h5 class="modal-title" id="loadCodeModalLabel">
                                <i class="fas fa-folder-open"></i> 載入程式碼
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h6 class="mb-0">選擇要載入的程式碼版本</h6>
                                <div>
                                    ${history.length > 0 ? `
                                        <button class="btn btn-success btn-sm" onclick="globalLoadLatestCode()">
                                            <i class="fas fa-star"></i> 載入最新版本
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                            <div style="max-height: 400px; overflow-y: auto;">
                                ${historyHTML}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">關閉</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除舊的模態框
        const existingModal = document.getElementById('loadCodeModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新的模態框
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 顯示模態框
        const modal = new bootstrap.Modal(document.getElementById('loadCodeModal'));
        modal.show();
    }

    // 載入最新版本
    loadLatestCode() {
        console.log('📂 載入最新版本');
        
        const loadData = {
            type: 'load_code',
            roomId: this.currentRoom,
            loadLatest: true
        };

        this.sendLoadRequest(loadData);
    }

    // 載入特定版本
    loadSpecificCode(saveId) {
        console.log('📂 載入特定版本:', saveId);
        
        const loadData = {
            type: 'load_code',
            roomId: this.currentRoom,
            saveId: saveId
        };

        this.sendLoadRequest(loadData);
    }

    // 發送載入請求
    sendLoadRequest(loadData) {
        console.log('📤 發送載入請求:', loadData);

        if (window.wsManager && window.wsManager.isConnected()) {
            window.wsManager.sendMessage(loadData);
            
            // 關閉載入對話框
            const loadModal = document.getElementById('loadCodeModal');
            if (loadModal) {
                const modal = bootstrap.Modal.getInstance(loadModal);
            if (modal) modal.hide();
            }
            
            this.showMessage('載入請求已發送...', 'info');
        } else {
            this.showMessage('WebSocket 連接未建立，無法載入', 'error');
        }
    }

    // 預覽程式碼
    previewCode(saveId) {
        console.log('👁️ 預覽程式碼:', saveId);
        
        // 獲取歷史記錄找到對應項目
        this.requestHistory((history) => {
            const item = history.find(h => h.id === saveId);
            if (item) {
                this.showCodePreview(item);
            } else {
                this.showMessage('找不到對應的程式碼版本', 'error');
            }
        });
    }

    // 顯示程式碼預覽
    showCodePreview(item) {
        const modalHTML = `
            <div class="modal fade" id="codePreviewModal" tabindex="-1" aria-labelledby="codePreviewModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-light">
                            <h5 class="modal-title" id="codePreviewModalLabel">
                                <i class="fas fa-eye"></i> 程式碼預覽
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <h6>${this.escapeHtml(item.title)}</h6>
                                <small class="text-muted">
                                    <i class="fas fa-user"></i> ${this.escapeHtml(item.author)}
                                    <i class="fas fa-clock ms-2"></i> ${new Date(item.timestamp).toLocaleString()}
                                    <i class="fas fa-code-branch ms-2"></i> 版本 ${item.version}
                                </small>
                            </div>
                            <div class="border rounded">
                                <pre class="p-3 mb-0" style="max-height: 400px; overflow-y: auto; background-color: #f8f9fa; font-size: 0.9em;"><code class="language-python">${this.escapeHtml(item.code)}</code></pre>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">關閉</button>
                            <button type="button" class="btn btn-primary" onclick="globalLoadSpecificCode('${item.id}')">
                                <i class="fas fa-download"></i> 載入此版本
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除舊的模態框
        const existingModal = document.getElementById('codePreviewModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新的模態框
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 顯示模態框
        const modal = new bootstrap.Modal(document.getElementById('codePreviewModal'));
        modal.show();
    }

    // 顯示歷史記錄對話框
    showHistoryDialog() {
        console.log("📜 顯示歷史記錄對話框");
        if (!this.checkInitialized()) {
            this.showMessage("未加入房間，無法顯示歷史記錄。", "error");
            return;
        }
        this.requestHistory((history) => {
            this.displayHistoryDialog(history);
        });
    }

    // 顯示歷史記錄界面
    displayHistoryDialog(history) {
        const stats = this.calculateStats(history);
        
        let historyHTML = '';
        if (history.length === 0) {
            historyHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-archive text-muted" style="font-size: 2rem;"></i>
                    <p class="text-muted mt-2">尚無歷史記錄</p>
                </div>
            `;
        } else {
            historyHTML = history.map((item, index) => `
                <div class="card mb-2">
                    <div class="card-body py-2">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center">
                                    <span class="badge bg-primary me-2">#${history.length - index}</span>
                                    <h6 class="mb-1">${this.escapeHtml(item.title)}</h6>
                                </div>
                                <small class="text-muted">
                                    <i class="fas fa-user"></i> ${this.escapeHtml(item.author)}
                                    <i class="fas fa-clock ms-2"></i> ${new Date(item.timestamp).toLocaleString()}
                                    <i class="fas fa-code-branch ms-2"></i> v${item.version}
                                </small>
                            </div>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary" 
                                        onclick="globalLoadSpecificCode('${item.id}')"
                                        title="載入">
                                    <i class="fas fa-download"></i>
                                </button>
                                <button class="btn btn-outline-info"
                                        onclick="globalPreviewCode('${item.id}')"
                                        title="預覽">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        const modalHTML = `
            <div class="modal fade" id="historyModal" tabindex="-1" aria-labelledby="historyModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title" id="historyModalLabel">
                                <i class="fas fa-history"></i> 程式碼歷史記錄
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <!-- 統計信息 -->
                            <div class="row mb-3">
                                <div class="col-md-4">
                                    <div class="card bg-light">
                                        <div class="card-body text-center py-2">
                                            <h5 class="text-primary mb-1">${stats.total}</h5>
                                            <small class="text-muted">總保存次數</small>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card bg-light">
                                        <div class="card-body text-center py-2">
                                            <h5 class="text-success mb-1">${stats.authors}</h5>
                                            <small class="text-muted">參與人數</small>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card bg-light">
                                        <div class="card-body text-center py-2">
                                            <h5 class="text-info mb-1">${stats.latest}</h5>
                                            <small class="text-muted">最新版本</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 歷史記錄列表 -->
                            <div style="max-height: 400px; overflow-y: auto;">
                                ${historyHTML}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">關閉</button>
                            ${history.length > 0 ? `
                                <button type="button" class="btn btn-success" onclick="globalLoadLatestCode()">
                                    <i class="fas fa-star"></i> 載入最新版本
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除舊的模態框
        const existingModal = document.getElementById('historyModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新的模態框
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 顯示模態框
        const modal = new bootstrap.Modal(document.getElementById('historyModal'));
        modal.show();
    }

    // 請求歷史記錄
    requestHistory(callback) {
        const requestData = {
            type: 'get_history',
            roomId: this.currentRoom
        };

        console.log('📚 請求歷史記錄:', requestData);

        // 設置回調函數
        this.requestedHistoryCallback = callback;

        if (window.wsManager && window.wsManager.isConnected()) {
            window.wsManager.sendMessage(requestData);
        } else {
            this.showMessage('WebSocket 連接未建立，無法獲取歷史記錄', 'error');
            callback([]);
        }
    }

    // 處理WebSocket消息
    handleMessage(message) {
        console.log('📧 SaveLoadManager 收到消息:', message.type);

        switch (message.type) {
            case 'save_code_success':
                this.handleSaveSuccess(message);
                break;
            case 'save_code_error':
                this.handleSaveError(message);
                break;
            case 'load_code_success':
                this.handleLoadSuccess(message);
                break;
            case 'load_code_error':
                this.handleLoadError(message);
                break;
            case 'history_data':
                this.handleHistoryData(message);
                break;
            case 'user_saved_code':
                this.handleCodeSavedNotification(message);
                break;
            case 'code_loaded_notification':
                this.handleCodeLoadedNotification(message);
                break;
            default:
                console.log('❓ SaveLoadManager 忽略未知消息類型:', message.type);
        }
    }

    // 處理保存成功
    handleSaveSuccess(message) {
        console.log('✅ 程式碼保存成功:', message);
        this.showMessage(message.message || `程式碼已成功保存 (版本 ${message.version || '未知'})`, 'success');
        if (this.modal) this.modal.hide();
    }

    // 處理保存錯誤
    handleSaveError(message) {
        console.error('❌ 程式碼保存失敗:', message);
        this.showMessage(message.error || '保存程式碼時發生錯誤。', 'error');
    }

    // 處理載入成功
    handleLoadSuccess(message) {
        console.log('✅ 程式碼載入成功:', message);
        
        if (message.code && window.Editor) {
            // 將載入的代碼設置到編輯器
            Editor.setCode(message.code);
            
            const successMsg = message.message || `成功載入代碼 "${message.title}" (版本 ${message.version})`;
            this.showMessage(successMsg, 'success');
            
            console.log(`✅ 已將代碼載入到編輯器: ${message.title}`);
        } else {
            this.showMessage('載入的代碼內容為空或編輯器未準備好', 'warning');
        }
    }

    // 處理載入錯誤
    handleLoadError(message) {
        console.log('❌ 程式碼載入失敗:', message);
        const errorMsg = message.message || message.error || '載入代碼時發生錯誤';
        this.showMessage(errorMsg, 'error');
    }

    // 處理歷史數據
    handleHistoryData(message) {
        console.log('📜 收到歷史記錄:', message);
        if (this.requestedHistoryCallback) {
            this.requestedHistoryCallback(message.history || []);
            this.requestedHistoryCallback = null; // Reset callback
        } else {
            this.showMessage("收到歷史數據，但沒有設定回調。", "warning");
        }
    }

    // 處理程式碼保存通知
    handleCodeSavedNotification(message) {
        console.log('🔔 其他用戶保存了代碼:', message);
        const notificationMessage = `${message.userName || message.author || '某位用戶'} 保存了代碼版本 "${message.title || '未命名版本'}"`;
        this.showMessage(notificationMessage, 'info');
    }

    // 處理程式碼載入通知
    handleCodeLoadedNotification(message) {
        console.log('🔔 其他用戶載入了代碼:', message);
        const notificationMessage = `${message.userName || message.author || '某位用戶'} 載入了代碼版本 "${message.title || '未命名版本'}"`;
        this.showMessage(notificationMessage, 'info');
    }

    // 計算統計信息
    calculateStats(history) {
        const authors = new Set(history.map(item => item.author));
        const latestVersion = Math.max(...history.map(item => item.version), 0);
        
        return {
            total: history.length,
            authors: authors.size,
            latest: latestVersion
        };
    }

    // HTML 轉義
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 🆕 調試方法：查看所有用戶的槽位數據
    debugViewAllUserSlots() {
        console.log('🔍 調試：查看所有用戶槽位數據');
        const allKeys = Object.keys(localStorage).filter(key => key.startsWith('userCodeSlots_'));
        
        if (allKeys.length === 0) {
            console.log('📭 沒有找到任何用戶槽位數據');
            return;
        }
        
        allKeys.forEach(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                const [prefix, userName, roomId] = key.split('_');
                console.log(`👤 用戶: ${userName}, 房間: ${roomId}`, data);
            } catch (error) {
                console.error(`❌ 解析槽位數據失敗: ${key}`, error);
            }
        });
        
        return allKeys;
    }

    // 🆕 調試方法：清理指定用戶的槽位數據
    debugClearUserSlots(userName, roomId = null) {
        const pattern = roomId ? `userCodeSlots_${userName}_${roomId}` : `userCodeSlots_${userName}_`;
        const keys = Object.keys(localStorage).filter(key => key.includes(pattern));
        
        if (keys.length === 0) {
            console.log(`📭 沒有找到用戶 ${userName} 的槽位數據`);
            return false;
        }
        
        keys.forEach(key => {
            localStorage.removeItem(key);
            console.log(`🗑️ 已清理槽位數據: ${key}`);
        });
        
        console.log(`✅ 已清理用戶 ${userName} 的 ${keys.length} 個槽位數據記錄`);
        return true;
    }

    // 🆕 調試方法：獲取當前用戶狀態
    debugGetCurrentUser() {
        return {
            currentUser: this.currentUser,
            roomId: this.currentRoom,
            isInitialized: this.isInitialized,
            userSlots: this.userSlots,
            storageKey: this.getUserStorageKey()
        };
    }
}

// 創建全域實例
window.SaveLoadManager = new SaveLoadManager();

// 調試：確保方法正確暴露
console.log('✅ SaveLoadManager 模組載入完成'); 
console.log('🔍 SaveLoadManager 方法檢查:', {
    executeSave: typeof window.SaveLoadManager.executeSave,
    executeSlotSave: typeof window.SaveLoadManager.executeSlotSave,
    saveCode: typeof window.SaveLoadManager.saveCode,
    saveToSlot: typeof window.SaveLoadManager.saveToSlot
});

// 為了確保在模態框中能正確調用，添加全域函數包裝器
window.globalExecuteSave = function() {
    console.log('🔍 globalExecuteSave 被調用');
    if (window.SaveLoadManager && typeof window.SaveLoadManager.executeSave === 'function') {
        window.SaveLoadManager.executeSave();
    } else {
        console.error('❌ SaveLoadManager.executeSave 不可用');
        alert('保存功能暫時不可用，請重新載入頁面');
    }
};

window.globalExecuteSlotSave = function(slotNumber, isOverwrite = false) {
    console.log('🔍 globalExecuteSlotSave 被調用:', slotNumber, isOverwrite);
    if (window.SaveLoadManager && typeof window.SaveLoadManager.executeSlotSave === 'function') {
        window.SaveLoadManager.executeSlotSave(slotNumber, isOverwrite);
    } else {
        console.error('❌ SaveLoadManager.executeSlotSave 不可用');
        alert('槽位保存功能暫時不可用，請重新載入頁面');
    }
};

window.globalExecuteSlotLoad = function(slotNumber) {
    console.log('🔍 globalExecuteSlotLoad 被調用:', slotNumber);
    if (window.SaveLoadManager && typeof window.SaveLoadManager.globalExecuteSlotLoad === 'function') {
        window.SaveLoadManager.globalExecuteSlotLoad(slotNumber);
    } else {
        console.error('❌ SaveLoadManager.globalExecuteSlotLoad 不可用');
        alert('槽位載入功能暫時不可用，請重新載入頁面');
    }
};

window.globalLoadSpecificCode = function(saveId) {
    console.log('🔍 globalLoadSpecificCode 被調用:', saveId);
    if (window.SaveLoadManager && typeof window.SaveLoadManager.loadSpecificCode === 'function') {
        window.SaveLoadManager.loadSpecificCode(saveId);
    } else {
        console.error('❌ SaveLoadManager.loadSpecificCode 不可用');
        alert('代碼載入功能暫時不可用，請重新載入頁面');
    }
};

window.globalPreviewCode = function(saveId) {
    console.log('🔍 globalPreviewCode 被調用:', saveId);
    if (window.SaveLoadManager && typeof window.SaveLoadManager.previewCode === 'function') {
        window.SaveLoadManager.previewCode(saveId);
    } else {
        console.error('❌ SaveLoadManager.previewCode 不可用');
        alert('代碼預覽功能暫時不可用，請重新載入頁面');
    }
};

window.globalLoadLatestCode = function() {
    console.log('🔍 globalLoadLatestCode 被調用');
    if (window.SaveLoadManager && typeof window.SaveLoadManager.loadLatestCode === 'function') {
        window.SaveLoadManager.loadLatestCode();
    } else {
        console.error('❌ SaveLoadManager.loadLatestCode 不可用');
        alert('載入最新代碼功能暫時不可用，請重新載入頁面');
    }
};

// 🆕 全域調試函數
window.debugViewAllUserSlots = function() {
    if (window.SaveLoadManager && typeof window.SaveLoadManager.debugViewAllUserSlots === 'function') {
        return window.SaveLoadManager.debugViewAllUserSlots();
    } else {
        console.error('❌ 調試功能不可用');
        return null;
    }
};

window.debugClearUserSlots = function(userName, roomId = null) {
    if (window.SaveLoadManager && typeof window.SaveLoadManager.debugClearUserSlots === 'function') {
        return window.SaveLoadManager.debugClearUserSlots(userName, roomId);
    } else {
        console.error('❌ 調試功能不可用');
        return false;
    }
};

window.debugGetCurrentUser = function() {
    if (window.SaveLoadManager && typeof window.SaveLoadManager.debugGetCurrentUser === 'function') {
        return window.SaveLoadManager.debugGetCurrentUser();
    } else {
        console.error('❌ 調試功能不可用');
        return null;
    }
}; 