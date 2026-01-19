// Background Service Worker for Stealth Auto Refresh Pro

// Global state
let refreshState = {
    isRunning: false,
    currentTabId: null,
    minTime: 30,
    maxTime: 120,
    targetUrl: '',
    nextRefreshTime: null,
    timerId: null,
    stealthMode: true,
    behaviorPattern: 'normal',
    stats: {
        refreshCount: 0,
        timeSaved: 0,
        stealthCount: 0,
        startTime: null
    }
};

// Load saved state from storage
async function loadState() {
    try {
        const result = await chrome.storage.local.get([
            'isRunning', 'currentTabId', 'minTime', 'maxTime', 
            'targetUrl', 'nextRefreshTime', 'stealthMode', 
            'behaviorPattern', 'stats'
        ]);
        
        if (result.isRunning) {
            refreshState = {
                isRunning: result.isRunning,
                currentTabId: result.currentTabId,
                minTime: result.minTime || 30,
                maxTime: result.maxTime || 120,
                targetUrl: result.targetUrl || '',
                nextRefreshTime: result.nextRefreshTime || null,
                timerId: null,
                stealthMode: result.stealthMode !== false,
                behaviorPattern: result.behaviorPattern || 'normal',
                stats: result.stats || {
                    refreshCount: 0,
                    timeSaved: 0,
                    stealthCount: 0,
                    startTime: null
                }
            };
            
            // If we have a next refresh time, restart the timer
            if (refreshState.nextRefreshTime && refreshState.currentTabId) {
                const timeLeft = refreshState.nextRefreshTime - Date.now();
                if (timeLeft > 0) {
                    scheduleNextRefresh(timeLeft);
                } else {
                    refreshTab(refreshState.currentTabId);
                }
            }
            
            // Update stats
            updateTimeSaved();
        }
    } catch (error) {
        console.error('Error loading state:', error);
    }
}

// Save state to storage
async function saveState() {
    try {
        await chrome.storage.local.set({
            isRunning: refreshState.isRunning,
            currentTabId: refreshState.currentTabId,
            minTime: refreshState.minTime,
            maxTime: refreshState.maxTime,
            targetUrl: refreshState.targetUrl,
            nextRefreshTime: refreshState.nextRefreshTime,
            stealthMode: refreshState.stealthMode,
            behaviorPattern: refreshState.behaviorPattern,
            stats: refreshState.stats
        });
        
        // Notify popup about stats update
        chrome.runtime.sendMessage({
            action: 'statsUpdate',
            stats: refreshState.stats
        }).catch(() => {});
    } catch (error) {
        console.error('Error saving state:', error);
    }
}

// Generate HUMAN-LIKE random time (not uniform distribution)
function generateHumanLikeTime(min, max, pattern = 'normal') {
    let randomSeconds;
    const range = max - min;
    
    switch(pattern) {
        case 'patient':
            // Bell curve - most times around 70% of range
            const mean = min + (range * 0.7);
            const stdDev = range * 0.15;
            randomSeconds = Math.floor(gaussianRandom(mean, stdDev));
            break;
            
        case 'impatient':
            // Exponential - shorter times more frequent
            const lambda = 1.5;
            randomSeconds = Math.floor(min + exponentialRandom(lambda) * range);
            break;
            
        case 'random':
            // True random with no pattern
            randomSeconds = Math.floor(min + Math.random() * range);
            break;
            
        case 'normal':
        default:
            // Slight bias toward middle (like real humans)
            const middle = min + (range / 2);
            const bias = (Math.random() * 0.3) + 0.85; // 0.85 to 1.15 bias
            randomSeconds = Math.floor(middle * bias);
    }
    
    // Clamp to min-max
    randomSeconds = Math.max(min, Math.min(max, randomSeconds));
    
    // Add jitter (±5 seconds) to break exact patterns
    const jitter = (Math.random() * 10) - 5; // -5 to +5 seconds
    randomSeconds += jitter;
    
    return Math.max(5, Math.floor(randomSeconds)); // Minimum 5 seconds
}

// Gaussian distribution for "patient" pattern
function gaussianRandom(mean, stdDev) {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdDev + mean;
}

// Exponential distribution for "impatient" pattern
function exponentialRandom(lambda) {
    return -Math.log(1.0 - Math.random()) / lambda;
}

