/**
 * IndexTTS Frontend Application
 * 現代化 TTS 語音合成前端
 */

class IndexTTSApp {
    constructor() {
        // 自動偵測 API 網址
        // 優先使用 /api 代理路徑（Docker 部署時）
        // 如果不是從標準端口訪問，則使用同主機的 8001 端口
        let defaultApiUrl;
        if (window.location.port === '80' || window.location.port === '443' || window.location.port === '' || window.location.port === '3003') {
            // 使用 nginx 代理
            defaultApiUrl = `${window.location.origin}/api`;
        } else {
            // 開發模式 - 直接連接 API 端口
            defaultApiUrl = `${window.location.protocol}//${window.location.hostname}:8001`;
        }
        
        // 檢查儲存的 API URL 是否包含 localhost，如果當前不是從 localhost 訪問則重置
        let savedApiUrl = localStorage.getItem('apiUrl');
        if (savedApiUrl && savedApiUrl.includes('localhost') && window.location.hostname !== 'localhost') {
            savedApiUrl = null; // 重置為預設值
            localStorage.removeItem('apiUrl');
        }
        
        // Configuration
        this.config = {
            apiUrl: savedApiUrl || defaultApiUrl,
            autoPlay: localStorage.getItem('autoPlay') !== 'false',
            saveHistory: localStorage.getItem('saveHistory') !== 'false',
            darkMode: localStorage.getItem('darkMode') === 'true'
        };

        // State
        this.selectedVoice = null;
        this.currentAudio = null;
        this.cloneAudio = null;
        this.uploadedFile = null;
        this.history = [];
        this.loadingTimer = null;
        
        // Audio Context for waveform visualization
        this.audioContext = null;
        this.analyser = null;
        this.cloneAnalyser = null;
        
        // IndexedDB for audio storage
        this.db = null;

        // Initialize
        this.init();
    }

    async init() {
        await this.initDB();
        await this.loadHistory();
        this.bindElements();
        this.bindEvents();
        this.loadVoices();
        this.checkHealth();
        this.renderHistory();
        this.applyTheme();
        this.loadSettings();
    }

    // IndexedDB initialization
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('IndexTTSDB', 1);
            
