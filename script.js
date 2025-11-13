// Page Navigation

// Mobile menu functionality
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileNav = document.getElementById('mobileNav');
const closeMobileMenu = document.getElementById('closeMobileMenu');

if (mobileMenuBtn && mobileNav && closeMobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
        mobileNav.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    });
    
    closeMobileMenu.addEventListener('click', () => {
        mobileNav.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    });
    
    // Close menu when clicking on a link
    const mobileNavLinks = mobileNav.querySelectorAll('.nav-link');
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileNav.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
}

document.querySelectorAll('.nav-links a, .btn[data-page]').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const targetPage = this.getAttribute('data-page');
        
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // Show target page
        document.getElementById(targetPage).classList.add('active');
        
        // Update nav links
        document.querySelectorAll('.nav-links a').forEach(navLink => {
            navLink.classList.remove('active');
        });
        
        // Activate current nav link
        document.querySelector(`.nav-links a[data-page="${targetPage}"]`).classList.add('active');
        
        // Initialize features based on page
        if (targetPage === 'meditation') {
            initializeMeditationPage();
        } else if (targetPage === 'summary') {
            initializeSummaryPage();
        }
    });
});

// Settings management
document.getElementById('save-settings').addEventListener('click', function(e) {
    e.preventDefault();
    
    // Save settings to localStorage
    const settings = {
        sessionDuration: parseInt(document.getElementById('session-duration').value),
        breatheIn: parseInt(document.getElementById('breathe-in').value),
        breatheOut: parseInt(document.getElementById('breathe-out').value),
        voiceGuidance: document.getElementById('voice-guidance').value,
        musicVolume: document.getElementById('music-volume').value
    };
    
    localStorage.setItem('meditationSettings', JSON.stringify(settings));
    
    // Navigate to meditation page
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById('meditation').classList.add('active');
    
    // Update nav links
    document.querySelectorAll('.nav-links a').forEach(navLink => {
        navLink.classList.remove('active');
    });
    document.querySelector('.nav-links a[data-page="meditation"]').classList.add('active');
    
    initializeMeditationPage();
});

// Load settings when page loads
function loadSettings() {
    const savedSettings = localStorage.getItem('meditationSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        document.getElementById('session-duration').value = settings.sessionDuration;
        document.getElementById('breathe-in').value = settings.breatheIn;
        document.getElementById('breathe-out').value = settings.breatheOut;
        document.getElementById('voice-guidance').value = settings.voiceGuidance;
        
        // Load music settings
        if (settings.musicVolume) {
            document.getElementById('music-volume').value = settings.musicVolume;
            document.getElementById('volume-display').textContent = `${settings.musicVolume}%`;
            document.getElementById('meditation-volume').value = settings.musicVolume;
            document.getElementById('meditation-volume-display').textContent = `${settings.musicVolume}%`;
        }
    }
}

// Voice-first meditation integration
/****************************************************************
 * Voice-first Meditation Frontend
 * - MediaPipe Hands + FaceMesh for detection
 * - speechSynthesis queue for TTS (no overlaps)
 * - Priority-based guidance system with proper breathing cycle
 ****************************************************************/

// Config / thresholds
const MUDRA_CONF_THRESHOLD = 0.75;   // when we treat mudra as confirmed
const MUDRA_LOSS_THRESHOLD = 0.40;   // when we treat mudra as lost
const EYE_OPEN_THRESHOLD = 0.25;     // EAR threshold (<= closed)
const EMOTION_CHECK_INTERVAL_MS = 1200; // emotion evaluation cadence
const ROLLING_CONF_LEN = 8;          // smoothing window for mudra confidence

// Default breathing cycle timing (in seconds)
let BREATHE_IN_DURATION = 4;       // 4 seconds to breathe in
let BREATHE_OUT_DURATION = 6;      // 6 seconds to breathe out
let BREATHING_CYCLE_DURATION = BREATHE_IN_DURATION + BREATHE_OUT_DURATION;

// Voice Commands Library - Dynamic and Concise
const VOICE_COMMANDS = {
    sessionStart: [
        "Let's begin meditation",
        "Starting meditation",
        "Meditation starting",
        "Begin your practice",
        "Session starting now"
    ],
    sessionPaused: [
        "Session paused",
        "Meditation paused", 
        "Pausing session",
        "Taking a pause",
        "Paused"
    ],
    sessionResumed: [
        "Session resumed",
        "Back to meditation",
        "Continuing practice", 
        "Resuming now",
        "Let's continue"
    ],
    sessionStopped: [
        "Session complete",
        "Meditation finished",
        "Practice complete",
        "Session ended",
        "Good work today"
    ],
    mudraNotDetected: [
        "Adjust your hand position",
        "Correct your mudra",
        "Fix hand gesture",
        "Adjust mudra",
        "Hand position needs correction"
    ],
    eyesNotClosed: [
        "Close your eyes",
        "Eyes should be closed",
        "Gently close eyes",
        "Keep eyes shut",
        "Close eyes now"
    ],
    emotionNotNeutral: [
        "Relax your face",
        "Soften your expression",
        "Neutral face please",
        "Relax facial muscles",
        "Calm your expression"
    ],
    startBreathing: [
        "Begin breathing",
        "Start breath cycle",
        "Commence breathing",
        "Breathing starts now",
        "Follow the breath"
    ],
    breatheIn: [
        "Breathe in",
        "Inhale now",
        "Breathe in slowly",
        "Inhale gently",
        "Take breath in"
    ],
    breatheOut: [
        "Breathe out", 
        "Exhale now",
        "Breathe out slowly",
        "Exhale gently",
        "Release breath"
    ],
    breathingPaused: [
        "Breathing paused",
        "Hold breath pattern",
        "Pausing breath cycle",
        "Breath practice paused"
    ],
    breathingResumed: [
        "Breathing resumed",
        "Continue breathing",
        "Resume breath cycle",
        "Back to breathing"
    ],
    musicUploaded: [
        "Music ready",
        "Audio file loaded",
        "Music uploaded",
        "Soundtrack ready"
    ],
    musicStarted: [
        "Music starting",
        "Background music on",
        "Music begins",
        "Audio starting"
    ],
    musicPaused: [
        "Music paused",
        "Audio stopped",
        "Music off",
        "Sound paused"
    ],
    cameraError: [
        "Camera access needed",
        "Allow camera please",
        "Camera permission required",
        "Enable camera access"
    ],
    allConditionsMet: [
        "Perfect posture",
        "Ideal position",
        "Excellent form",
        "Great alignment"
    ],
    timerStarted: [
        "Timer started",
        "Session timer begins now",
        "Starting session timer",
        "Timer running"
    ]
};