// Schedule next refresh with human-like timing
function scheduleNextRefresh(timeUntilRefresh = null) {
    // Clear any existing timer
    if (refreshState.timerId) {
        clearTimeout(refreshState.timerId);
        refreshState.timerId = null;
    }
    
    // Generate human-like time if not provided
    if (timeUntilRefresh === null) {
        const randomSeconds = generateHumanLikeTime(
            refreshState.minTime, 
            refreshState.maxTime, 
            refreshState.behaviorPattern
        );
        timeUntilRefresh = randomSeconds * 1000;
        
        console.log(`⏱️ Next refresh in: ${randomSeconds} seconds (${refreshState.behaviorPattern} pattern)`);
    }
    
    // Calculate next refresh time
    refreshState.nextRefreshTime = Date.now() + timeUntilRefresh;
    
    // Schedule the refresh
    refreshState.timerId = setTimeout(() => {
        refreshTab(refreshState.currentTabId);
    }, timeUntilRefresh);
    
    // Save state and notify
    saveState();
    notifyCountdownUpdate();
}

// Refresh the specified tab with stealth behavior
async function refreshTab(tabId) {
    if (!tabId) return;
    
    try {
        const tab = await chrome.tabs.get(tabId);
        
        // Skip chrome:// pages
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            console.log('⏭️ Skipping refresh on Chrome internal page');
            scheduleNextRefresh();
            return;
        }
        
        // Check target URL if specified
        if (refreshState.targetUrl && tab.url) {
            try {
                const targetUrl = new URL(refreshState.targetUrl);
                const currentUrl = new URL(tab.url);
                
                // Check if hostname matches
                if (targetUrl.hostname !== currentUrl.hostname) {
                    console.log('⏭️ Skipping refresh - URL mismatch');
                    scheduleNextRefresh();
                    return;
                }
            } catch (e) {
                console.warn('⚠️ URL parsing error:', e);
            }
        }
        
        // If stealth mode is ON, simulate human behavior before refresh
        if (refreshState.stealthMode) {
            try {
                console.log('🎭 Simulating human behavior before refresh...');
                await chrome.tabs.sendMessage(tabId, {
                    action: 'simulateHumanBehavior',
                    beforeRefresh: true
                });
                
                // Wait for human behavior simulation (random 1-3 seconds)
                const waitTime = 1000 + Math.random() * 2000;
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
                // Increment stealth count
                refreshState.stats.stealthCount++;
                
            } catch (error) {
                console.log('⚠️ Could not simulate human behavior:', error.message);
            }
        }
        
        // Refresh the tab
        console.log('🔄 Refreshing tab:', tab.url.substring(0, 50));
        await chrome.tabs.reload(tabId);
        
        // Update stats
        refreshState.stats.refreshCount++;
        updateTimeSaved();
        await saveState();
        
        // Schedule next refresh with NEW human-like timing
        scheduleNextRefresh();
        
    } catch (error) {
        console.error('❌ Error refreshing tab:', error);
        
        // If tab doesn't exist or was closed, stop auto-refresh
        if (error.message.includes('No tab with id') || error.message.includes('tab was closed')) {
            console.log('🛑 Tab was closed, stopping auto-refresh');
            stopAutoRefresh();
        } else {
            // Try again in 30 seconds
            setTimeout(() => scheduleNextRefresh(), 30000);
        }
    }
}

// Update time saved in stats
function updateTimeSaved() {
    if (!refreshState.stats.startTime) {
        refreshState.stats.startTime = Date.now();
    }
    
    // Estimate time saved: 5 seconds per manual refresh × refresh count
    const estimatedSecondsSaved = refreshState.stats.refreshCount * 5;
    refreshState.stats.timeSaved = estimatedSecondsSaved / 3600; // Convert to hours
}

// Start auto refresh
function startAutoRefresh(tabId, minTime, maxTime, targetUrl, showTimer, timerPosition, stealthMode, behaviorPattern) {
    console.log('🚀 Starting auto refresh with settings:', {
        minTime, maxTime, targetUrl, stealthMode, behaviorPattern
    });
    
    refreshState = {
        isRunning: true,
        currentTabId: tabId,
        minTime: minTime,
        maxTime: maxTime,
        targetUrl: targetUrl || '',
        nextRefreshTime: null,
        timerId: null,
        stealthMode: stealthMode !== false,
        behaviorPattern: behaviorPattern || 'normal',
        stats: {
            refreshCount: 0,
            timeSaved: 0,
            stealthCount: 0,
            startTime: Date.now()
        }
    };
    
    // Schedule first refresh
    scheduleNextRefresh();
    
    // Notify content script to show timer
    chrome.tabs.sendMessage(tabId, {
        action: 'startTimer',
        minTime: minTime,
        maxTime: maxTime,
        nextRefreshTime: refreshState.nextRefreshTime,
        showTimer: showTimer !== false,
        timerPosition: timerPosition || 'top-right',
        stealthMode: refreshState.stealthMode,
        behaviorPattern: refreshState.behaviorPattern
    }).catch(async () => {
        // Content script might not be loaded, inject it
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
            
            await chrome.scripting.insertCSS({
                target: { tabId: tabId },
                files: ['content.css']
            });
            
            // Try sending message again
            setTimeout(() => {
                chrome.tabs.sendMessage(tabId, {
                    action: 'startTimer',
                    minTime: minTime,
                    maxTime: maxTime,
                    nextRefreshTime: refreshState.nextRefreshTime,
                    showTimer: showTimer,
                    timerPosition: timerPosition,
                    stealthMode: refreshState.stealthMode,
                    behaviorPattern: refreshState.behaviorPattern
                }).catch(console.error);
            }, 500);
        } catch (error) {
            console.error('❌ Error injecting content script:', error);
        }
    });
    
    saveState();
}