            request.onerror = () => {
                console.error('Failed to open IndexedDB');
                resolve(); // Continue without DB
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('audioHistory')) {
                    const store = db.createObjectStore('audioHistory', { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    // Load history from IndexedDB
    async loadHistory() {
        if (!this.db) {
            this.history = [];
            return;
        }

        return new Promise((resolve) => {
            const transaction = this.db.transaction(['audioHistory'], 'readonly');
            const store = transaction.objectStore('audioHistory');
            const request = store.getAll();
            
            request.onsuccess = () => {
                this.history = request.result.sort((a, b) => 
                    new Date(b.timestamp) - new Date(a.timestamp)
                );
                resolve();
            };
            
            request.onerror = () => {
                this.history = [];
                resolve();
            };
        });
    }

    // Save audio to IndexedDB
    async saveAudioToDB(item) {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['audioHistory'], 'readwrite');
            const store = transaction.objectStore('audioHistory');
            const request = store.put(item);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Delete audio from IndexedDB
    async deleteAudioFromDB(id) {
        if (!this.db) return;

        return new Promise((resolve) => {
            const transaction = this.db.transaction(['audioHistory'], 'readwrite');
            const store = transaction.objectStore('audioHistory');
            store.delete(id);
            transaction.oncomplete = () => resolve();
        });
    }

    // Clear all audio from IndexedDB
    async clearAllAudioFromDB() {
        if (!this.db) return;

        return new Promise((resolve) => {
            const transaction = this.db.transaction(['audioHistory'], 'readwrite');
            const store = transaction.objectStore('audioHistory');
            store.clear();
            transaction.oncomplete = () => resolve();
        });
    }

    bindElements() {
        // Navigation
        this.navItems = document.querySelectorAll('.nav-item');
        this.tabContents = document.querySelectorAll('.tab-content');

        // TTS Page
        this.textInput = document.getElementById('textInput');
        this.charCount = document.getElementById('charCount');
        this.voiceGrid = document.getElementById('voiceGrid');
        this.generateBtn = document.getElementById('generateBtn');
        this.playerContainer = document.getElementById('playerContainer');
        this.audioPlayer = document.getElementById('audioPlayer');
        this.playBtn = document.getElementById('playBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.waveformContainer = document.getElementById('waveformContainer');
        this.waveformProgress = document.getElementById('waveformProgress');
        this.waveformCursor = document.getElementById('waveformCursor');
        this.currentTimeEl = document.getElementById('currentTime');
        this.durationEl = document.getElementById('duration');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingTime = document.getElementById('loadingTime');

        // Clone Page
        this.uploadZone = document.getElementById('uploadZone');
        this.audioUpload = document.getElementById('audioUpload');
        this.fileNameEl = document.getElementById('fileName');
        this.removeFileBtn = document.getElementById('removeFile');
        this.uploadedFile = null;
        
        // Preview Player
        this.previewPlayerContainer = document.getElementById('previewPlayerContainer');
        this.previewWaveformContainer = document.getElementById('previewWaveformContainer');
        this.previewWaveformProgress = document.getElementById('previewWaveformProgress');
        this.previewWaveformCursor = document.getElementById('previewWaveformCursor');
        this.previewPlayBtn = document.getElementById('previewPlayBtn');
        this.previewCurrentTimeEl = document.getElementById('previewCurrentTime');
        this.previewDurationEl = document.getElementById('previewDuration');
        this.previewAudio = null;
        
        this.cloneTextInput = document.getElementById('cloneTextInput');
        this.cloneCharCount = document.getElementById('cloneCharCount');
        this.cloneGenerateBtn = document.getElementById('cloneGenerateBtn');
        this.seedInput = document.getElementById('seedInput');
        this.randomSeedBtn = document.getElementById('randomSeedBtn');
        this.clonePlayerContainer = document.getElementById('clonePlayerContainer');
        this.cloneAudioPlayer = document.getElementById('cloneAudioPlayer');
        this.clonePlayBtn = document.getElementById('clonePlayBtn');
        this.cloneDownloadBtn = document.getElementById('cloneDownloadBtn');
        this.cloneWaveformContainer = document.getElementById('cloneWaveformContainer');
        this.cloneWaveformProgress = document.getElementById('cloneWaveformProgress');
        this.cloneWaveformCursor = document.getElementById('cloneWaveformCursor');
        this.cloneCurrentTimeEl = document.getElementById('cloneCurrentTime');
        this.cloneDurationEl = document.getElementById('cloneDuration');
        this.cloneLoadingOverlay = document.getElementById('cloneLoadingOverlay');
        this.cloneLoadingTime = document.getElementById('cloneLoadingTime');

        // History Page
        this.historyList = document.getElementById('historyList');
        this.emptyHistory = document.getElementById('emptyHistory');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        
        // History Player
        this.historyPlayerCard = document.getElementById('historyPlayerCard');
        this.historyPlayerTitle = document.getElementById('historyPlayerTitle');
        this.historyPlayerText = document.getElementById('historyPlayerText');
        this.closeHistoryPlayer = document.getElementById('closeHistoryPlayer');
        this.historyWaveformContainer = document.getElementById('historyWaveformContainer');
        this.historyWaveformProgress = document.getElementById('historyWaveformProgress');
        this.historyWaveformCursor = document.getElementById('historyWaveformCursor');
        this.historyPlayBtn = document.getElementById('historyPlayBtn');
        this.historyCurrentTimeEl = document.getElementById('historyCurrentTime');
        this.historyDurationEl = document.getElementById('historyDuration');
        this.historyDownloadBtn = document.getElementById('historyDownloadBtn');
        this.historyAudio = null;
        this.currentHistoryId = null;

        // Settings Page
        this.apiUrlInput = document.getElementById('apiUrl');
        this.testConnectionBtn = document.getElementById('testConnection');
        this.darkModeToggle = document.getElementById('darkModeToggle');
        this.autoPlayToggle = document.getElementById('autoPlayToggle');
        this.saveHistoryToggle = document.getElementById('saveHistoryToggle');

        // Status
        this.serverStatus = document.getElementById('serverStatus');

        // Toast
        this.toastContainer = document.getElementById('toastContainer');
    }

    bindEvents() {
        // Navigation
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(item.dataset.tab);
            });
        });

        // Text input character count
        this.textInput.addEventListener('input', () => {
            this.charCount.textContent = this.textInput.value.length;
        });

        this.cloneTextInput.addEventListener('input', () => {
            this.cloneCharCount.textContent = this.cloneTextInput.value.length;
        });

        // Generate button
        this.generateBtn.addEventListener('click', () => this.generateTTS());
        this.cloneGenerateBtn.addEventListener('click', () => this.generateCloneTTS());
        
        // Random seed button
        if (this.randomSeedBtn) {
            this.randomSeedBtn.addEventListener('click', () => {
                if (this.seedInput) {
                    const newSeed = Math.floor(Math.random() * 1000000);
                    this.seedInput.value = newSeed;
                    console.log('Generated random seed:', newSeed);
                } else {
                    console.error('seedInput element not found');
                }
            });
        } else {
            console.error('randomSeedBtn element not found');
        }

        // Player controls
        this.playBtn.addEventListener('click', () => this.togglePlay(this.currentAudio, this.playBtn));
        this.clonePlayBtn.addEventListener('click', () => this.togglePlay(this.cloneAudio, this.clonePlayBtn));

        this.downloadBtn.addEventListener('click', () => this.downloadAudio(this.currentAudio, 'tts-output.wav'));
        this.cloneDownloadBtn.addEventListener('click', () => this.downloadAudio(this.cloneAudio, 'clone-output.wav'));

        // Waveform click to seek
        this.waveformContainer.addEventListener('click', (e) => this.seekAudioWaveform(e, this.currentAudio, this.waveformContainer));
        this.cloneWaveformContainer.addEventListener('click', (e) => this.seekAudioWaveform(e, this.cloneAudio, this.cloneWaveformContainer));

        // Upload zone
        this.uploadZone.addEventListener('click', () => this.audioUpload.click());
        this.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadZone.classList.add('dragover');
        });
        this.uploadZone.addEventListener('dragleave', () => {
            this.uploadZone.classList.remove('dragover');
        });
        this.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('audio/')) {
                this.handleFileUpload(file);
            }
        });
        this.audioUpload.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.handleFileUpload(e.target.files[0]);
            }
        });
        this.removeFileBtn.addEventListener('click', () => this.removeUploadedFile());
        
        // Preview Player
        this.previewPlayBtn.addEventListener('click', () => this.togglePreviewPlay());
        this.previewWaveformContainer.addEventListener('click', (e) => this.seekPreviewAudio(e));

        // History
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        
        // History Player
        this.closeHistoryPlayer.addEventListener('click', () => this.closeHistoryPlayerCard());
        this.historyPlayBtn.addEventListener('click', () => this.toggleHistoryPlay());
        this.historyWaveformContainer.addEventListener('click', (e) => this.seekHistoryAudio(e));
        this.historyDownloadBtn.addEventListener('click', () => this.downloadHistoryAudio());

        // Settings
        this.apiUrlInput.addEventListener('change', () => {
            this.config.apiUrl = this.apiUrlInput.value;
            localStorage.setItem('apiUrl', this.config.apiUrl);
            this.checkHealth();
        });

        this.testConnectionBtn.addEventListener('click', () => this.testConnection());

        this.darkModeToggle.addEventListener('click', () => {
            this.config.darkMode = !this.config.darkMode;
            localStorage.setItem('darkMode', this.config.darkMode);
            this.applyTheme();
            this.updateToggle(this.darkModeToggle, this.config.darkMode);
        });

        this.autoPlayToggle.addEventListener('click', () => {
            this.config.autoPlay = !this.config.autoPlay;
            localStorage.setItem('autoPlay', this.config.autoPlay);
            this.updateToggle(this.autoPlayToggle, this.config.autoPlay);
        });

        this.saveHistoryToggle.addEventListener('click', () => {
            this.config.saveHistory = !this.config.saveHistory;
            localStorage.setItem('saveHistory', this.config.saveHistory);
            this.updateToggle(this.saveHistoryToggle, this.config.saveHistory);
        });
    }

    switchTab(tabName) {
        this.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tabName);
        });

        this.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
    }

    async loadVoices() {
        try {
            const response = await fetch(`${this.config.apiUrl}/audio/voices`);
            if (!response.ok) throw new Error('Failed to load voices');

            const voices = await response.json();
            this.renderVoices(voices);
        } catch (error) {
            console.error('Error loading voices:', error);
            this.voiceGrid.innerHTML = `
                <div class="voice-option" data-voice="default">
                    <div class="voice-avatar">預</div>
                    <span class="voice-name">預設聲音</span>
                </div>
            `;
            this.selectVoice('default');
        }
    }

    renderVoices(voices) {
        const voiceNames = Object.keys(voices);

        if (voiceNames.length === 0) {
            this.voiceGrid.innerHTML = '<p style="color: var(--color-text-tertiary);">尚無可用的聲音</p>';
            return;
        }

        this.voiceGrid.innerHTML = voiceNames.map(name => {
            const displayName = this.formatVoiceName(name);
            const initial = displayName.charAt(0).toUpperCase();
            return `
                <div class="voice-option" data-voice="${name}">
                    <div class="voice-avatar">${initial}</div>
                    <span class="voice-name">${displayName}</span>
                </div>
            `;
        }).join('');

        // Bind click events
        this.voiceGrid.querySelectorAll('.voice-option').forEach(option => {
            option.addEventListener('click', () => {
                this.selectVoice(option.dataset.voice);
            });
        });

        // Select first voice by default
        if (voiceNames.length > 0) {
            this.selectVoice(voiceNames[0]);
        }
    }

    formatVoiceName(name) {
        return name
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    selectVoice(voiceName) {
        this.selectedVoice = voiceName;

        this.voiceGrid.querySelectorAll('.voice-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.voice === voiceName);
        });
    }

    async generateTTS() {
        const text = this.textInput.value.trim();

        if (!text) {
            this.showToast('error', '錯誤', '請輸入要轉換的文字');
            return;
        }

        // Check text length (limit to 500 characters)
        if (text.length > 500) {
            this.showToast('error', '文字過長', '請將文字控制在 500 字以內');
            return;
        }

        if (!this.selectedVoice) {
            this.showToast('error', '錯誤', '請選擇一個聲音');
            return;
        }

        this.showLoading(this.loadingOverlay, this.loadingTime);
        this.generateBtn.disabled = true;

        try {
            const response = await fetch(`${this.config.apiUrl}/tts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    character: this.selectedVoice
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'TTS 生成失敗');
            }

            const audioBlob = await response.blob();
            this.handleAudioResult(audioBlob, text, this.selectedVoice);

        } catch (error) {
            console.error('TTS Error:', error);
            this.showToast('error', '生成失敗', error.message);
        } finally {
            this.hideLoading(this.loadingOverlay);
            this.generateBtn.disabled = false;
        }
    }

    async generateCloneTTS() {
        const text = this.cloneTextInput.value.trim();

        if (!text) {
            this.showToast('error', '錯誤', '請輸入要轉換的文字');
            return;
        }

        // Check text length (limit to 500 characters)
        if (text.length > 500) {
            this.showToast('error', '文字過長', '請將文字控制在 500 字以內');
            return;
        }

        if (!this.uploadedFile) {
            this.showToast('error', '錯誤', '請上傳參考音檔');
            return;
        }

        this.showLoading(this.cloneLoadingOverlay, this.cloneLoadingTime);
        this.cloneGenerateBtn.disabled = true;

        try {
            const formData = new FormData();
            formData.append('audio_file', this.uploadedFile);

            // 取得 seed：手動輸入或隨機生成
            let seed;
            if (this.seedInput && this.seedInput.value.trim() !== '') {
                seed = parseInt(this.seedInput.value);
                console.log('Using manual seed:', seed);
                // 確保 seed 在有效範圍內
                if (isNaN(seed) || seed < 0 || seed > 999999) {
                    seed = Math.floor(Math.random() * 1000000);
                    console.log('Seed out of range, using random:', seed);
                    this.showToast('warning', '提示', 'Seed 超出範圍，已使用隨機值');
                }
            } else {
                // 生成隨機 seed (0-999999)
                seed = Math.floor(Math.random() * 1000000);
                console.log('No seed input, using random:', seed);
            }
            this.currentSeed = seed;
            console.log('Final seed being sent to backend:', seed);

            // text 和 seed 作為 query 參數傳遞
            const url = new URL(`${this.config.apiUrl}/tts_upload`);
            url.searchParams.append('text', text);
            url.searchParams.append('seed', seed.toString());

            const response = await fetch(url.toString(), {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'TTS 生成失敗');
            }

            const audioBlob = await response.blob();
            this.handleCloneAudioResult(audioBlob, text);

        } catch (error) {
            console.error('Clone TTS Error:', error);
            this.showToast('error', '生成失敗', error.message);
        } finally {
            this.hideLoading(this.cloneLoadingOverlay);
            this.cloneGenerateBtn.disabled = false;
        }
    }

    handleAudioResult(audioBlob, text, voice) {
        const audioUrl = URL.createObjectURL(audioBlob);

        // Create audio element
        this.currentAudio = new Audio(audioUrl);
        
        // Setup waveform visualization with progress overlay
        this.setupWaveform(audioBlob, 'waveform', 'waveformProgress');
        
        this.currentAudio.addEventListener('loadedmetadata', () => {
            this.durationEl.textContent = this.formatTime(this.currentAudio.duration);
        });
        this.currentAudio.addEventListener('timeupdate', () => {
            this.currentTimeEl.textContent = this.formatTime(this.currentAudio.currentTime);
            const progress = (this.currentAudio.currentTime / this.currentAudio.duration) * 100;
            this.waveformProgress.style.width = `${progress}%`;
            this.waveformCursor.style.left = `${progress}%`;
        });
        this.currentAudio.addEventListener('ended', () => {
            this.playBtn.querySelector('.play-icon').classList.remove('hidden');
            this.playBtn.querySelector('.pause-icon').classList.add('hidden');
        });

        // Show player
        this.playerContainer.querySelector('.player-placeholder').classList.add('hidden');
        this.audioPlayer.classList.remove('hidden');

        // Auto play
        if (this.config.autoPlay) {
            this.currentAudio.play();
            this.playBtn.querySelector('.play-icon').classList.add('hidden');
            this.playBtn.querySelector('.pause-icon').classList.remove('hidden');
        }

        // Save to history
        if (this.config.saveHistory) {
            this.addToHistory({
                id: Date.now(),
                text: text,
                voice: voice,
                audioUrl: audioUrl,
                audioBlob: audioBlob,
                timestamp: new Date().toISOString()
            });
        }

        this.showToast('success', '生成成功', '語音已成功生成');
    }

    handleCloneAudioResult(audioBlob, text) {
        const audioUrl = URL.createObjectURL(audioBlob);

        // 顯示當前使用的 seed
        const cloneSeedValue = this.clonePlayerContainer.querySelector('#cloneSeedValue');
        if (cloneSeedValue && this.currentSeed !== undefined) {
            cloneSeedValue.textContent = this.currentSeed;
        }

        // Create audio element
        this.cloneAudio = new Audio(audioUrl);
        
        // Setup waveform visualization with progress overlay
        this.setupWaveform(audioBlob, 'cloneWaveform', 'cloneWaveformProgress');
        
        this.cloneAudio.addEventListener('loadedmetadata', () => {
            this.cloneDurationEl.textContent = this.formatTime(this.cloneAudio.duration);
        });
        this.cloneAudio.addEventListener('timeupdate', () => {
            this.cloneCurrentTimeEl.textContent = this.formatTime(this.cloneAudio.currentTime);
            const progress = (this.cloneAudio.currentTime / this.cloneAudio.duration) * 100;
            this.cloneWaveformProgress.style.width = `${progress}%`;
            this.cloneWaveformCursor.style.left = `${progress}%`;
        });
        this.cloneAudio.addEventListener('ended', () => {
            this.clonePlayBtn.querySelector('.play-icon').classList.remove('hidden');
            this.clonePlayBtn.querySelector('.pause-icon').classList.add('hidden');
        });

        // Show player
        document.getElementById('clonePlayerContainer').querySelector('.player-placeholder').classList.add('hidden');
        this.cloneAudioPlayer.classList.remove('hidden');

        // Auto play
        if (this.config.autoPlay) {
            this.cloneAudio.play();
            this.clonePlayBtn.querySelector('.play-icon').classList.add('hidden');
            this.clonePlayBtn.querySelector('.pause-icon').classList.remove('hidden');
        }

        // Save to history
        if (this.config.saveHistory) {
            this.addToHistory({
                id: Date.now(),
                text: text,
                voice: '克隆聲音',
                audioUrl: audioUrl,
                audioBlob: audioBlob,
                timestamp: new Date().toISOString()
            });
        }

        this.showToast('success', '生成成功', '克隆語音已成功生成');
    }

    togglePlay(audio, btn) {
        if (!audio) return;

        if (audio.paused) {
            audio.play();
            btn.querySelector('.play-icon').classList.add('hidden');
            btn.querySelector('.pause-icon').classList.remove('hidden');
        } else {
            audio.pause();
            btn.querySelector('.play-icon').classList.remove('hidden');
            btn.querySelector('.pause-icon').classList.add('hidden');
        }
    }

    downloadAudio(audio, filename) {
        if (!audio) return;

        const a = document.createElement('a');
        a.href = audio.src;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async handleFileUpload(file) {
        // Check file size (limit to 500MB)
        const maxSize = 500 * 1024 * 1024; // 500MB
        if (file.size > maxSize) {
            this.showToast('error', '檔案過大', '音檔檔案大小不能超過 500MB');
            return;
        }

        // Check audio duration (limit to 120 seconds)
        try {
            const audioUrl = URL.createObjectURL(file);
            const audio = new Audio(audioUrl);
            
            await new Promise((resolve, reject) => {
                audio.addEventListener('loadedmetadata', () => {
                    URL.revokeObjectURL(audioUrl);
                    if (audio.duration > 120) {
                        reject(new Error('參考音檔請使用 120 秒以內的清晰語音'));
                    } else if (audio.duration < 2) {
                        reject(new Error('參考音檔太短，至少需要 2 秒'));
                    } else {
                        resolve();
                    }
                });
                audio.addEventListener('error', () => {
                    URL.revokeObjectURL(audioUrl);
                    reject(new Error('無法讀取音檔檔案'));
                });
            });
        } catch (error) {
            this.showToast('error', '音檔錯誤', error.message);
            return;
        }

        this.uploadedFile = file;
        this.fileNameEl.textContent = file.name;
        this.uploadZone.classList.add('hidden');
        this.previewPlayerContainer.classList.remove('hidden');
        
        // Convert file to blob for waveform
        const audioBlob = new Blob([await file.arrayBuffer()], { type: file.type });
        const audioUrl = URL.createObjectURL(audioBlob);
        this.previewAudio = new Audio(audioUrl);
        
        // Setup waveform visualization
        this.setupWaveform(audioBlob, 'previewWaveform', 'previewWaveformProgress');
        
        // Setup audio event listeners
        this.previewAudio.addEventListener('loadedmetadata', () => {
            this.previewDurationEl.textContent = this.formatTime(this.previewAudio.duration);
        });
        
        this.previewAudio.addEventListener('timeupdate', () => {
            this.previewCurrentTimeEl.textContent = this.formatTime(this.previewAudio.currentTime);
            const progress = (this.previewAudio.currentTime / this.previewAudio.duration) * 100;
            this.previewWaveformProgress.style.width = `${progress}%`;
            this.previewWaveformCursor.style.left = `${progress}%`;
        });
        
        this.previewAudio.addEventListener('ended', () => {
            const playIcon = this.previewPlayBtn.querySelector('.play-icon');
            const pauseIcon = this.previewPlayBtn.querySelector('.pause-icon');
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
        });
        
        this.showToast('success', '上傳成功', '音檔已準備好');
    }

    removeUploadedFile() {
        // Stop and clean up preview audio
        if (this.previewAudio) {
            this.previewAudio.pause();
            this.previewAudio = null;
        }
        
        this.uploadedFile = null;
        this.audioUpload.value = '';
        this.uploadZone.classList.remove('hidden');
        this.previewPlayerContainer.classList.add('hidden');
    }

    togglePreviewPlay() {
        if (!this.previewAudio) return;
        
        if (this.previewAudio.paused) {
            this.previewAudio.play();
            this.previewPlayBtn.querySelector('.play-icon').classList.add('hidden');
            this.previewPlayBtn.querySelector('.pause-icon').classList.remove('hidden');
        } else {
            this.previewAudio.pause();
            this.previewPlayBtn.querySelector('.play-icon').classList.remove('hidden');
            this.previewPlayBtn.querySelector('.pause-icon').classList.add('hidden');
        }
    }

    seekPreviewAudio(e) {
        if (!this.previewAudio || !this.previewAudio.duration) return;
        
        const rect = this.previewWaveformContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        
        this.previewAudio.currentTime = percentage * this.previewAudio.duration;
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Waveform Visualization
    async setupWaveform(audioBlob, canvasId, progressId) {
        try {
            // Create AudioContext if not exists
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Decode audio data
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            // Get waveform data
            const channelData = audioBuffer.getChannelData(0);
            
            // Draw background waveform (dimmed)
            this.drawWaveform(channelData, canvasId, false);
            
            // Draw progress waveform (bright, inside progress container)
            if (progressId) {
                this.drawWaveform(channelData, progressId, true);
            }
        } catch (error) {
            console.error('Error setting up waveform:', error);
        }
    }

    drawWaveform(channelData, containerId, isProgress = false) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // For progress container, create a wrapper div
        let drawContainer;
        if (isProgress) {
            container.innerHTML = '';
            drawContainer = document.createElement('div');
            drawContainer.className = 'waveform-played';
            drawContainer.style.position = 'absolute';
            drawContainer.style.top = '0';
            drawContainer.style.left = '0';
            drawContainer.style.width = container.parentElement.offsetWidth + 'px';
            drawContainer.style.height = '100%';
            container.appendChild(drawContainer);
        } else {
            container.innerHTML = '';
            drawContainer = container;
        }

        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size - use parent container width for progress
        const parentContainer = isProgress ? container.parentElement : container;
        const rect = parentContainer.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.scale(dpr, dpr);

        drawContainer.appendChild(canvas);

        const width = rect.width;
        const height = rect.height;
        const centerY = height / 2;

        // Get theme colors - brighter for progress
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        let primaryColor, secondaryColor;
        
        if (isProgress) {
            primaryColor = '#6366f1';
            secondaryColor = '#a855f7';
        } else {
            primaryColor = isDark ? 'rgba(129, 140, 248, 0.35)' : 'rgba(99, 102, 241, 0.3)';
            secondaryColor = isDark ? 'rgba(79, 70, 229, 0.35)' : 'rgba(168, 85, 247, 0.3)';
        }

        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, primaryColor);
        gradient.addColorStop(1, secondaryColor);

        ctx.fillStyle = gradient;
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;

        // Draw bars style waveform
        const barWidth = 3;
        const barGap = 2;
        const barCount = Math.floor(width / (barWidth + barGap));
        const samplesPerBar = Math.floor(channelData.length / barCount);

        for (let i = 0; i < barCount; i++) {
            let sum = 0;
            const startSample = i * samplesPerBar;
            const endSample = Math.min(startSample + samplesPerBar, channelData.length);
            
            // Calculate RMS for this segment
            for (let j = startSample; j < endSample; j++) {
                sum += channelData[j] * channelData[j];
            }
            const rms = Math.sqrt(sum / (endSample - startSample));
            
            // Scale the height (larger multiplier = bigger waveform)
            const barHeight = Math.max(4, rms * height * 6.0);
            
            const x = i * (barWidth + barGap);
            const y = centerY - barHeight / 2;

            // Draw rounded bar
            this.roundRect(ctx, x, y, barWidth, barHeight, 1.5);
        }
    }

    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }

    seekAudioWaveform(e, audio, container) {
        if (!audio) return;

        const rect = container.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        audio.currentTime = pos * audio.duration;
    }

    showLoading(overlay, timeEl) {
        overlay.classList.remove('hidden');
        let startTime = Date.now();
        this.loadingTimer = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            timeEl.textContent = `${elapsed.toFixed(1)} 秒`;
        }, 100);
    }

    hideLoading(overlay) {
        overlay.classList.add('hidden');
        if (this.loadingTimer) {
            clearInterval(this.loadingTimer);
            this.loadingTimer = null;
        }
    }

    // History Management
    async addToHistory(item) {
        // Convert Blob to ArrayBuffer for storage
        if (item.audioBlob) {
            item.audioData = await item.audioBlob.arrayBuffer();
            delete item.audioBlob;
            delete item.audioUrl; // We'll recreate this when playing
        }
        
        this.history.unshift(item);
        if (this.history.length > 50) {
            const removed = this.history.pop();
            await this.deleteAudioFromDB(removed.id);
        }
        
        // Save to IndexedDB
        await this.saveAudioToDB(item);
        this.renderHistory();
    }

    saveHistory() {
        // No longer using localStorage for history
        // All data is in IndexedDB now
    }

    renderHistory() {
        if (!this.historyList || !this.emptyHistory) return;
        
        if (this.history.length === 0) {
            this.historyList.classList.add('hidden');
            this.emptyHistory.classList.remove('hidden');
            return;
        }

        this.historyList.classList.remove('hidden');
        this.emptyHistory.classList.add('hidden');

        this.historyList.innerHTML = this.history.map(item => {
            const date = new Date(item.timestamp);
            const formattedDate = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

            return `
                <div class="history-item" data-id="${item.id}">
                    <button class="history-play" data-id="${item.id}">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                    </button>
                    <div class="history-info">
                        <div class="history-text">${this.escapeHtml(item.text)}</div>
                        <div class="history-meta">
                            <span>聲音: ${item.voice}</span>
                            <span>${formattedDate}</span>
                        </div>
                    </div>
                    <div class="history-actions-item">
                        <button class="history-download" data-id="${item.id}" title="下載">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" x2="12" y1="15" y2="3"/>
                            </svg>
                        </button>
                        <button class="history-delete" data-id="${item.id}" title="刪除">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Bind events
        this.historyList.querySelectorAll('.history-play').forEach(btn => {
            btn.addEventListener('click', () => this.playHistoryItem(parseInt(btn.dataset.id)));
        });

        this.historyList.querySelectorAll('.history-download').forEach(btn => {
            btn.addEventListener('click', () => this.downloadHistoryItem(parseInt(btn.dataset.id)));
        });

        this.historyList.querySelectorAll('.history-delete').forEach(btn => {
            btn.addEventListener('click', () => this.deleteHistoryItem(parseInt(btn.dataset.id)));
        });
    }

    playHistoryItem(id) {
        const item = this.history.find(h => h.id === id);
        if (!item || !item.audioData) {
            this.showToast('warning', '無法播放', '此歷史記錄的音檔已失效，請重新生成');
            return;
        }

        // Stop current history audio if playing
        if (this.historyAudio) {
            this.historyAudio.pause();
            this.historyAudio = null;
        }

        // Remove playing class from all history items
        this.historyList.querySelectorAll('.history-item').forEach(el => {
            el.classList.remove('playing');
        });

        // Add playing class to current item
        const historyItem = this.historyList.querySelector(`.history-item[data-id="${id}"]`);
        if (historyItem) {
            historyItem.classList.add('playing');
        }

        // Create audio from stored data
        const blob = new Blob([item.audioData], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        this.historyAudio = new Audio(url);
        this.currentHistoryId = id;
        this.currentHistoryBlob = blob;

        // Setup history player UI
        this.historyPlayerTitle.textContent = item.voice || '語音複製';
        this.historyPlayerText.textContent = item.text;
        
        // Setup waveform for history player
        this.setupHistoryWaveform(item.audioData);

        // Show player card
        this.historyPlayerCard.classList.add('show');

        // Bind audio events
        this.historyAudio.addEventListener('loadedmetadata', () => {
            this.historyDurationEl.textContent = this.formatTime(this.historyAudio.duration);
        });

        this.historyAudio.addEventListener('timeupdate', () => {
            this.historyCurrentTimeEl.textContent = this.formatTime(this.historyAudio.currentTime);
            if (this.historyAudio.duration) {
                const progress = (this.historyAudio.currentTime / this.historyAudio.duration) * 100;
                this.historyWaveformProgress.style.width = `${progress}%`;
                this.historyWaveformCursor.style.left = `${progress}%`;
            }
        });

        this.historyAudio.addEventListener('ended', () => {
            this.updateHistoryPlayButton(false);
            this.historyWaveformProgress.style.width = '0%';
            this.historyWaveformCursor.style.left = '0%';
            URL.revokeObjectURL(url);
            
            // Remove playing class
            if (historyItem) {
                historyItem.classList.remove('playing');
            }
        });

        this.historyAudio.addEventListener('play', () => {
            this.updateHistoryPlayButton(true);
        });

        this.historyAudio.addEventListener('pause', () => {
            this.updateHistoryPlayButton(false);
        });

        // Auto play
        this.historyAudio.play();
    }

    updateHistoryPlayButton(isPlaying) {
        const playIcon = this.historyPlayBtn.querySelector('.play-icon');
        const pauseIcon = this.historyPlayBtn.querySelector('.pause-icon');
        if (playIcon && pauseIcon) {
            playIcon.classList.toggle('hidden', isPlaying);
            pauseIcon.classList.toggle('hidden', !isPlaying);
        }
    }

    async setupHistoryWaveform(audioData) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0));
            const channelData = audioBuffer.getChannelData(0);
            
            // Draw background waveform
            this.drawHistoryWaveform(channelData, 'historyWaveform', false);
            
            // Draw progress waveform
            this.drawHistoryWaveform(channelData, 'historyWaveformProgress', true);
            
            audioContext.close();
        } catch (error) {
            console.error('Error setting up history waveform:', error);
        }
    }

    drawHistoryWaveform(channelData, containerId, isProgress = false) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // For progress container, create a wrapper div
        let drawContainer;
        if (isProgress) {
            container.innerHTML = '';
            drawContainer = document.createElement('div');
            drawContainer.className = 'waveform-played';
            drawContainer.style.position = 'absolute';
            drawContainer.style.top = '0';
            drawContainer.style.left = '0';
            drawContainer.style.width = container.parentElement.offsetWidth + 'px';
            drawContainer.style.height = '100%';
            container.appendChild(drawContainer);
        } else {
            container.innerHTML = '';
            drawContainer = container;
        }

        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size - use parent container width for progress
        const parentContainer = isProgress ? container.parentElement : container;
        const rect = parentContainer.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.scale(dpr, dpr);

        drawContainer.appendChild(canvas);

        const width = rect.width;
        const height = rect.height;
        const centerY = height / 2;

        // Get theme colors - brighter for progress
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        let primaryColor, secondaryColor;
        
        if (isProgress) {
            primaryColor = '#6366f1';
            secondaryColor = '#a855f7';
        } else {
            primaryColor = isDark ? 'rgba(129, 140, 248, 0.35)' : 'rgba(99, 102, 241, 0.3)';
            secondaryColor = isDark ? 'rgba(79, 70, 229, 0.35)' : 'rgba(168, 85, 247, 0.3)';
        }

        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, primaryColor);
        gradient.addColorStop(1, secondaryColor);

        ctx.fillStyle = gradient;
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;

        // Draw bars style waveform
        const barWidth = 3;
        const barGap = 2;
        const barCount = Math.floor(width / (barWidth + barGap));
        const samplesPerBar = Math.floor(channelData.length / barCount);

        for (let i = 0; i < barCount; i++) {
            let sum = 0;
            const startSample = i * samplesPerBar;
            const endSample = Math.min(startSample + samplesPerBar, channelData.length);
            
            // Calculate RMS for this segment
            for (let j = startSample; j < endSample; j++) {
                sum += channelData[j] * channelData[j];
            }
            const rms = Math.sqrt(sum / (endSample - startSample));
            
            // Scale the height (larger multiplier = bigger waveform)
            const barHeight = Math.max(4, rms * height * 6.0);
            
            const x = i * (barWidth + barGap);
            const y = centerY - barHeight / 2;

            // Draw rounded bar
            this.roundRect(ctx, x, y, barWidth, barHeight, 1.5);
        }
    }

    toggleHistoryPlay() {
        if (!this.historyAudio) return;
        
        if (this.historyAudio.paused) {
            this.historyAudio.play();
        } else {
            this.historyAudio.pause();
        }
    }

    seekHistoryAudio(e) {
        if (!this.historyAudio || !this.historyAudio.duration) return;
        
        const rect = this.historyWaveformContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        
        this.historyAudio.currentTime = percentage * this.historyAudio.duration;
    }

    closeHistoryPlayerCard() {
        if (this.historyAudio) {
            this.historyAudio.pause();
            this.historyAudio = null;
        }
        
        this.historyPlayerCard.classList.remove('show');
        
        // Remove playing class from all history items
        this.historyList.querySelectorAll('.history-item').forEach(el => {
            el.classList.remove('playing');
        });
        
        this.currentHistoryId = null;
        this.currentHistoryBlob = null;
    }

    downloadHistoryAudio() {
        if (this.currentHistoryBlob) {
            const url = URL.createObjectURL(this.currentHistoryBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tts-${this.currentHistoryId}.wav`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    downloadHistoryItem(id) {
        const item = this.history.find(h => h.id === id);
        if (item && item.audioData) {
            const blob = new Blob([item.audioData], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tts-${id}.wav`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            this.showToast('warning', '無法下載', '此歷史記錄的音檔已失效');
        }
    }

    async deleteHistoryItem(id) {
        this.history = this.history.filter(h => h.id !== id);
        await this.deleteAudioFromDB(id);
        this.renderHistory();
    }

    async clearHistory() {
        if (confirm('確定要清除所有歷史記錄嗎？')) {
            this.history = [];
            await this.clearAllAudioFromDB();
            this.renderHistory();
            this.showToast('success', '已清除', '歷史記錄已清除');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Health Check
    async checkHealth() {
        const statusDot = this.serverStatus.querySelector('.status-dot');
        const statusText = this.serverStatus.querySelector('span');

        statusDot.className = 'status-dot checking';
        statusText.textContent = '檢查連線中...';

        try {
            const response = await fetch(`${this.config.apiUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                statusDot.className = 'status-dot online';
                statusText.textContent = '伺服器已連線';
            } else {
                throw new Error('Server not healthy');
            }
        } catch (error) {
            statusDot.className = 'status-dot offline';
            statusText.textContent = '連線失敗';
        }
    }

    async testConnection() {
        this.config.apiUrl = this.apiUrlInput.value;
        localStorage.setItem('apiUrl', this.config.apiUrl);

        await this.checkHealth();
        await this.loadVoices();

        const statusDot = this.serverStatus.querySelector('.status-dot');
        if (statusDot.classList.contains('online')) {
            this.showToast('success', '連線成功', 'API 伺服器已成功連線');
        } else {
            this.showToast('error', '連線失敗', '無法連線到 API 伺服器');
        }
    }

    // Settings
    loadSettings() {
        this.apiUrlInput.value = this.config.apiUrl;
        this.updateToggle(this.darkModeToggle, this.config.darkMode);
        this.updateToggle(this.autoPlayToggle, this.config.autoPlay);
        this.updateToggle(this.saveHistoryToggle, this.config.saveHistory);
    }

    updateToggle(toggle, active) {
        toggle.classList.toggle('active', active);
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.config.darkMode ? 'dark' : 'light');
    }

    // Toast Notifications
    showToast(type, title, message) {
        const icons = {
            success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>`,
            error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" x2="9" y1="9" y2="15"/>
                <line x1="9" x2="15" y1="9" y2="15"/>
            </svg>`,
            warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <line x1="12" x2="12" y1="9" y2="13"/>
                <line x1="12" x2="12.01" y1="17" y2="17"/>
            </svg>`
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" x2="6" y1="6" y2="18"/>
                    <line x1="6" x2="18" y1="6" y2="18"/>
                </svg>
            </button>
        `;

        this.toastContainer.appendChild(toast);

        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });

        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new IndexTTSApp();
});