// Function to get random voice command
function getVoiceCommand(commandType) {
    const commands = VOICE_COMMANDS[commandType];
    if (!commands || commands.length === 0) return "";
    return commands[Math.floor(Math.random() * commands.length)];
}

// DOM elements
const videoEl = document.getElementById('webcam');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const mudraStatusEl = document.getElementById('mudra-status');
const eyesStatusEl = document.getElementById('eyes-status');
const emotionStatusEl = document.getElementById('emotion-status');
const breathingStatusEl = document.getElementById('breathing-status');
const breathingIndicatorEl = document.getElementById('breathing-indicator');
const voiceHistoryEl = document.getElementById('voice-history');
const sessionParamsEl = document.getElementById('session-params');
const meditateAgainBtn = document.getElementById('meditate-again-btn');

// MediaPipe objects
let hands = null, faceMesh = null, mpCamera = null;

// State
let isRunning = false;
let isPaused = false;
let lastMudra = false;
let lastEyesClosed = false;
let lastEmotion = 'neutral';
let mudraConfRolling = [];

// Priority-based guidance system
let currentPriority = 1; // 1: Mudra, 2: Emotion, 3: Eyes, 4: Breathing
let guidanceCooldowns = [0, 0, 0, 0]; // Cooldowns for each priority level
const GUIDANCE_COOLDOWNS = [15000, 10000, 10000, 20000]; // Cooldown times in ms
let lastGuidanceTime = 0;
const MIN_TIME_BETWEEN_GUIDANCE = 7000; // Minimum time between any guidance

// Breathing state
let breathingActive = false;
let breathingPhase = 'in'; // 'in' or 'out'
let breathingStartTime = 0;
let breathingInterval = null;

// Track state changes to avoid repetitive guidance
let mudraStateChanged = false;
let emotionStateChanged = false;
let eyesStateChanged = false;
let lastMudraState = false;
let lastEmotionState = 'neutral';
let lastEyesState = false;

// Session data
let sessionData = {
    mudraAccuracy: 0,
    focusTime: 0,
    mudraData: [],
    emotionData: [],
    sessionDuration: 0,
    breathingPattern: `${BREATHE_IN_DURATION}s in / ${BREATHE_OUT_DURATION}s out`,
    mudraCorrectCount: 0,
    totalDetectionCount: 0,
    eyesClosedCount: 0,
    eyesOpenCount: 0,
    sessionStartTime: null,
    timerStarted: false
};

// Background Music Management
let backgroundMusic = document.getElementById('background-music');
let musicVolume = 0.3; // Default volume (30%)
let currentMusicFile = null;

// Timer variables
let timerInterval;
let timerSeconds = 300; // 5 minutes default
let originalTimerSeconds = 300; // Store the original timer value

// Chart instances
let confidenceChart, emotionChart;

// Simple TTS queue (prevents overlapping utterances)
const TTS = (() => {
    const q = [];
    let speaking = false;
    function speakNow(text) {
        if (!('speechSynthesis' in window)) return;
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.9; // Slightly slower speech
        u.onend = () => {
            speaking = false;
            setTimeout(() => { if (q.length) speakNow(q.shift()); }, 50);
        };
        u.onerror = () => { speaking = false; if (q.length) speakNow(q.shift()); };
        speaking = true;
        speechSynthesis.speak(u);
    }
    return {
        enqueue(txt) {
            if (!txt) return;
            // avoid immediate duplicate
            if (q.length && q[q.length-1] === txt) return;
            q.push(txt);
            if (!speaking) speakNow(q.shift());
        },
        clear() { q.length = 0; speechSynthesis.cancel(); speaking = false; }
    };
})();

// Utility: push message to voice history
function pushVoiceHistory(msg) {
    const t = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'voice-entry';
    entry.innerHTML = `<time>${t}</time><div>${escapeHtml(msg)}</div>`;
    voiceHistoryEl.prepend(entry);
    // keep list length reasonable
    if (voiceHistoryEl.children.length > 80) voiceHistoryEl.removeChild(voiceHistoryEl.lastChild);
}
function escapeHtml(s){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

// Geometry helpers (converted from Python code)
const LEFT_EYE = [33,160,158,133,153,144];
const RIGHT_EYE = [263,387,385,362,380,373];

// Enhanced facial landmarks for emotion detection
const MOUTH_OUTER = [61, 84, 17, 314, 405, 320, 375, 291];
const MOUTH_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];
const LEFT_EYEBROW = [70, 63, 105, 66, 107];
const RIGHT_EYEBROW = [300, 293, 334, 296, 336];
const NOSE_TIP = 1;
const LEFT_JAW = [136, 172, 150, 176, 148, 152];
const RIGHT_JAW = [365, 397, 378, 400, 377, 152];

function eyeAspectRatio(landmarks, eyeIndices, imgW, imgH) {
    try {
        const pts = eyeIndices.map(i => {
            const p = landmarks[i];
            return [p.x * imgW, p.y * imgH];
        });
        const [p1,p2,p3,p4,p5,p6] = pts;
        const A = Math.hypot(p2[0]-p6[0], p2[1]-p6[1]);
        const B = Math.hypot(p3[0]-p5[0], p3[1]-p5[1]);
        const C = Math.hypot(p1[0]-p4[0], p1[1]-p4[1]);
        if (C === 0) return 0;
        return (A + B) / (2.0 * C);
    } catch(e) { return 0; }
}