// Stop auto refresh
function stopAutoRefresh() {
    console.log('🛑 Stopping auto refresh');
    
    // Clear timer
    if (refreshState.timerId) {
        clearTimeout(refreshState.timerId);
    }
    
    // Reset state
    refreshState = {
        isRunning: false,
        currentTabId: null,
        minTime: 30,
        maxTime: 120,
        targetUrl: '',
        nextRefreshTime: null,
        timerId: null,
        stealthMode: true,
        behaviorPattern: 'normal',
        stats: {
            refreshCount: refreshState.stats.refreshCount || 0,
            timeSaved: refreshState.stats.timeSaved || 0,
            stealthCount: refreshState.stats.stealthCount || 0,
            startTime: null
        }
    };
    
    // Save state
    saveState();
    
    // Notify all tabs to hide timer
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { 
                action: 'stopTimer' 
            }).catch(() => {
                // Ignore errors (content script might not be loaded)
            });
        });
    });
    
    // Notify popup
    chrome.runtime.sendMessage({
        action: 'statusUpdate',
        isRunning: false
    }).catch(() => {});
}

// Notify about countdown update
function notifyCountdownUpdate() {
    // Update popup if open
    chrome.runtime.sendMessage({
        action: 'updateCountdown',
        nextRefreshTime: refreshState.nextRefreshTime,
        isRunning: refreshState.isRunning
    }).catch(() => {
        // Popup might not be open, ignore error
    });
    
    // Update content script in active tab
    if (refreshState.currentTabId) {
        chrome.tabs.sendMessage(refreshState.currentTabId, {
            action: 'updateCountdown',
            nextRefreshTime: refreshState.nextRefreshTime
        }).catch(() => {
            // Content script might not be loaded, ignore error
        });
    }
}

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'start':
            startAutoRefresh(
                message.tabId,
                message.minTime,
                message.maxTime,
                message.targetUrl,
                message.showTimer,
                message.timerPosition,
                message.stealthMode,
                message.behaviorPattern
            );
            sendResponse({ success: true });
            break;
            
        case 'stop':
            stopAutoRefresh();
            sendResponse({ success: true });
            break;
            
        case 'updatePattern':
            refreshState.behaviorPattern = message.behaviorPattern || 'normal';
            if (refreshState.isRunning && refreshState.timerId) {
                // Reschedule with new pattern
                clearTimeout(refreshState.timerId);
                scheduleNextRefresh();
            }
            sendResponse({ success: true });
            break;
            
        case 'getCountdown':
            sendResponse({
                nextRefreshTime: refreshState.nextRefreshTime,
                isRunning: refreshState.isRunning
            });
            break;
            
        case 'getStats':
            sendResponse({
                stats: refreshState.stats
            });
            break;
            
        case 'simulateHumanBehavior':
            // This is handled by content script, but we log it
            console.log('🎭 Human behavior simulation requested');
            sendResponse({ success: true });
            break;
    }
    
    return true; // Keep message channel open for async response
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // If the tab being updated is our target tab and it's completed loading
    if (refreshState.isRunning && 
        tabId === refreshState.currentTabId && 
        changeInfo.status === 'complete') {
        
        console.log('📄 Tab loaded, restarting timer');
        
        // Notify content script to update timer
        setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
                action: 'startTimer',
                minTime: refreshState.minTime,
                maxTime: refreshState.maxTime,
                nextRefreshTime: refreshState.nextRefreshTime,
                stealthMode: refreshState.stealthMode,
                behaviorPattern: refreshState.behaviorPattern
            }).catch(() => {
                // Content script might not be loaded, ignore
            });
        }, 500);
    }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (refreshState.isRunning && tabId === refreshState.currentTabId) {
        console.log('🗑️ Target tab was closed, stopping auto-refresh');
        stopAutoRefresh();
    }
});

// Initialize when service worker starts
loadState();