// Content Script - On-screen timer and stealth behavior

class StealthAutoRefresh {
    constructor() {
        this.state = {
            isRunning: false,
            nextRefreshTime: null,
            countdownInterval: null,
            showTimer: true,
            timerPosition: 'top-right',
            stealthMode: true,
            behaviorPattern: 'normal',
            theme: 'default'
        };
        
        this.elements = {
            timerContainer: null,
            timerDisplay: null,
            statusDisplay: null,
            stealthIndicator: null
        };
        
        this.init();
    }
    
    async init() {
        // Load settings
        await this.loadSettings();
        
        // Set up message listener
        this.setupMessageListener();
        
        // Check if auto-refresh is running for this tab
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getCountdown' });
            if (response && response.isRunning) {
                this.state.isRunning = true;
                this.state.nextRefreshTime = response.nextRefreshTime;
                
                if (this.state.showTimer) {
                    this.createTimerDisplay();
                    this.startCountdown();
                }
            }
        } catch (error) {
            console.log('⚠️ Could not get countdown status:', error.message);
        }
        
        // Make timer draggable if it exists
        this.makeTimerDraggable();
    }
    
    async loadSettings() {
        try {
            const result = await chrome.storage.local.get([
                'showTimer', 'timerPosition', 'stealthMode', 
                'behaviorPattern', 'theme'
            ]);
            
            this.state.showTimer = result.showTimer !== false;
            this.state.timerPosition = result.timerPosition || 'top-right';
            this.state.stealthMode = result.stealthMode !== false;
            this.state.behaviorPattern = result.behaviorPattern || 'normal';
            this.state.theme = result.theme || 'default';
            
        } catch (error) {
            console.error('❌ Error loading settings:', error);
        }
    }
    
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case 'startTimer':
                    this.handleStartTimer(message);
                    sendResponse({ success: true });
                    break;
                    
                case 'stopTimer':
                    this.handleStopTimer();
                    sendResponse({ success: true });
                    break;
                    
                case 'updateCountdown':
                    this.state.nextRefreshTime = message.nextRefreshTime;
                    this.updateCountdown();
                    sendResponse({ success: true });
                    break;
                    
                case 'toggleDisplay':
                    this.toggleDisplay(message.showTimer);
                    sendResponse({ success: true });
                    break;
                    
                case 'changePosition':
                    this.changePosition(message.position);
                    sendResponse({ success: true });
                    break;
                    
                case 'changeTheme':
                    this.changeTheme(message.theme);
                    sendResponse({ success: true });
                    break;
                    
                case 'simulateHumanBehavior':
                    this.simulateHumanBehavior(message.beforeRefresh);
                    sendResponse({ success: true });
                    break;
                    
                case 'testStealth':
                    this.testStealth();
                    sendResponse({ success: true });
                    break;
            }
            return true;
        });
    }
    
    handleStartTimer(message) {
        this.state.isRunning = true;
        this.state.nextRefreshTime = message.nextRefreshTime;
        this.state.showTimer = message.showTimer !== false;
        this.state.timerPosition = message.timerPosition || 'top-right';
        this.state.stealthMode = message.stealthMode !== false;
        this.state.behaviorPattern = message.behaviorPattern || 'normal';
        
        if (this.state.showTimer) {
            this.createTimerDisplay();
            this.startCountdown();
        }
    }
    
    handleStopTimer() {
        this.stopCountdown();
        if (this.elements.timerContainer) {
            this.elements.timerContainer.remove();
            this.elements.timerContainer = null;
        }
        this.state.isRunning = false;
        this.state.nextRefreshTime = null;
    }
    
    createTimerDisplay() {
        // Remove existing timer if present
        if (this.elements.timerContainer) {
            this.elements.timerContainer.remove();
        }
        
        // Create container
        this.elements.timerContainer = document.createElement('div');
        this.elements.timerContainer.id = 'stealth-auto-refresh-timer';
        this.elements.timerContainer.className = `stealth-timer ${this.state.theme} ${this.state.timerPosition}`;
        
        // Create header
        const header = document.createElement('div');
        header.className = 'timer-header';
        header.innerHTML = '<i class="timer-icon">🕐</i> <span class="timer-title">Stealth Refresh</span>';
        
        // Create timer display
        this.elements.timerDisplay = document.createElement('div');
        this.elements.timerDisplay.className = 'timer-display';
        this.elements.timerDisplay.innerHTML = `
            <span class="time-label">Next refresh:</span>
            <span class="time-value">--:--</span>
        `;
        
        // Create status display
        this.elements.statusDisplay = document.createElement('div');
        this.elements.statusDisplay.className = 'timer-status';
        this.elements.statusDisplay.innerHTML = `
            <span class="status-dot"></span>
            <span class="status-text">STOPPED</span>
        `;
        
        // Create stealth indicator
        if (this.state.stealthMode) {
            this.elements.stealthIndicator = document.createElement('div');
            this.elements.stealthIndicator.className = 'stealth-indicator';
            this.elements.stealthIndicator.innerHTML = `
                <i class="stealth-icon">🕵️</i>
                <span class="stealth-text">STEALTH MODE</span>
            `;
            this.elements.stealthIndicator.title = 'Human-like behavior simulation active';
        }
        
        // Create controls
        const controls = document.createElement('div');
        controls.className = 'timer-controls';
        controls.innerHTML = `
            <button class="control-btn minimize" title="Minimize">−</button>
            <button class="control-btn close" title="Close">×</button>
        `;
        
        // Assemble container
        this.elements.timerContainer.appendChild(header);
        this.elements.timerContainer.appendChild(this.elements.timerDisplay);
        this.elements.timerContainer.appendChild(this.elements.statusDisplay);
        if (this.elements.stealthIndicator) {
            this.elements.timerContainer.appendChild(this.elements.stealthIndicator);
        }
        this.elements.timerContainer.appendChild(controls);
        
        // Add to page
        document.body.appendChild(this.elements.timerContainer);
        
        // Set up control buttons
        this.setupControls();
        
        // Update display
        this.updateStatus();
        this.updateCountdown();
    }
    
    setupControls() {
        if (!this.elements.timerContainer) return;
        
        const minimizeBtn = this.elements.timerContainer.querySelector('.minimize');
        const closeBtn = this.elements.timerContainer.querySelector('.close');
        
        minimizeBtn.addEventListener('click', () => {
            this.elements.timerContainer.classList.toggle('minimized');
        });
        
        closeBtn.addEventListener('click', () => {
            this.handleStopTimer();
        });
    }
    
    makeTimerDraggable() {
        if (!this.elements.timerContainer) return;
        
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        const startDrag = (e) => {
            if (e.target.closest('.control-btn')) return;
            
            isDragging = true;
            const rect = this.elements.timerContainer.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            
            // Remove position class when manually dragged
            this.elements.timerContainer.classList.remove(
                'top-right', 'top-left', 'bottom-right', 'bottom-left',
                'center-right', 'center-left'
            );
            this.elements.timerContainer.style.position = 'fixed';
            
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', stopDrag);
        };
        
        const drag = (e) => {
            if (!isDragging) return;
            
            const x = e.clientX - dragOffset.x;
            const y = e.clientY - dragOffset.y;
            
            // Keep within viewport
            const maxX = window.innerWidth - this.elements.timerContainer.offsetWidth;
            const maxY = window.innerHeight - this.elements.timerContainer.offsetHeight;
            
            this.elements.timerContainer.style.left = Math.max(0, Math.min(maxX, x)) + 'px';
            this.elements.timerContainer.style.top = Math.max(0, Math.min(maxY, y)) + 'px';
        };
        
        const stopDrag = () => {
            isDragging = false;
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
        };
        
        this.elements.timerContainer.addEventListener('mousedown', startDrag);
    }
    
    startCountdown() {
        if (!this.elements.timerContainer) return;
        
        // Update status
        this.updateStatus();
        
        // Clear any existing interval
        if (this.state.countdownInterval) {
            clearInterval(this.state.countdownInterval);
        }
        
        // Start new countdown
        this.state.countdownInterval = setInterval(() => {
            this.updateCountdown();
        }, 1000);
        
        this.updateCountdown();
    }
    
    stopCountdown() {
        if (this.state.countdownInterval) {
            clearInterval(this.state.countdownInterval);
            this.state.countdownInterval = null;
        }
        
        if (this.elements.timerContainer) {
            this.updateStatus();
            this.updateTimeDisplay('--:--');
        }
    }
    
    updateStatus() {
        if (!this.elements.timerContainer) return;
        
        const statusDot = this.elements.timerContainer.querySelector('.status-dot');
        const statusText = this.elements.timerContainer.querySelector('.status-text');
        
        if (this.state.isRunning && this.state.nextRefreshTime) {
            statusDot.className = 'status-dot running';
            statusText.textContent = 'RUNNING';
            statusText.className = 'status-text running';
        } else {
            statusDot.className = 'status-dot stopped';
            statusText.textContent = 'STOPPED';
            statusText.className = 'status-text stopped';
        }
    }
    
    updateCountdown() {
        if (!this.elements.timerContainer || !this.state.nextRefreshTime) return;
        
        const now = Date.now();
        const timeLeft = Math.max(0, Math.floor((this.state.nextRefreshTime - now) / 1000));
        
        if (timeLeft <= 0) {
            this.updateTimeDisplay('00:00', 'imminent');
        } else {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Color code based on time left
            let colorClass = 'normal';
            if (timeLeft < 10) colorClass = 'warning';
            else if (timeLeft < 30) colorClass = 'caution';
            
            this.updateTimeDisplay(timeStr, colorClass);
        }
    }
    
    updateTimeDisplay(time, colorClass = 'normal') {
        if (!this.elements.timerContainer) return;
        
        const timeValue = this.elements.timerContainer.querySelector('.time-value');
        if (timeValue) {
            timeValue.textContent = time;
            timeValue.className = `time-value ${colorClass}`;
        }
    }
    
    toggleDisplay(show) {
        this.state.showTimer = show;
        
        if (show && this.state.isRunning) {
            this.createTimerDisplay();
            this.startCountdown();
        } else if (this.elements.timerContainer) {
            this.elements.timerContainer.remove();
            this.elements.timerContainer = null;
        }
    }
    
    changePosition(position) {
        this.state.timerPosition = position;
        
        if (this.elements.timerContainer) {
            // Remove all position classes
            this.elements.timerContainer.classList.remove(
                'top-right', 'top-left', 'bottom-right', 'bottom-left',
                'center-right', 'center-left'
            );
            
            // Add new position class
            this.elements.timerContainer.classList.add(position);
            
            // Reset custom positioning
            this.elements.timerContainer.style.left = '';
            this.elements.timerContainer.style.top = '';
            this.elements.timerContainer.style.position = '';
        }
    }
    
    changeTheme(theme) {
        this.state.theme = theme;
        
        if (this.elements.timerContainer) {
            // Remove all theme classes
            this.elements.timerContainer.classList.remove('default', 'dark', 'minimal');
            
            // Add new theme class
            this.elements.timerContainer.classList.add(theme);
        }
    }
    
    simulateHumanBehavior(beforeRefresh = false) {
        if (!this.state.stealthMode) return;
        
        console.log('🎭 Simulating human-like behavior...');
        
        // Simulate mouse movements
        this.simulateMouseMovement();
        
        // Simulate scrolling (80% chance)
        if (Math.random() > 0.2) {
            this.simulateScrolling();
        }
        
        // Simulate random clicks (20% chance)
        if (Math.random() > 0.8) {
            this.simulateRandomClick();
        }
        
        // Simulate keyboard activity (10% chance)
        if (Math.random() > 0.9) {
            this.simulateKeyboardActivity();
        }
        
        // If before refresh, show notification
        if (beforeRefresh && this.elements.timerContainer) {
            this.showNotification('Simulating human behavior before refresh...');
        }
    }
    
    simulateMouseMovement() {
        const steps = 5 + Math.floor(Math.random() * 10);
        let x = Math.random() * window.innerWidth;
        let y = Math.random() * window.innerHeight;
        
        for (let i = 0; i < steps; i++) {
            setTimeout(() => {
                x += (Math.random() * 80) - 40;
                y += (Math.random() * 60) - 30;
                
                // Keep within bounds
                x = Math.max(0, Math.min(window.innerWidth, x));
                y = Math.max(0, Math.min(window.innerHeight, y));
                
                // Dispatch mouse move event
                const event = new MouseEvent('mousemove', {
                    clientX: x,
                    clientY: y,
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                
                // Dispatch on a random element
                const elements = document.elementsFromPoint(x, y);
                if (elements.length > 0) {
                    elements[0].dispatchEvent(event);
                }
            }, i * (50 + Math.random() * 100));
        }
    }
    
    simulateScrolling() {
        const scrollAmount = (Math.random() * 400) - 200; // -200 to +200 pixels
        const scrollSteps = 3 + Math.floor(Math.random() * 5);
        const stepSize = scrollAmount / scrollSteps;
        
        for (let i = 0; i < scrollSteps; i++) {
            setTimeout(() => {
                window.scrollBy({
                    top: stepSize,
                    left: 0,
                    behavior: 'smooth'
                });
            }, i * (150 + Math.random() * 200));
        }
    }
    
    simulateRandomClick() {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        
        // Find element at position
        const elements = document.elementsFromPoint(x, y);
        if (elements.length > 0) {
            const element = elements[Math.floor(Math.random() * Math.min(3, elements.length))];
            
            // Dispatch mouse events (but don't actually click)
            const mouseDown = new MouseEvent('mousedown', {
                clientX: x,
                clientY: y,
                bubbles: true,
                cancelable: true,
                view: window
            });
            
            const mouseUp = new MouseEvent('mouseup', {
                clientX: x,
                clientY: y,
                bubbles: true,
                cancelable: true,
                view: window
            });
            
            element.dispatchEvent(mouseDown);
            setTimeout(() => {
                element.dispatchEvent(mouseUp);
            }, 50 + Math.random() * 100);
        }
    }
    
    simulateKeyboardActivity() {
        // Simulate Tab key press (switches focus)
        const tabEvent = new KeyboardEvent('keydown', {
            key: 'Tab',
            code: 'Tab',
            keyCode: 9,
            bubbles: true,
            cancelable: true
        });
        
        document.activeElement.dispatchEvent(tabEvent);
    }
    
    testStealth() {
        console.log('🧪 Testing stealth mode...');
        
        // Show test notification
        this.showNotification('Testing stealth mode... Watch for human-like behavior!');
        
        // Run multiple stealth behaviors
        this.simulateMouseMovement();
        
        setTimeout(() => {
            this.simulateScrolling();
        }, 500);
        
        setTimeout(() => {
            this.simulateRandomClick();
        }, 1000);
        
        setTimeout(() => {
            this.simulateKeyboardActivity();
            this.showNotification('Stealth test complete! Behavior looks 100% human.');
        }, 1500);
    }
    
    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'stealth-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 100000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            border-left: 4px solid #4fc3f7;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;
        
        // Add animation style if not already present
        if (!document.querySelector('#stealth-animation-style')) {
            const style = document.createElement('style');
            style.id = 'stealth-animation-style';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.5s ease-out';
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 3000);
    }
}

// Initialize when page loads
let stealthExtension = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        stealthExtension = new StealthAutoRefresh();
    });
} else {
    stealthExtension = new StealthAutoRefresh();
}