function detectGyanConfidence(handLandmarks, imgW, imgH) {
    if (!handLandmarks || handLandmarks.length < 21) return 0.0;
    const lm = handLandmarks.map(p => [p.x * imgW, p.y * imgH]);
    const diag = Math.hypot(imgW, imgH) || 1;
    const safe = i => lm[Math.max(0, Math.min(i, lm.length-1))];
    const thumb_tip = safe(4), index_tip = safe(8), index_pip = safe(6);
    const middle_tip = safe(12), ring_tip = safe(16), pinky_tip = safe(20);
    const index_mcp = (lm[5] || index_pip);

    const dist = Math.hypot(thumb_tip[0]-index_tip[0], thumb_tip[1]-index_tip[1]) / diag;
    const dist_score = Math.max(0, 1 - (dist / 0.06));
    const index_extended = index_tip[1] < index_pip[1];
    const index_score = index_extended ? 1.0 : 0.0;
    const folded = (tip, pipIdx) => { try { const pip = safe(pipIdx); return (tip[1] > pip[1]) ? 1.0 : 0.0; } catch(e){ return 0.0; } };
    const middle_fold = folded(middle_tip,10), ring_fold = folded(ring_tip,14), pinky_fold = folded(pinky_tip,18);
    const folded_score_avg = (middle_fold + ring_fold + pinky_fold) / 3.0;
    const v = [thumb_tip[0] - index_tip[0], thumb_tip[1] - index_tip[1]];
    const v_norm = Math.hypot(v[0], v[1]);
    let angle_score = 0.5;
    if (v_norm === 0) angle_score = 1.0;
    else {
        const finger_dir = [index_tip[0]-index_mcp[0], index_tip[1]-index_mcp[1]];
        const fd_norm = Math.hypot(finger_dir[0],finger_dir[1]);
        if (fd_norm === 0) angle_score = 0.5;
        else {
            let cosang = (v[0]*finger_dir[0] + v[1]*finger_dir[1]) / (v_norm * fd_norm + 1e-8);
            cosang = Math.min(1, Math.max(-1, cosang));
            const angle_deg = Math.acos(cosang) * 180/Math.PI;
            angle_score = Math.max(0.0, 1.0 - (angle_deg / 90.0));
        }
    }
    const w_dist=0.45, w_index=0.25, w_fold=0.20, w_angle=0.10;
    let conf = (w_dist*dist_score) + (w_index*index_score) + (w_fold*folded_score_avg) + (w_angle*angle_score);
    return Math.min(1, Math.max(0, conf));
}

// Enhanced Emotion Detection Functions
function calculateMouthOpenness(landmarks, mouthIndices, imgW, imgH) {
    try {
        const upperLip = landmarks[13]; // Upper lip center
        const lowerLip = landmarks[14]; // Lower lip center
        if (!upperLip || !lowerLip) return 0;
        
        const verticalDistance = Math.abs(upperLip.y - lowerLip.y) * imgH;
        const mouthWidth = calculateMouthWidth(landmarks, imgW, imgH);
        
        // Normalize by mouth width to account for different face sizes
        return verticalDistance / (mouthWidth || 1);
    } catch(e) { return 0; }
}

function calculateMouthWidth(landmarks, imgW, imgH) {
    try {
        const leftCorner = landmarks[61]; // Left mouth corner
        const rightCorner = landmarks[291]; // Right mouth corner
        if (!leftCorner || !rightCorner) return 0;
        
        return Math.hypot(
            (leftCorner.x - rightCorner.x) * imgW,
            (leftCorner.y - rightCorner.y) * imgH
        );
    } catch(e) { return 0; }
}

function calculateEyebrowTension(landmarks, leftBrowIndices, rightBrowIndices, imgW, imgH) {
    try {
        // Calculate average position of left eyebrow
        let leftBrowY = 0;
        for (const idx of leftBrowIndices) {
            leftBrowY += landmarks[idx].y;
        }
        leftBrowY /= leftBrowIndices.length;
        
        // Calculate average position of right eyebrow
        let rightBrowY = 0;
        for (const idx of rightBrowIndices) {
            rightBrowY += landmarks[idx].y;
        }
        rightBrowY /= rightBrowIndices.length;
        
        // Calculate average position of eyes for reference
        let leftEyeY = 0;
        for (const idx of LEFT_EYE) {
            leftEyeY += landmarks[idx].y;
        }
        leftEyeY /= LEFT_EYE.length;
        
        let rightEyeY = 0;
        for (const idx of RIGHT_EYE) {
            rightEyeY += landmarks[idx].y;
        }
        rightEyeY /= RIGHT_EYE.length;
        
        // Eyebrow tension is higher when eyebrows are lowered (closer to eyes)
        const leftTension = Math.abs(leftBrowY - leftEyeY);
        const rightTension = Math.abs(rightBrowY - rightEyeY);
        
        return (leftTension + rightTension) / 2;
    } catch(e) { return 0; }
}

function calculateJawClench(landmarks, leftJawIndices, rightJawIndices, imgW, imgH) {
    try {
        // Calculate variance in jaw points - higher variance might indicate clenching
        const jawPoints = [...leftJawIndices, ...rightJawIndices];
        const yValues = jawPoints.map(idx => landmarks[idx].y);
        
        const meanY = yValues.reduce((a, b) => a + b, 0) / yValues.length;
        const variance = yValues.reduce((a, b) => a + Math.pow(b - meanY, 2), 0) / yValues.length;
        
        return variance;
    } catch(e) { return 0; }
}

function detectEmotion(landmarks, imgW, imgH) {
    if (!landmarks || landmarks.length < 478) return 'neutral';
    
    try {
        // Calculate facial metrics
        const mouthOpenness = calculateMouthOpenness(landmarks, MOUTH_INNER, imgW, imgH);
        const eyebrowTension = calculateEyebrowTension(landmarks, LEFT_EYEBROW, RIGHT_EYEBROW, imgW, imgH);
        const jawClench = calculateJawClench(landmarks, LEFT_JAW, RIGHT_JAW, imgW, imgH);
        
        // Calculate mouth curvature (smile/frown detection)
        const leftMouthCorner = landmarks[61];
        const rightMouthCorner = landmarks[291];
        const mouthCenter = landmarks[13]; // Upper lip center
        
        if (!leftMouthCorner || !rightMouthCorner || !mouthCenter) return 'neutral';
        
        const leftCurvature = leftMouthCorner.y - mouthCenter.y;
        const rightCurvature = rightMouthCorner.y - mouthCenter.y;
        const avgCurvature = (leftCurvature + rightCurvature) / 2;
        
        // Emotion detection logic
        if (mouthOpenness > 0.03) {
            return 'surprised'; // Mouth open wide
        } else if (avgCurvature < -0.005) {
            return 'happy'; // Mouth corners up (smiling)
        } else if (avgCurvature > 0.015) {
            return 'sad'; // Mouth corners down
        } else {
            return 'neutral'; // Relaxed, neutral expression
        }
    } catch(e) {
        console.error('Error in emotion detection:', e);
        return 'neutral';
    }
}

// MediaPipe callbacks & integration
let latestHands = null;
let latestFace = null;

function onHandsResults(results) {
    latestHands = results;
    if (!isRunning || isPaused) return;
    evaluateState();
}
function onFaceResults(results) {
    latestFace = results;
    if (!isRunning || isPaused) return;
    evaluateState();
}

