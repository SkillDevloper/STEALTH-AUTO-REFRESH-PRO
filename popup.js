document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const minTimeInput = document.getElementById('minTime');
    const maxTimeInput = document.getElementById('maxTime');
    const targetUrlInput = document.getElementById('targetUrl');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const refreshNowBtn = document.getElementById('refreshNowBtn');
    const testBtn = document.getElementById('testBtn');
    const statusText = document.getElementById('statusText');
    const nextRefreshTime = document.getElementById('nextRefreshTime');
    const currentTabUrl = document.getElementById('currentTabUrl');
    const stealthStatus = document.getElementById('stealthStatus');
    const displayToggle = document.getElementById('displayToggle');
    const stealthToggle = document.getElementById('stealthToggle');
    const behaviorPattern = document.getElementById('behaviorPattern');
    const positionBtn = document.getElementById('positionBtn');
    const positionMenu = document.getElementById('positionMenu');
    const refreshCount = document.getElementById('refreshCount');
    const timeSaved = document.getElementById('timeSaved');
    const stealthCount = document.getElementById('stealthCount');
    const minValue = document.getElementById('minValue');
    const maxValue = document.getElementById('maxValue');
    const themeButtons = document.querySelectorAll('.theme-btn');
    
    // State
    let isRunning = false;
    let settings = {
        minTime: 30,
        maxTime: 120,
        targetUrl: '',
        showTimer: true,
        timerPosition: 'top-right',
        stealthMode: true,
        behaviorPattern: 'normal',
        theme: 'default',
        stats: {
            refreshCount: 0,
            timeSaved: 0,
            stealthCount: 0
        }
    };
    
    // Initialize
    async function init() {
        await loadSettings();
        updateUI();
        setupEventListeners();
        startStatsUpdater();
    }
    
    // Load settings from storage
    async function loadSettings() {
        try {
            const result = await chrome.storage.local.get([
                'minTime', 'maxTime', 'targetUrl', 'isRunning', 
                'nextRefreshTime', 'showTimer', 'timerPosition',
                'stealthMode', 'behaviorPattern', 'theme', 'stats'
            ]);
            
            if (result.minTime !== undefined) settings.minTime = result.minTime;
            if (result.maxTime !== undefined) settings.maxTime = result.maxTime;
            if (result.targetUrl !== undefined) settings.targetUrl = result.targetUrl;
            if (result.showTimer !== undefined) settings.showTimer = result.showTimer;
            if (result.timerPosition !== undefined) settings.timerPosition = result.timerPosition;
            if (result.stealthMode !== undefined) settings.stealthMode = result.stealthMode;
            if (result.behaviorPattern !== undefined) settings.behaviorPattern = result.behaviorPattern;
            if (result.theme !== undefined) settings.theme = result.theme;
            if (result.stats !== undefined) settings.stats = result.stats;
            
            isRunning = result.isRunning || false;
            
            // Update inputs
            minTimeInput.value = settings.minTime;
            maxTimeInput.value = settings.maxTime;
            targetUrlInput.value = settings.targetUrl;
            behaviorPattern.value = settings.behaviorPattern;
            
            // Update UI elements
            updateRangeValues();
            updateDisplayToggle();
            updateStealthToggle();
            updateThemeButtons();
            updateStats();
            
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
    
    // Save settings to storage
    async function saveSettings() {
        try {
            await chrome.storage.local.set({
                minTime: parseInt(minTimeInput.value) || 30,
                maxTime: parseInt(maxTimeInput.value) || 120,
                targetUrl: targetUrlInput.value.trim(),
                showTimer: settings.showTimer,
                timerPosition: settings.timerPosition,
                stealthMode: settings.stealthMode,
                behaviorPattern: settings.behaviorPattern,
                theme: settings.theme,
                stats: settings.stats
            });
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }
    
    // Update UI
    function updateUI() {
        // Update buttons
        startBtn.disabled = isRunning;
        stopBtn.disabled = !isRunning;
        
        // Update status
        if (isRunning) {
            statusText.textContent = 'RUNNING';
            statusText.className = 'status-running';
        } else {
            statusText.textContent = 'STOPPED';
            statusText.className = 'status-stopped';
        }
        
        // Update stealth status
        if (settings.stealthMode) {
            stealthStatus.textContent = 'ACTIVE';
            stealthStatus.className = 'stealth-on';
        } else {
            stealthStatus.textContent = 'INACTIVE';
            stealthStatus.className = 'stealth-off';
        }
        
        // Update current tab info
        updateCurrentTabInfo();
        
        // Request countdown update
        chrome.runtime.sendMessage({ action: 'getCountdown' }).then(response => {
            if (response && response.nextRefreshTime) {
                updateCountdownDisplay(response.nextRefreshTime);
            }
        }).catch(() => {});
    }
    
    // Update current tab info
    async function updateCurrentTabInfo() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) {
                const url = new URL(tabs[0].url);
                currentTabUrl.textContent = `${url.hostname}${url.pathname.substring(0, 20)}${url.pathname.length > 20 ? '...' : ''}`;
            }
        } catch (error) {
            currentTabUrl.textContent = 'Cannot access tab';
        }
    }
    
    // Update range value displays
    function updateRangeValues() {
        minValue.textContent = `${minTimeInput.value}s`;
        maxValue.textContent = `${maxTimeInput.value}s`;
    }
    
    // Update display toggle
    function updateDisplayToggle() {
        if (settings.showTimer) {
            displayToggle.innerHTML = '<i class="fas fa-eye"></i> SHOW TIMER';
            displayToggle.classList.add('active');
        } else {
            displayToggle.innerHTML = '<i class="fas fa-eye-slash"></i> HIDE TIMER';
            displayToggle.classList.remove('active');
        }
    }
    
    // Update stealth toggle
    function updateStealthToggle() {
        if (settings.stealthMode) {
            stealthToggle.innerHTML = '<i class="fas fa-user-secret"></i> STEALTH ON';
            stealthToggle.classList.add('active');
        } else {
            stealthToggle.innerHTML = '<i class="fas fa-robot"></i> STEALTH OFF';
            stealthToggle.classList.remove('active');
        }
    }
    
    // Update theme buttons
    function updateThemeButtons() {
        themeButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === settings.theme) {
                btn.classList.add('active');
            }
        });
    }
    
    // Update stats display
    function updateStats() {
        refreshCount.textContent = settings.stats.refreshCount || 0;
        timeSaved.textContent = (settings.stats.timeSaved || 0).toFixed(1);
        stealthCount.textContent = settings.stats.stealthCount || 0;
    }
    
    // Update countdown display
    function updateCountdownDisplay(nextRefreshTime) {
        if (!nextRefreshTime) {
            nextRefreshTime.textContent = '--:--';
            return;
        }
        
        const update = () => {
            const now = Date.now();
            const timeLeft = Math.max(0, Math.floor((nextRefreshTime - now) / 1000));
            
            if (timeLeft <= 0) {
                nextRefreshTime.textContent = '00:00';
            } else {
                const minutes = Math.floor(timeLeft / 60);
                const seconds = timeLeft % 60;
                nextRefreshTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        };
        
        update();
        setInterval(update, 1000);
    }
    
    // Start auto refresh
    async function startAutoRefresh() {
        const minTime = parseInt(minTimeInput.value) || 30;
        const maxTime = parseInt(maxTimeInput.value) || 120;
        
        if (minTime >= maxTime) {
            alert('⚠️ Minimum time must be LESS than maximum time');
            return;
        }
        
        if (minTime < 5) {
            alert('⚠️ Minimum time must be at least 5 seconds');
            return;
        }
        
        // Save settings
        await saveSettings();
        
        // Get current active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
            alert('❌ No active tab found');
            return;
        }
        
        // Start the auto refresh
        try {
            await chrome.runtime.sendMessage({
                action: 'start',
                tabId: tabs[0].id,
                minTime: minTime,
                maxTime: maxTime,
                targetUrl: targetUrlInput.value.trim(),
                showTimer: settings.showTimer,
                timerPosition: settings.timerPosition,
                stealthMode: settings.stealthMode,
                behaviorPattern: settings.behaviorPattern
            });
            
            isRunning = true;
            await chrome.storage.local.set({ isRunning: true });
            updateUI();
            
        } catch (error) {
            console.error('Error starting auto refresh:', error);
            alert('❌ Failed to start auto refresh. Please try again.');
        }
    }
    
    // Stop auto refresh
    async function stopAutoRefresh() {
        try {
            await chrome.runtime.sendMessage({ action: 'stop' });
            
            isRunning = false;
            await chrome.storage.local.set({ isRunning: false });
            updateUI();
            
        } catch (error) {
            console.error('Error stopping auto refresh:', error);
        }
    }
    
    // Refresh now
    async function refreshNow() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) {
                await chrome.tabs.reload(tabs[0].id);
                // Increment refresh count
                settings.stats.refreshCount++;
                await saveSettings();
                updateStats();
            }
        } catch (error) {
            console.error('Error refreshing tab:', error);
        }
    }
    
    // Test stealth mode
    async function testStealthMode() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) {
                await chrome.tabs.sendMessage(tabs[0].id, { action: 'testStealth' });
                alert('🎭 Testing stealth mode... Check the webpage for human-like behavior simulation!');
            }
        } catch (error) {
            console.error('Error testing stealth:', error);
            alert('❌ Cannot test on this page. Try a regular website.');
        }
    }
    
    // Toggle timer display
    async function toggleDisplay() {
        settings.showTimer = !settings.showTimer;
        updateDisplayToggle();
        await saveSettings();
        
        // Send message to content script
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'toggleDisplay',
                showTimer: settings.showTimer
            }).catch(() => {});
        }
    }
    
    // Toggle stealth mode
    async function toggleStealthMode() {
        settings.stealthMode = !settings.stealthMode;
        updateStealthToggle();
        await saveSettings();
        updateUI();
    }
    
    // Change behavior pattern
    async function changeBehaviorPattern() {
        settings.behaviorPattern = behaviorPattern.value;
        await saveSettings();
        
        // If currently running, update pattern
        if (isRunning) {
            chrome.runtime.sendMessage({
                action: 'updatePattern',
                behaviorPattern: settings.behaviorPattern
            }).catch(() => {});
        }
    }
    
    // Change timer position
    async function changeTimerPosition(position) {
        settings.timerPosition = position;
        await saveSettings();
        
        // Send message to content script
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'changePosition',
                position: position
            }).catch(() => {});
        }
        
        hidePositionMenu();
    }
    
    // Change theme
    async function changeTheme(theme) {
        settings.theme = theme;
        updateThemeButtons();
        await saveSettings();
        
        // Send message to content script
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'changeTheme',
                theme: theme
            }).catch(() => {});
        }
    }
    
    // Show position menu
    function showPositionMenu() {
        const rect = positionBtn.getBoundingClientRect();
        positionMenu.style.top = `${rect.bottom + 5}px`;
        positionMenu.style.left = `${rect.left}px`;
        positionMenu.classList.remove('hidden');
    }
    
    // Hide position menu
    function hidePositionMenu() {
        positionMenu.classList.add('hidden');
    }
    
    // Setup event listeners
    function setupEventListeners() {
        // Button events
        startBtn.addEventListener('click', startAutoRefresh);
        stopBtn.addEventListener('click', stopAutoRefresh);
        refreshNowBtn.addEventListener('click', refreshNow);
        testBtn.addEventListener('click', testStealthMode);
        displayToggle.addEventListener('click', toggleDisplay);
        stealthToggle.addEventListener('click', toggleStealthMode);
        behaviorPattern.addEventListener('change', changeBehaviorPattern);
        positionBtn.addEventListener('click', showPositionMenu);
        
        // Range input events
        minTimeInput.addEventListener('input', () => {
            updateRangeValues();
            saveSettings();
        });
        
        maxTimeInput.addEventListener('input', () => {
            updateRangeValues();
            saveSettings();
        });
        
        // Target URL input
        let saveTimeout;
        targetUrlInput.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveSettings, 1000);
        });
        
        // Position menu events
        document.querySelectorAll('.position-option').forEach(option => {
            option.addEventListener('click', () => {
                changeTimerPosition(option.dataset.position);
            });
        });
        
        // Theme buttons
        themeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                changeTheme(btn.dataset.theme);
            });
        });
        
        // Close position menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!positionBtn.contains(e.target) && !positionMenu.contains(e.target)) {
                hidePositionMenu();
            }
        });
        
        // Listen for updates from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'updateCountdown') {
                updateCountdownDisplay(message.nextRefreshTime);
            } else if (message.action === 'statusUpdate') {
                isRunning = message.isRunning;
                updateUI();
            } else if (message.action === 'statsUpdate') {
                if (message.stats) {
                    settings.stats = message.stats;
                    updateStats();
                }
            }
        });
    }
    
    // Start stats updater
    function startStatsUpdater() {
        // Request initial stats
        chrome.runtime.sendMessage({ action: 'getStats' }).then(response => {
            if (response && response.stats) {
                settings.stats = response.stats;
                updateStats();
            }
        }).catch(() => {});
        
        // Update stats every 10 seconds
        setInterval(async () => {
            const response = await chrome.runtime.sendMessage({ action: 'getStats' }).catch(() => null);
            if (response && response.stats) {
                settings.stats = response.stats;
                updateStats();
            }
        }, 10000);
    }
    
    // Start countdown updater
    function startCountdownUpdater() {
        setInterval(() => {
            if (isRunning) {
                chrome.runtime.sendMessage({ action: 'getCountdown' }).then(response => {
                    if (response && response.nextRefreshTime) {
                        updateCountdownDisplay(response.nextRefreshTime);
                    }
                }).catch(() => {});
            }
        }, 1000);
    }
    
    // Initialize the extension
    init();
    startCountdownUpdater();
});