// Timer functionality
function startTimer() {
    clearInterval(timerInterval);
    // Reset timer to original value
    timerSeconds = originalTimerSeconds;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        if (!isPaused && timerSeconds > 0) {
            timerSeconds--;
            updateTimerDisplay();
        } else if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            // Auto-navigate to summary when timer ends
            endMeditationSession();
        }
    }, 1000);
    
    // Mark timer as started
    sessionData.timerStarted = true;
    
    // Announce timer start
    const timerMsg = getVoiceCommand('timerStarted');
    TTS.enqueue(timerMsg);
    pushVoiceHistory(timerMsg);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    document.getElementById('timer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Breathing cycle management
function startBreathingCycle() {
    if (breathingInterval) {
        clearInterval(breathingInterval);
    }
    
    breathingActive = true;
    breathingPhase = 'in';
    breathingStartTime = Date.now();
    
    // Initial breathing instruction
    const msg = getVoiceCommand('startBreathing');
    TTS.enqueue(msg);
    pushVoiceHistory(msg);
    breathingIndicatorEl.textContent = "Breathe IN...";
    
    breathingInterval = setInterval(() => {
        if (!isRunning || isPaused || !breathingActive) {
            clearInterval(breathingInterval);
            return;
        }
        
        const now = Date.now();
        const elapsed = (now - breathingStartTime) / 1000;
        const cycleTime = elapsed % BREATHING_CYCLE_DURATION;
        
        if (cycleTime < BREATHE_IN_DURATION && breathingPhase !== 'in') {
            breathingPhase = 'in';
            const msg = getVoiceCommand('breatheIn');
            TTS.enqueue(msg);
            pushVoiceHistory(msg);
            breathingIndicatorEl.textContent = "Breathe IN...";
        } else if (cycleTime >= BREATHE_IN_DURATION && breathingPhase !== 'out') {
            breathingPhase = 'out';
            const msg = getVoiceCommand('breatheOut');
            TTS.enqueue(msg);
            pushVoiceHistory(msg);
            breathingIndicatorEl.textContent = "Breathe OUT...";
        }
    }, 100);
}

function stopBreathingCycle() {
    breathingActive = false;
    if (breathingInterval) {
        clearInterval(breathingInterval);
        breathingInterval = null;
    }
    breathingIndicatorEl.textContent = "";
}

// Update meditation charts with real-time data
function updateMeditationCharts(confidence, emotionStability) {
    if (!confidenceChart || !emotionChart) return;
    
    const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // Update confidence chart
    confidenceChart.data.labels.push(timestamp);
    confidenceChart.data.datasets[0].data.push(confidence);
    
    // Keep only last 20 data points for performance
    if (confidenceChart.data.labels.length > 20) {
        confidenceChart.data.labels.shift();
        confidenceChart.data.datasets[0].data.shift();
    }
    
    // Update emotion chart (convert emotion to stability score)
    const stabilityScore = emotionStability === 'neutral' ? 1 : 0.5;
    emotionChart.data.labels.push(timestamp);
    emotionChart.data.datasets[0].data.push(stabilityScore);
    
    if (emotionChart.data.labels.length > 20) {
        emotionChart.data.labels.shift();
        emotionChart.data.datasets[0].data.shift();
    }
    
    // Update both charts
    confidenceChart.update('none');
    emotionChart.update('none');
}

// Background Music Functions
function initializeMusicControls() {
    // Set up music upload
    const musicUpload = document.getElementById('music-upload');
    const musicFileName = document.getElementById('music-file-name');
    
    musicUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            currentMusicFile = file;
            musicFileName.textContent = `Selected: ${file.name}`;
            
            // Create object URL for the uploaded file
            const objectUrl = URL.createObjectURL(file);
            backgroundMusic.src = objectUrl;
            backgroundMusic.load();
            
            const msg = getVoiceCommand('musicUploaded');
            pushVoiceHistory(msg);
        }
    });
    
    // Set up play button
    document.getElementById('play-music-btn').addEventListener('click', function() {
        if (backgroundMusic.src && backgroundMusic.src !== window.location.href) {
            backgroundMusic.volume = musicVolume;
            backgroundMusic.play().catch(e => {
                console.log('Audio play failed:', e);
                pushVoiceHistory('Please click anywhere on the page to enable background music.');
            });
            const msg = getVoiceCommand('musicStarted');
            pushVoiceHistory(msg);
        } else {
            pushVoiceHistory('Please upload a music file first');
        }
    });
    
    // Set up pause button
    document.getElementById('pause-music-btn').addEventListener('click', function() {
        backgroundMusic.pause();
        const msg = getVoiceCommand('musicPaused');
        pushVoiceHistory(msg);
    });
    
    // Set up volume slider
    const volumeSlider = document.getElementById('meditation-volume');
    const volumeDisplay = document.getElementById('meditation-volume-display');
    
    volumeSlider.addEventListener('input', function() {
        const volume = this.value;
        volumeDisplay.textContent = `${volume}%`;
        musicVolume = volume / 100;
        backgroundMusic.volume = musicVolume;
        
        // Save volume setting
        const settings = JSON.parse(localStorage.getItem('meditationSettings') || '{}');
        settings.musicVolume = volume;
        localStorage.setItem('meditationSettings', JSON.stringify(settings));
    });
    
    // Load saved volume setting
    const savedSettings = localStorage.getItem('meditationSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.musicVolume) {
            volumeSlider.value = settings.musicVolume;
            volumeDisplay.textContent = `${settings.musicVolume}%`;
            musicVolume = settings.musicVolume / 100;
            backgroundMusic.volume = musicVolume;
        }
    }
}

function startBackgroundMusic() {
    if (backgroundMusic.src && backgroundMusic.src !== window.location.href && isRunning && !isPaused) {
        backgroundMusic.volume = musicVolume;
        backgroundMusic.play().catch(e => {
            console.log('Audio play failed:', e);
        });
    }
}

function pauseBackgroundMusic() {
    backgroundMusic.pause();
}

// NEW: Check if all conditions are met for starting timer and breathing
function checkAllConditionsMet(avgConf, eyesClosed, emotion) {
    return avgConf >= MUDRA_CONF_THRESHOLD && eyesClosed && emotion === 'neutral';
}

// UPDATED: Priority-based guidance system with timer start logic
function providePriorityGuidance(avgConf, eyesClosed, emotion) {
    const now = Date.now();
    
    // Update cooldowns
    for (let i = 0; i < guidanceCooldowns.length; i++) {
        if (guidanceCooldowns[i] > 0) {
            guidanceCooldowns[i] = Math.max(0, guidanceCooldowns[i] - (now - lastGuidanceTime));
        }
    }
    
    // Check if enough time has passed since last guidance
    if (now - lastGuidanceTime < MIN_TIME_BETWEEN_GUIDANCE) {
        return false;
    }
    
    // Detect state changes
    mudraStateChanged = (avgConf >= MUDRA_CONF_THRESHOLD) !== lastMudraState;
    emotionStateChanged = emotion !== lastEmotionState;
    eyesStateChanged = eyesClosed !== lastEyesState;
    
    // Store current states for next comparison
    lastMudraState = avgConf >= MUDRA_CONF_THRESHOLD;
    lastEmotionState = emotion;
    lastEyesState = eyesClosed;
    
    // NEW: Check if all conditions are met for the first time to start timer
    const allConditionsMet = checkAllConditionsMet(avgConf, eyesClosed, emotion);
    if (allConditionsMet && !sessionData.timerStarted && isRunning) {
        startTimer();
        startBreathingCycle();
        const msg = getVoiceCommand('allConditionsMet');
        TTS.enqueue(msg);
        pushVoiceHistory(msg);
        return true;
    }
    
    // Check conditions in priority order - only provide guidance on state changes or after long periods
    if (currentPriority === 1 && avgConf < MUDRA_CONF_THRESHOLD && guidanceCooldowns[0] <= 0 && isRunning) {
        // Priority 1: Mudra not detected
        if (mudraStateChanged || now - lastGuidanceTime > 10000) {
            const msg = getVoiceCommand('mudraNotDetected');
            TTS.enqueue(msg); 
            pushVoiceHistory(msg);
            guidanceCooldowns[0] = GUIDANCE_COOLDOWNS[0];
            lastGuidanceTime = now;
            
            // Stop breathing if mudra is lost, but keep timer running
            if (breathingActive) {
                stopBreathingCycle();
                const stopMsg = getVoiceCommand('breathingPaused');
                TTS.enqueue(stopMsg);
                pushVoiceHistory(stopMsg);
            }
            return true;
        }
    } 
    else if (currentPriority === 3 && emotion !== 'neutral' && guidanceCooldowns[1] <= 0) {
        // Priority 2: Face not neutral
        if (emotionStateChanged) {
            const msg = getVoiceCommand('emotionNotNeutral');
            TTS.enqueue(msg); 
            pushVoiceHistory(msg);
            guidanceCooldowns[2] = GUIDANCE_COOLDOWNS[2];
            lastGuidanceTime = now;
            
            // Stop breathing if emotion changes, but keep timer running
            if (breathingActive) {
                stopBreathingCycle();
                const stopMsg = getVoiceCommand('breathingPaused');
                TTS.enqueue(stopMsg);
                pushVoiceHistory(stopMsg);
            }
            return true;
        }
    } 
    else if (currentPriority === 2 && !eyesClosed && guidanceCooldowns[2] <= 0) {
        // Priority 3: Eyes not closed
        if (eyesStateChanged) {
            const msg = getVoiceCommand('eyesNotClosed');
            TTS.enqueue(msg); 
            pushVoiceHistory(msg);
            guidanceCooldowns[1] = GUIDANCE_COOLDOWNS[1];
            lastGuidanceTime = now;
            
            // Stop breathing if eyes open, but keep timer running
            if (breathingActive) {
                stopBreathingCycle();
                const stopMsg = getVoiceCommand('breathingPaused');
                TTS.enqueue(stopMsg);
                pushVoiceHistory(stopMsg);
            }
            return true;
        }
    } 
    else if (currentPriority === 4 && guidanceCooldowns[3] <= 0) {
        // Priority 4: Resume breathing guidance when all conditions are met again
        if (!breathingActive && allConditionsMet && sessionData.timerStarted) {
            startBreathingCycle();
            const resumeMsg = getVoiceCommand('breathingResumed');
            TTS.enqueue(resumeMsg);
            pushVoiceHistory(resumeMsg);
            guidanceCooldowns[3] = GUIDANCE_COOLDOWNS[3];
            lastGuidanceTime = now;
            return true;
        }
    }
    
    return false;
}

// Evaluate combined state and update UI + TTS
function evaluateState() {
    if (!videoEl.videoWidth || !videoEl.videoHeight) return;
    const w = videoEl.videoWidth, h = videoEl.videoHeight;

    // compute best mudra confidence among hands
    let conf = 0;
    if (latestHands && latestHands.multiHandLandmarks && latestHands.multiHandLandmarks.length) {
        for (const hl of latestHands.multiHandLandmarks) {
            const c = detectGyanConfidence(hl, w, h);
            if (c > conf) conf = c;
        }
    }
    mudraConfRolling.push(conf);
    if (mudraConfRolling.length > ROLLING_CONF_LEN) mudraConfRolling.shift();
    const avgConf = mudraConfRolling.reduce((a,b)=>a+b,0)/mudraConfRolling.length;

    // eyes: use EAR
    let eyesClosed = false;
    if (latestFace && latestFace.multiFaceLandmarks && latestFace.multiFaceLandmarks.length) {
        const fl = latestFace.multiFaceLandmarks[0];
        const earL = eyeAspectRatio(fl, LEFT_EYE, w, h);
        const earR = eyeAspectRatio(fl, RIGHT_EYE, w, h);
        const earAvg = (earL + earR)/2;
        eyesClosed = earAvg <= EYE_OPEN_THRESHOLD;
    }

    // Enhanced emotion detection
    let emotion = 'neutral';
    if (latestFace && latestFace.multiFaceLandmarks && latestFace.multiFaceLandmarks.length) {
        const fl = latestFace.multiFaceLandmarks[0];
        emotion = detectEmotion(fl, w, h);
    }

    // update UI
    setStatus(mudraStatusEl, avgConf >= MUDRA_CONF_THRESHOLD ? 'Correct' : 'Not Detected', avgConf >= MUDRA_CONF_THRESHOLD);
    setStatus(eyesStatusEl, eyesClosed ? 'Closed' : 'Open', eyesClosed);
    
    // Enhanced emotion status display with emojis
    const emotionDisplay = {
        'neutral': '😐 Neutral',
        'happy': '😊 Happy',
        'sad': '😢 Sad',
        'surprised': '😯 Surprised',
        'tense': '😠 Tense'
    };
    setStatus(emotionStatusEl, emotionDisplay[emotion] || '😐 Neutral', emotion === 'neutral');

    // Update current priority based on conditions
    const newMudraState = avgConf >= MUDRA_CONF_THRESHOLD;
    if (!newMudraState) {
        currentPriority = 1; // Mudra is the highest priority
    } else if (emotion !== 'neutral') {
        currentPriority = 3; // Emotion is next priority
    } else if (!eyesClosed) {
        currentPriority = 2; // Eyes closed is next priority
    } else {
        currentPriority = 4; // Breathing guidance is the final priority
    }

    // Update charts with current data
    if (isRunning && !isPaused) {
        updateMeditationCharts(avgConf, emotion);
        
        // Collect session data for summary
        sessionData.mudraData.push(avgConf);
        sessionData.emotionData.push(emotion === 'neutral' ? 1 : 0.5);
        
        // Track mudra accuracy
        sessionData.totalDetectionCount++;
        if (avgConf >= MUDRA_CONF_THRESHOLD) {
            sessionData.mudraCorrectCount++;
        }
        
        // Track eye state
        if (eyesClosed) {
            sessionData.eyesClosedCount++;
        } else {
            sessionData.eyesOpenCount++;
        }
    }

    // Provide guidance based on priority (with cooldowns and state change detection)
    providePriorityGuidance(avgConf, eyesClosed, emotion);

    // Update breathing status
    setStatus(breathingStatusEl, breathingActive ? 'Active' : 'Inactive', breathingActive);

    // Update last state for transitions
    lastMudra = newMudraState;
    lastEyesClosed = eyesClosed;
    lastEmotion = emotion;
}

function setStatus(el, text, good=false) {
    el.textContent = text;
    el.className = 'status-value ' + (good ? 'status-good' : 'status-warning');
}

// Initialize MediaPipe & camera
async function startMediaPipe() {
    // create hands
    hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
    hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.55, minTrackingConfidence: 0.5 });
    hands.onResults(onHandsResults);

    // face mesh
    faceMesh = new FaceMesh({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    faceMesh.onResults(onFaceResults);

    // Camera util ties the video element to mediapipe frames
    mpCamera = new Camera(videoEl, {
        onFrame: async () => {
            if (!isRunning || isPaused) return;
            await hands.send({ image: videoEl });
            await faceMesh.send({ image: videoEl });
        },
        width: 640, height: 480
    });
    mpCamera.start();
}

// Helper function to calculate final session data
function calculateAndStoreSessionData() {
    // Calculate mudra accuracy
    const mudraAccuracy = sessionData.totalDetectionCount > 0 ? 
        Math.round((sessionData.mudraCorrectCount / sessionData.totalDetectionCount) * 100) : 0;
    
    // Calculate session duration
    const sessionDuration = sessionData.sessionStartTime ? 
        (new Date() - sessionData.sessionStartTime) / 1000 : 0;
    
    // Calculate focus time based on conditions met
    const focusTime = Math.min(100, Math.round((sessionDuration / (originalTimerSeconds)) * 100));
    
    // Store final session data
    sessionData.mudraAccuracy = mudraAccuracy;
    sessionData.focusTime = focusTime;
    sessionData.sessionDuration = sessionDuration;
    
    localStorage.setItem('meditationData', JSON.stringify(sessionData));
}

// Helper function to navigate to summary page
function navigateToSummaryPage() {
    // Hide all pages and show summary
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById('summary').classList.add('active');
    
    // Update nav links
    document.querySelectorAll('.nav-links a').forEach(navLink => {
        navLink.classList.remove('active');
    });
    document.querySelector('.nav-links a[data-page="summary"]').classList.add('active');
    
    // Initialize summary page with data
    initializeSummaryPage();
}

// Controls: start / pause / stop
async function startSession() {
    if (isRunning) return;
    
    isRunning = true; 
    isPaused = false;
    mudraConfRolling = [];
    lastMudra = false; 
    lastEyesClosed = false; 
    lastEmotion = 'neutral';
    currentPriority = 1;
    breathingActive = false;
    breathingPhase = 'in';
    guidanceCooldowns = [0, 0, 0, 0];
    lastMudraState = false;
    lastEmotionState = 'neutral';
    lastEyesState = false;
    
    // Reset session data - timer not started yet
    sessionData = {
        mudraAccuracy: 0,
        focusTime: 0,
        mudraData: [],
        emotionData: [],
        sessionDuration: 0,
        breathingPattern: `${BREATHE_IN_DURATION}s in / ${BREATHE_OUT_DURATION}s out`,
        mudraCorrectCount: 0,
        totalDetectionCount: 0,
        eyesClosedCount: 0,
        eyesOpenCount: 0,
        sessionStartTime: new Date(),
        timerStarted: false  // Timer will start when conditions are met
    };
    
    const startMsg = getVoiceCommand('sessionStart');
    pushVoiceHistory("Session started — please assume Gyan Mudra, close your eyes, and relax your face. Timer will start automatically when you're in the correct position.");
    TTS.enqueue(startMsg);
    
    // Start background music
    startBackgroundMusic();
    
    // start camera if not started
    // try getUserMedia and then start MediaPipe
    try {
        if (!videoEl.srcObject) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
            videoEl.srcObject = stream;
            await new Promise(r => videoEl.onloadedmetadata = r);
        }
        if (!mpCamera) await startMediaPipe();
    } catch (err) {
        console.error('Camera start failed:', err);
        pushVoiceHistory('Error accessing camera. Please allow camera permission.');
        const errorMsg = getVoiceCommand('cameraError');
        TTS.enqueue(errorMsg);
    }
}

function pauseSession() {
    if (!isRunning) return;
    isPaused = !isPaused;
    pauseBtn.innerHTML = isPaused ? '<i class="fas fa-play"></i>&nbsp;Resume' : '<i class="fas fa-pause"></i>&nbsp;Pause';
    
    const msg = isPaused ? getVoiceCommand('sessionPaused') : getVoiceCommand('sessionResumed');
    pushVoiceHistory(msg); 
    TTS.enqueue(msg);
    
    if (isPaused) {
        if (breathingActive) {
            stopBreathingCycle();
        }
        pauseBackgroundMusic();
    } else {
        // If conditions are met and timer was already started, resume breathing
        if (sessionData.timerStarted && checkAllConditionsMet(
            mudraConfRolling.reduce((a,b)=>a+b,0)/mudraConfRolling.length || 0,
            lastEyesClosed,
            lastEmotion
        )) {
            startBreathingCycle();
        }
        startBackgroundMusic();
    }
}

function stopSession() {
    if (!isRunning) return;
    
    // Stop all processes first
    isRunning = false; 
    isPaused = false;
    
    // Stop timer
    clearInterval(timerInterval);
    
    // Stop breathing cycle
    stopBreathingCycle();
    
    // Stop background music
    pauseBackgroundMusic();
    
    // Stop all voice commands
    TTS.clear();
    
    // Stop camera and MediaPipe
    try { 
        if (mpCamera) { 
            mpCamera.stop(); 
            mpCamera = null; 
        } 
    } catch(e){}
    
    try { 
        if (hands) { 
            hands.close(); 
            hands = null; 
        } 
    } catch(e){}
    
    try { 
        if (faceMesh) { 
            faceMesh.close(); 
            faceMesh = null; 
        } 
    } catch(e){}
    
    // Stop video stream
    try {
        const stream = videoEl.srcObject;
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            videoEl.srcObject = null;
        }
    } catch(e){}
    
    // Reset UI
    setStatus(mudraStatusEl, 'Not Detected', false);
    setStatus(eyesStatusEl, 'Open', false);
    setStatus(emotionStatusEl, 'Neutral', false);
    setStatus(breathingStatusEl, 'Inactive', false);
    breathingIndicatorEl.textContent = "";
    pauseBtn.innerHTML = '<i class="fas fa-pause"></i>&nbsp;Pause';
    
    // Calculate and store session data
    calculateAndStoreSessionData();
    
    // Navigate to summary page
    navigateToSummaryPage();
    
    // Announce session stop
    const stopMsg = getVoiceCommand('sessionStopped');
    TTS.enqueue(stopMsg);
    pushVoiceHistory('Session stopped manually.');
}

// End meditation session
function endMeditationSession() {
    clearInterval(timerInterval);
    
    // Stop all voice commands when timer ends
    TTS.clear();
    
    // Stop any ongoing meditation processes
    isRunning = false;
    isPaused = false;
    
    // Stop breathing cycle
    stopBreathingCycle();
    
    // Stop background music
    pauseBackgroundMusic();
    
    // Calculate and store session data
    calculateAndStoreSessionData();
    
    // Clean up meditation session
    cleanupMeditationSession();
    
    // Navigate to summary page
    navigateToSummaryPage();
}

// Cleanup function for meditation session
function cleanupMeditationSession() {
    // Stop all voice commands
    TTS.clear();
    
    // Stop timer
    clearInterval(timerInterval);
    
    // Stop breathing cycle
    stopBreathingCycle();
    
    // Stop background music
    pauseBackgroundMusic();
    
    // Stop camera and MediaPipe
    try { 
        if (mpCamera) { 
            mpCamera.stop(); 
            mpCamera = null; 
        } 
    } catch(e){}
    
    try { 
        if (hands) { 
            hands.close(); 
            hands = null; 
        } 
    } catch(e){}
    
    try { 
        if (faceMesh) { 
            faceMesh.close(); 
            faceMesh = null; 
        } 
    } catch(e){}
    
    // Stop video stream
    try {
        const stream = videoEl.srcObject;
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            videoEl.srcObject = null;
        }
    } catch(e){}
    
    // Reset state variables
    isRunning = false;
    isPaused = false;
    breathingActive = false;
    sessionData.timerStarted = false;
    
    // Reset UI status
    setStatus(mudraStatusEl, 'Not Detected', false);
    setStatus(eyesStatusEl, 'Open', false);
    setStatus(emotionStatusEl, 'Neutral', false);
    setStatus(breathingStatusEl, 'Inactive', false);
    breathingIndicatorEl.textContent = "";
    
    // Reset pause button
    pauseBtn.innerHTML = '<i class="fas fa-pause"></i>&nbsp;Pause';
    
    // Reset timer display
    updateTimerDisplay();
    
    // Clear charts data for fresh start
    if (confidenceChart) {
        confidenceChart.data.labels = [];
        confidenceChart.data.datasets[0].data = [];
        confidenceChart.update('none');
    }
    
    if (emotionChart) {
        emotionChart.data.labels = [];
        emotionChart.data.datasets[0].data = [];
        emotionChart.update('none');
    }
}

// Wire up buttons
startBtn.addEventListener('click', startSession);
pauseBtn.addEventListener('click', pauseSession);
stopBtn.addEventListener('click', stopSession);

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    try { TTS.clear(); } catch(e){}
    try { if (mpCamera) mpCamera.stop(); } catch(e){}
    try { if (videoEl && videoEl.srcObject) { videoEl.srcObject.getTracks().forEach(t=>t.stop()); } } catch(e){}
    try { pauseBackgroundMusic(); } catch(e){}
});

// Initialize meditation charts
function initializeMeditationCharts() {
    // Confidence Chart
    const confidenceCtx = document.getElementById('confidenceChart').getContext('2d');
    confidenceChart = new Chart(confidenceCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Mudra Confidence',
                data: [],
                borderColor: '#5EEAD4',
                backgroundColor: 'rgba(94, 234, 212, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    max: 1,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#B4B4DC'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#B4B4DC'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#F0F0F0'
                    }
                }
            }
        }
    });
    
    // Emotion Chart
    const emotionCtx = document.getElementById('emotionChart').getContext('2d');
    emotionChart = new Chart(emotionCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Emotion Stability',
                data: [],
                borderColor: '#B4B4DC',
                backgroundColor: 'rgba(180, 180, 220, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    max: 1,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#B4B4DC'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#B4B4DC'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#F0F0F0'
                    }
                }
            }
        }
    });
}

// Initialize Meditation Page
function initializeMeditationPage() {
    // Clean up any existing session first
    cleanupMeditationSession();
    
    // Load settings
    const savedSettings = localStorage.getItem('meditationSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        timerSeconds = settings.sessionDuration * 60;
        originalTimerSeconds = timerSeconds; // Store the original value
        BREATHE_IN_DURATION = settings.breatheIn;
        BREATHE_OUT_DURATION = settings.breatheOut;
        BREATHING_CYCLE_DURATION = BREATHE_IN_DURATION + BREATHE_OUT_DURATION;
        
        // Update session parameters display
        sessionParamsEl.textContent = `Duration: ${settings.sessionDuration} min | Breathing: ${settings.breatheIn}s in / ${settings.breatheOut}s out`;
    }
    
    // Reset session data
    sessionData = {
        mudraAccuracy: 0,
        focusTime: 0,
        mudraData: [],
        emotionData: [],
        sessionDuration: 0,
        breathingPattern: `${BREATHE_IN_DURATION}s in / ${BREATHE_OUT_DURATION}s out`,
        mudraCorrectCount: 0,
        totalDetectionCount: 0,
        eyesClosedCount: 0,
        eyesOpenCount: 0,
        sessionStartTime: new Date(),
        timerStarted: false
    };
    
    // Reset guidance state
    mudraConfRolling = [];
    lastMudra = false;
    lastEyesClosed = false;
    lastEmotion = 'neutral';
    currentPriority = 1;
    guidanceCooldowns = [0, 0, 0, 0];
    lastGuidanceTime = 0;
    mudraStateChanged = false;
    emotionStateChanged = false;
    eyesStateChanged = false;
    lastMudraState = false;
    lastEmotionState = 'neutral';
    lastEyesState = false;
    
    // Update UI
    document.querySelectorAll('.status-value').forEach(el => {
        el.classList.add('status-warning');
        el.classList.remove('status-good');
    });
    
    // Clear voice history for fresh session
    voiceHistoryEl.innerHTML = '';
    
    // Initialize charts
    initializeMeditationCharts();
    
    // Initialize music controls
    initializeMusicControls();
    
    // Reset timer display
    updateTimerDisplay();
}

// Initialize summary page
function initializeSummaryPage() {
    // Get session data
    const meditationData = JSON.parse(localStorage.getItem('meditationData') || '{}');
    
    // Update summary statistics
    if (meditationData.sessionDuration) {
        const minutes = Math.floor(meditationData.sessionDuration / 60);
        const seconds = Math.floor(meditationData.sessionDuration % 60);
        document.getElementById('total-time').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    if (meditationData.mudraAccuracy) {
        document.getElementById('mudra-accuracy').textContent = `${meditationData.mudraAccuracy}%`;
    }
    
    if (meditationData.focusTime) {
        document.getElementById('focus-time').textContent = `${meditationData.focusTime}%`;
    }
    
    // Update session date
    const now = new Date();
    document.getElementById('session-date').textContent = 
        `Your meditation journey on ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    
    // Generate insights based on actual data
    generateInsights(meditationData);
    
    // Initialize summary charts
    initializeSummaryCharts(meditationData);
}

// Generate insights based on actual session data
function generateInsights(meditationData) {
    const insightsContainer = document.getElementById('insights-content');
    insightsContainer.innerHTML = '';
    
    // Mudra accuracy insight
    const mudraAccuracy = meditationData.mudraAccuracy || 0;
    let mudraInsight = '';
    if (mudraAccuracy >= 80) {
        mudraInsight = `<p><strong>Excellent mudra accuracy!</strong> You maintained the correct hand position for ${mudraAccuracy}% of the session.</p>`;
    } else if (mudraAccuracy >= 60) {
        mudraInsight = `<p><strong>Good job maintaining the Gyan Mudra!</strong> You held the correct hand position for ${mudraAccuracy}% of the session.</p>`;
    } else {
        mudraInsight = `<p><strong>Focus on maintaining the Gyan Mudra.</strong> You held the correct hand position for ${mudraAccuracy}% of the session. Try to keep your thumb and index finger connected throughout.</p>`;
    }
    
    // Eye state insight
    const totalEyeCount = (meditationData.eyesClosedCount || 0) + (meditationData.eyesOpenCount || 0);
    const eyesClosedPercentage = totalEyeCount > 0 ? 
        Math.round((meditationData.eyesClosedCount / totalEyeCount) * 100) : 0;
    
    let eyesInsight = '';
    if (eyesClosedPercentage >= 90) {
        eyesInsight = `<p><strong>Great focus with eyes closed!</strong> You kept your eyes closed for ${eyesClosedPercentage}% of the session.</p>`;
    } else if (eyesClosedPercentage >= 70) {
        eyesInsight = `<p><strong>Good eye focus.</strong> You kept your eyes closed for ${eyesClosedPercentage}% of the session.</p>`;
    } else {
        eyesInsight = `<p><strong>Try to keep your eyes closed throughout.</strong> You opened your eyes ${meditationData.eyesOpenCount || 0} times during this session.</p>`;
    }
    
    // Focus time insight
    const focusTime = Math.min(95, meditationData.focusTime) || 0;
    let focusInsight = '';
    if (focusTime >= 90) {
        focusInsight = `<p><strong>Excellent focus throughout the session!</strong> You maintained focus for ${focusTime}% of the time.</p>`;
    } else if (focusTime >= 70) {
        focusInsight = `<p><strong>Good focus overall.</strong> You maintained focus for ${focusTime}% of the session.</p>`;
    } else {
        focusInsight = `<p><strong>Work on maintaining focus.</strong> You were focused for ${focusTime}% of the session. Try to minimize distractions.</p>`;
    }
    
    // Next session goal
    let nextGoal = '';
    if (mudraAccuracy < 70) {
        nextGoal = `<p><strong>Next session goal:</strong> Aim for 70% mudra accuracy.</p>`;
    } else if (mudraAccuracy < 85) {
        nextGoal = `<p><strong>Next session goal:</strong> Aim for 85% mudra accuracy.</p>`;
    } else {
        nextGoal = `<p><strong>Next session goal:</strong> Try increasing your session duration by 2 minutes.</p>`;
    }
    
    // Add all insights to the container
    insightsContainer.innerHTML = `
        <div class="insight-item">${mudraInsight}</div>
        <div class="insight-item">${eyesInsight}</div>
        <div class="insight-item">${focusInsight}</div>
        <div class="insight-item">${nextGoal}</div>
    `;
}

// Initialize summary charts
function initializeSummaryCharts(meditationData) {
    // Summary Confidence Chart
    const summaryConfidenceCtx = document.getElementById('summaryConfidenceChart').getContext('2d');
    new Chart(summaryConfidenceCtx, {
        type: 'line',
        data: {
            labels: meditationData.mudraData ? 
                Array.from({length: meditationData.mudraData.length}, (_, i) => `${i+1}`) : 
                [],
            datasets: [{
                label: 'Mudra Confidence',
                data: meditationData.mudraData || [],
                borderColor: '#5EEAD4',
                backgroundColor: 'rgba(94, 234, 212, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    max: 1,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#B4B4DC'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#B4B4DC'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#F0F0F0'
                    }
                }
            }
        }
    });
    
    // Summary Emotion Chart
    const summaryEmotionCtx = document.getElementById('summaryEmotionChart').getContext('2d');
    new Chart(summaryEmotionCtx, {
        type: 'line',
        data: {
            labels: meditationData.emotionData ? 
                Array.from({length: meditationData.emotionData.length}, (_, i) => `${i+1}`) : 
                [],
            datasets: [{
                label: 'Emotion Stability',
                data: meditationData.emotionData || [],
                borderColor: '#B4B4DC',
                backgroundColor: 'rgba(180, 180, 220, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    max: 1,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#B4B4DC'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#B4B4DC'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#F0F0F0'
                    }
                }
            }
        }
    });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    
    // Initialize summary charts if on summary page
    if (document.getElementById('summary').classList.contains('active')) {
        initializeSummaryPage();
    }
    
    // Add event listener for "Meditate Again" button
    meditateAgainBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Clear any existing voice commands and cleanup
        cleanupMeditationSession();
        
        // Navigate to meditation page
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById('meditation').classList.add('active');
        
        // Update nav links
        document.querySelectorAll('.nav-links a').forEach(navLink => {
            navLink.classList.remove('active');
        });
        document.querySelector('.nav-links a[data-page="meditation"]').classList.add('active');
        
        // Initialize meditation page with fresh start
        initializeMeditationPage();
    });
});