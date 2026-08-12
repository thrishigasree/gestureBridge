// Global Application State
const state = {
  activePage: 'landing',
  webcamActive: false,
  stream: null,
  signDetected: false,
  confidence: 0,
  fps: 0,
  currentSentence: '',
  detectedTokens: [],
  speechRate: 1.0,
  speechVolume: 0.8,
  
  // Custom tracking for demo session statistics
  totalTranslationsCount: 1248,
  accuracyHistory: [94.5, 95.8, 96.2, 94.8, 96.7, 95.1, 96.2],
  translationVolumeHistory: [110, 145, 132, 168, 189, 210, 294],
  
  // Hand Joint Landmark Animation Coordinates (Idle state)
  handJoints: [],
  isSimulatingAnimation: false,
  animationProgress: 0,
  targetJoints: null,
  mousePosition: { x: 320, y: 180 } // default center of 640x360 canvas
};

// Common Phrases Configuration for Simulator
const gestureLibrary = {
  hello: {
    tokens: ["H-E-L-L-O"],
    sentence: "Hello, how can I help you today?",
    confidence: 98.4,
    pose: 'wave'
  },
  thank_you: {
    tokens: ["T-H-A-N-K", "Y-O-U"],
    sentence: "Thank you very much for your assistance.",
    confidence: 96.2,
    pose: 'flat-out'
  },
  please: {
    tokens: ["P-L-E-A-S-E"],
    sentence: "Please give me a moment.",
    confidence: 95.7,
    pose: 'chest-circle'
  },
  help: {
    tokens: ["H-E-L-P"],
    sentence: "I need immediate help, please.",
    confidence: 99.1,
    pose: 'thumbs-up'
  },
  medicine: {
    tokens: ["M-E-D-I-C-I-N-E"],
    sentence: "I need my medicine.",
    confidence: 98.0,
    pose: 'chest-circle'
  },
  goodbye: {
    tokens: ["G-O-O-D", "B-Y-E"],
    sentence: "Goodbye, have a wonderful day!",
    confidence: 94.6,
    pose: 'wave-bye'
  },
  need_water: {
    tokens: ["N-E-E-D", "W-A-T-E-R"],
    sentence: "Could you please get me some water?",
    confidence: 95.2,
    pose: 'drinking'
  }
};

// Chart Instance variables
let activityChart = null;

// ==================== ROUTING SYSTEM ====================
function navigateTo(pageId) {
  // Hide all sections
  document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  
  // Show target section
  const targetPage = document.getElementById(`${pageId}-page`);
  const targetLink = document.getElementById(`nav-${pageId}`);
  
  if (targetPage) {
    targetPage.classList.add('active');
    state.activePage = pageId;
  }
  if (targetLink) {
    targetLink.classList.add('active');
  }
  
  // Load/resize charts if entering analytics page
  if (pageId === 'analytics') {
    setTimeout(initializeAnalyticsCharts, 100);
  }
  
  // Mirror webcam to chat page if webcam is active
  const chatVideoEl = document.getElementById('chat-webcam');
  const chatPlaceholder = document.getElementById('chat-camera-placeholder');
  const chatCamStatus = document.getElementById('chat-cam-status');
  const chatCamStatusText = document.getElementById('chat-cam-status-text');
  
  if (chatVideoEl) {
    if (state.webcamActive && state.stream) {
      chatVideoEl.srcObject = state.stream;
      if (chatPlaceholder) chatPlaceholder.classList.add('hidden');
      if (chatCamStatus) {
        chatCamStatus.classList.add('active');
        chatCamStatus.style.background = 'rgba(16, 185, 129, 0.1)';
        chatCamStatus.style.color = 'var(--accent-green)';
      }
      if (chatCamStatusText) chatCamStatusText.textContent = "Active";
    } else {
      chatVideoEl.srcObject = null;
      if (chatPlaceholder) chatPlaceholder.classList.remove('hidden');
      if (chatCamStatus) {
        chatCamStatus.classList.remove('active');
        chatCamStatus.style.background = '';
        chatCamStatus.style.color = '';
      }
      if (chatCamStatusText) chatCamStatusText.textContent = "Inactive";
    }
  }
  
  // Smooth scroll to top of viewport
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== WEBCAM & GRAPHICS ====================
const videoEl = document.getElementById('webcam');
const canvasEl = document.getElementById('landmarks-canvas');
const ctx = canvasEl.getContext('2d');

// Initialize dummy skeletal hand nodes
function initHandMesh() {
  state.handJoints = [];
  const wrist = { x: 320, y: 300, vx: 0, vy: 0 };
  state.handJoints.push(wrist); // 0 (Wrist)
  
  // Thumb (1, 2, 3, 4)
  for (let i = 1; i <= 4; i++) {
    state.handJoints.push({ x: 260 + i*10, y: 280 - i*15, vx: 0, vy: 0 });
  }
  // Index (5, 6, 7, 8)
  for (let i = 1; i <= 4; i++) {
    state.handJoints.push({ x: 290 + i*5, y: 240 - i*20, vx: 0, vy: 0 });
  }
  // Middle (9, 10, 11, 12)
  for (let i = 1; i <= 4; i++) {
    state.handJoints.push({ x: 320, y: 220 - i*22, vx: 0, vy: 0 });
  }
  // Ring (13, 14, 15, 16)
  for (let i = 1; i <= 4; i++) {
    state.handJoints.push({ x: 350 - i*5, y: 240 - i*20, vx: 0, vy: 0 });
  }
  // Pinky (17, 18, 19, 20)
  for (let i = 1; i <= 4; i++) {
    state.handJoints.push({ x: 380 - i*10, y: 260 - i*17, vx: 0, vy: 0 });
  }
}

// Listen for cursor position over canvas to track
canvasEl.addEventListener('mousemove', (e) => {
  if (!state.webcamActive) return;
  const rect = canvasEl.getBoundingClientRect();
  // Adjust coordinate ratio (640x360 scale)
  state.mousePosition.x = ((e.clientX - rect.left) / rect.width) * canvasEl.width;
  state.mousePosition.y = ((e.clientY - rect.top) / rect.height) * canvasEl.height;
});

canvasEl.addEventListener('mouseenter', () => {
  if (!state.webcamActive || state.isSimulatingAnimation) return;
  state.signDetected = true;
  updateHandDetectionUI(true);
});

canvasEl.addEventListener('mouseleave', () => {
  if (!state.webcamActive || state.isSimulatingAnimation) return;
  state.signDetected = false;
  updateHandDetectionUI(false);
});

function updateHandDetectionUI(detected) {
  const badge = document.getElementById('sign-status-badge');
  const badgeText = document.getElementById('sign-status-text');
  if (badge && badgeText) {
    if (detected) {
      badge.classList.add('active');
      badgeText.textContent = "Hand Detected";
      badge.style.background = 'rgba(16, 185, 129, 0.1)';
      badge.style.color = 'var(--accent-green)';
    } else {
      badge.classList.remove('active');
      badgeText.textContent = "Searching Hand...";
      badge.style.background = 'rgba(239, 68, 68, 0.1)';
      badge.style.color = 'var(--accent-red)';
    }
  }
}

// Start user webcam
function startWebcam() {
  const constraints = {
    video: { width: 640, height: 360, facingMode: "user" }
  };
  
  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      state.stream = stream;
      videoEl.srcObject = stream;
      state.webcamActive = true;
      document.getElementById('camera-placeholder').classList.add('hidden');
      
      // Update camera status badge
      const camBadge = document.getElementById('camera-status-badge');
      const camBadgeText = document.getElementById('camera-status-text');
      if (camBadge && camBadgeText) {
        camBadge.classList.add('active');
        camBadgeText.textContent = "Camera Active";
        camBadge.style.background = 'rgba(16, 185, 129, 0.1)';
        camBadge.style.color = 'var(--accent-green)';
      }
      
      // Update hand status badge
      updateHandDetectionUI(false); // start in searching state
      
      // Setup canvas size
      canvasEl.width = 640;
      canvasEl.height = 360;
      
      // Initialize skeleton points and start rendering loop
      initHandMesh();
      requestAnimationFrame(renderLoop);
      
      // Start FPS simulation counter
      startFpsCounter();
    })
    .catch(err => {
      console.error("Camera access denied or unavailable: ", err);
      alert("Unable to open camera. Falling back to layout simulation. Hover on screen to interact with skeletal mesh.");
      
      // Fallback: simulate camera screen anyway
      state.webcamActive = true;
      document.getElementById('camera-placeholder').classList.add('hidden');
      
      // Update camera status badge
      const camBadge = document.getElementById('camera-status-badge');
      const camBadgeText = document.getElementById('camera-status-text');
      if (camBadge && camBadgeText) {
        camBadge.classList.add('active');
        camBadgeText.textContent = "Simulating Feed";
        camBadge.style.background = 'rgba(6, 182, 212, 0.1)';
        camBadge.style.color = 'var(--accent-cyan)';
      }
      
      // Update hand status badge
      updateHandDetectionUI(false);
      
      canvasEl.width = 640;
      canvasEl.height = 360;
      initHandMesh();
      requestAnimationFrame(renderLoop);
      startFpsCounter();
    });
}

function startFpsCounter() {
  setInterval(() => {
    if (state.webcamActive) {
      // Simulate slight variability in processing time (28-30 FPS)
      state.fps = Math.floor(28 + Math.random() * 3);
      document.getElementById('fps-value').textContent = `${state.fps} FPS`;
    }
  }, 1000);
}

// Rendering Loop (Draw Webcam Canvas + Hand Landmarks Overlay)
function renderLoop() {
  if (!state.webcamActive) return;
  
  updateHandLandmarks();
  
  // Render on Dashboard canvas
  if (state.activePage === 'dashboard') {
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    if (!videoEl.srcObject) {
      ctx.fillStyle = '#060a15';
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
    }
    drawHandMesh(ctx, canvasEl);
  }
  
  // Render on Chat canvas
  if (state.activePage === 'chat') {
    const chatCanvas = document.getElementById('chat-landmarks-canvas');
    if (chatCanvas) {
      const chatCtx = chatCanvas.getContext('2d');
      chatCanvas.width = 640;
      chatCanvas.height = 480;
      chatCtx.clearRect(0, 0, chatCanvas.width, chatCanvas.height);
      const chatVideo = document.getElementById('chat-webcam');
      if (!chatVideo || !chatVideo.srcObject) {
        chatCtx.fillStyle = '#060a15';
        chatCtx.fillRect(0, 0, chatCanvas.width, chatCanvas.height);
      }
      drawHandMesh(chatCtx, chatCanvas, true);
    }
  }
  
  requestAnimationFrame(renderLoop);
}

// Landmark Node Physics & Movements
function updateHandLandmarks() {
  const wrist = state.handJoints[0];
  let targetX = state.mousePosition.x;
  let targetY = state.mousePosition.y;
  
  // If simulating a gesture animation, move nodes towards gesture keyframes
  if (state.isSimulatingAnimation) {
    animateGestureFrame();
    return;
  }
  
  // Smoothly lag wrist coordinate behind target (cursor)
  wrist.x += (targetX - wrist.x) * 0.15;
  wrist.y += (targetY - wrist.y) * 0.15;
  
  // Propagate offsets from wrist to other fingers with idle floating noise
  const time = Date.now() * 0.003;
  const floatX = Math.sin(time) * 1.5;
  const floatY = Math.cos(time) * 1.5;
  
  // Finger Joint Offsets relative to Wrist
  const offsets = [
    { idx: [1, 2, 3, 4], dx: -45, dy: -25, spacingY: -20, spacingX: 12 }, // Thumb
    { idx: [5, 6, 7, 8], dx: -20, dy: -60, spacingY: -26, spacingX: 4 },  // Index
    { idx: [9, 10, 11, 12], dx: 5, dy: -70, spacingY: -28, spacingX: 0 }, // Middle
    { idx: [13, 14, 15, 16], dx: 30, dy: -60, spacingY: -26, spacingX: -4 }, // Ring
    { idx: [17, 18, 19, 20], dx: 55, dy: -40, spacingY: -20, spacingX: -10 } // Pinky
  ];
  
  offsets.forEach(finger => {
    finger.idx.forEach((jointId, jointSeq) => {
      const joint = state.handJoints[jointId];
      const factor = (jointSeq + 1);
      
      const targetJointX = wrist.x + finger.dx + (finger.spacingX * factor) + floatX * (jointSeq + 1);
      const targetJointY = wrist.y + finger.dy + (finger.spacingY * factor) + floatY * (jointSeq + 1);
      
      joint.x += (targetJointX - joint.x) * (0.2 - jointSeq * 0.03);
      joint.y += (targetJointY - joint.y) * (0.2 - jointSeq * 0.03);
    });
  });
}

// Drawing lines and nodes
function drawHandMesh(drawCtx, drawCanvas, isChat = false) {
  drawCtx.lineWidth = 2.5;
  drawCtx.strokeStyle = 'rgba(139, 92, 246, 0.75)'; // Soft purple skeletal connections
  drawCtx.shadowBlur = 6;
  drawCtx.shadowColor = '#8b5cf6';
  
  // Define Finger Connections
  const fingerChains = [
    [0, 1, 2, 3, 4], // Thumb
    [0, 5, 6, 7, 8], // Index
    [5, 9, 10, 11, 12], // Connect index base to middle, and draw middle finger
    [9, 13, 14, 15, 16], // Connect middle base to ring, draw ring
    [13, 17, 18, 19, 20], // Connect ring base to pinky, draw pinky
    [0, 17] // Wrist to pinky base
  ];
  
  const dyOffset = isChat ? 50 : 0;
  
  // Draw Connection Lines
  fingerChains.forEach(chain => {
    drawCtx.beginPath();
    drawCtx.moveTo(state.handJoints[chain[0]].x, state.handJoints[chain[0]].y + dyOffset);
    for (let i = 1; i < chain.length; i++) {
      drawCtx.lineTo(state.handJoints[chain[i]].x, state.handJoints[chain[i]].y + dyOffset);
    }
    drawCtx.stroke();
  });
  
  // Draw glowing cyan joints
  drawCtx.shadowBlur = 10;
  drawCtx.shadowColor = '#06b6d4';
  drawCtx.fillStyle = '#22d3ee';
  
  state.handJoints.forEach((joint, i) => {
    drawCtx.beginPath();
    const radius = (i === 0 || i % 4 === 0) ? 5.5 : 4;
    drawCtx.arc(joint.x, joint.y + dyOffset, radius, 0, 2 * Math.PI);
    drawCtx.fill();
    
    // Joint ID visual overlay (small text)
    if (i % 4 === 0 && i > 0) {
      drawCtx.font = '8px monospace';
      drawCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      drawCtx.fillText(`Tip_${i}`, joint.x + 8, joint.y + dyOffset - 4);
    }
  });
  
  // Draw tracking box boundary around mesh
  drawCtx.shadowBlur = 0;
  drawCtx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
  drawCtx.setLineDash([4, 4]);
  drawCtx.strokeRect(30, 20 + dyOffset, drawCanvas.width - 60, drawCanvas.height - 80);
  drawCtx.setLineDash([]);
  
  drawCtx.font = '10px monospace';
  drawCtx.fillStyle = '#06b6d4';
  drawCtx.fillText("TRACKING: HAND_01 (STABLE)", 40, 40 + dyOffset);
}

// Generate animated keyframe states for gesture simulation
function simulateGesture(gestureId) {
  if (!state.webcamActive) {
    alert("Please enable the webcam capture feed first.");
    return;
  }
  
  const target = gestureLibrary[gestureId];
  if (!target) return;
  
  // Trigger landmarker animation parameters
  state.isSimulatingAnimation = true;
  state.animationProgress = 0;
  state.detectedTokens = [];
  
  // Display processing loader
  const procAnim = document.getElementById('processing-animation');
  if (procAnim) procAnim.classList.remove('hidden');
  
  document.getElementById('gesture-stream-output').textContent = "Scanning...";
  document.getElementById('sentence-result-output').textContent = "Processing gesture...";
  document.getElementById('gesture-token-display').textContent = "Scanning...";
  
  // Update status badge to translating state (blue)
  const badge = document.getElementById('sign-status-badge');
  const badgeText = document.getElementById('sign-status-text');
  if (badge && badgeText) {
    badge.classList.remove('active');
    badge.style.background = 'rgba(59, 130, 246, 0.1)';
    badge.style.color = 'var(--primary)';
    badgeText.textContent = "Translating...";
  }
  
  // Custom sign configurations: simple target changes
  const wrist = state.handJoints[0];
  state.targetJoints = state.handJoints.map((joint, i) => {
    let dx = joint.x - wrist.x;
    let dy = joint.y - wrist.y;
    
    // Warp fingers depending on pose
    if (target.pose === 'wave') {
      dx *= 1.3;
      dy *= 0.8;
    } else if (target.pose === 'thumbs-up') {
      // Fold 4 fingers, extend thumb
      if (i > 4) {
        dx = (i % 4) * 3;
        dy = -10; 
      } else {
        dy = -70; // thumb up
      }
    } else if (target.pose === 'flat-out') {
      dx *= 0.6;
      dy = -110 - (i % 4) * 20; // flattened hands
    } else if (target.pose === 'chest-circle') {
      dx *= 0.8;
      dy = -80 + Math.sin(i) * 15;
    }
    
    return { x: wrist.x + dx, y: wrist.y + dy };
  });
  
  // Simulate token stream arrival
  let tokenIdx = 0;
  const tokenInterval = setInterval(() => {
    if (tokenIdx < target.tokens.length) {
      state.detectedTokens.push(target.tokens[tokenIdx]);
      document.getElementById('gesture-stream-output').innerHTML = state.detectedTokens.join(' &rarr; ');
      document.getElementById('gesture-token-display').textContent = target.tokens[tokenIdx];
      
      // Dynamic Confidence pulse
      state.confidence = Math.floor(85 + Math.random() * 10);
      updateConfidenceUI(state.confidence);
      
      tokenIdx++;
    } else {
      clearInterval(tokenInterval);
      
      // Hide loader
      if (procAnim) procAnim.classList.add('hidden');
      
      // Simulation complete - restructures sentence
      state.isSimulatingAnimation = false;
      state.confidence = target.confidence;
      state.currentSentence = target.sentence;
      
      updateConfidenceUI(state.confidence);
      document.getElementById('sentence-result-output').textContent = `"${target.sentence}"`;
      document.getElementById('gesture-token-display').textContent = "Gesture Recognized";
      
      // Restore status badge to green (active)
      if (badge && badgeText) {
        badge.style.background = '';
        badge.style.color = '';
        badge.classList.add('active');
        badgeText.textContent = "Hand Detected";
      }
      
      // Speak aloud immediately if volume is set
      speakText(target.sentence);
      
      // Save item to history list and timeline chat
      appendHistoryItem(state.detectedTokens.join(' &rarr; '), target.sentence, target.confidence);
      appendChatTimeline('deaf', target.sentence);
      
      // Increment analytics dashboard count
      state.totalTranslationsCount++;
      const totTransEl = document.getElementById('stat-total-translations');
      if (totTransEl) totTransEl.textContent = state.totalTranslationsCount.toLocaleString();
    }
  }, 800);
}

function animateGestureFrame() {
  state.animationProgress += 0.05;
  if (state.animationProgress >= 1.0) {
    state.animationProgress = 1.0;
  }
  
  // Interpolate joint nodes to simulated poses
  state.handJoints.forEach((joint, i) => {
    const target = state.targetJoints[i];
    // Wave oscillation added to give movement feedback during scanning
    const wave = Math.sin(Date.now() * 0.02) * 4;
    joint.x += (target.x + wave - joint.x) * 0.15;
    joint.y += (target.y - joint.y) * 0.15;
  });
}

function updateConfidenceUI(val) {
  const fill = document.getElementById('sentence-confidence-fill');
  const text = document.getElementById('sentence-confidence-value');
  if (fill && text) {
    fill.style.width = `${val}%`;
    text.textContent = `${val.toFixed(0)}%`;
  }
}

// Action button handlers
function copyTranslation() {
  if (!state.currentSentence) {
    alert("No translation ready to copy.");
    return;
  }
  navigator.clipboard.writeText(state.currentSentence)
    .then(() => {
      const btn = document.getElementById('btn-action-copy');
      const origText = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Copied!`;
      setTimeout(() => {
        btn.innerHTML = origText;
      }, 1500);
    })
    .catch(err => {
      console.error("Clipboard copy failed: ", err);
    });
}

function saveTranslation() {
  if (!state.currentSentence) {
    alert("No translation ready to save.");
    return;
  }
  const btn = document.getElementById('btn-action-save');
  const origText = btn.innerHTML;
  btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Saved!`;
  setTimeout(() => {
    btn.innerHTML = origText;
  }, 1500);
}

function clearTranslation() {
  state.currentSentence = '';
  state.detectedTokens = [];
  document.getElementById('gesture-stream-output').textContent = '---';
  document.getElementById('sentence-result-output').textContent = 'Awaiting translation...';
  document.getElementById('gesture-token-display').textContent = 'None';
  updateConfidenceUI(0);
}

// ==================== VOICE SYNTHESIS (TTS) ====================
function updateSpeechSetting(setting, value) {
  if (setting === 'rate') {
    state.speechRate = parseFloat(value);
    document.getElementById('rate-val-label').textContent = `${value}x`;
  } else if (setting === 'volume') {
    state.speechVolume = parseFloat(value);
    document.getElementById('volume-val-label').textContent = `${Math.round(value * 100)}%`;
  }
}

function speakCurrentSentence() {
  if (!state.currentSentence) {
    alert("No translation sentence ready to speak aloud. Click a simulation button first!");
    return;
  }
  speakText(state.currentSentence);
}

function speakText(text) {
  if (!('speechSynthesis' in window)) {
    console.warn("Speech Synthesis is not supported in this browser.");
    return;
  }
  
  // Cancel previous speeches
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = state.speechRate;
  utterance.volume = state.speechVolume;
  
  // Attempt to select a premium standard english voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Natural')) || 
                        voices.find(v => v.lang.startsWith('en'));
  
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }
  
  window.speechSynthesis.speak(utterance);
}

// Re-retrieve voices list if loaded asynchronously
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

// ==================== TWO-WAY CHAT TIMELINE ====================
function appendChatTimeline(sender, text) {
  const container = document.getElementById('chat-timeline-container');
  if (!container) return;
  
  const msgWrapper = document.createElement('div');
  msgWrapper.className = `chat-message ${sender}`;
  
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const label = sender === 'deaf' ? 'Sign Language (Deaf User)' : 'Hearing User (Typed)';
  
  const speakBtn = sender === 'deaf' ? 
    ` &bull; <button class="message-speak-btn" onclick="speakText('${text.replace(/'/g, "\\'")}')"><i class="fa-solid fa-volume-up"></i> Speak</button>` : '';

  msgWrapper.innerHTML = `
    <div class="message-bubble">${text}</div>
    <div class="message-meta">
      <span>${label}</span> &bull; <span>${timestamp}</span>${speakBtn}
    </div>
  `;
  
  container.appendChild(msgWrapper);
  
  // Scroll to bottom of chat view
  container.scrollTop = container.scrollHeight;
}

function sendHearingMessage() {
  const inputEl = document.getElementById('chat-typed-input');
  const text = inputEl.value.trim();
  if (!text) return;
  
  // Append message to timeline
  appendChatTimeline('hearing', text);
  inputEl.value = '';
  
  // Automatically read typed responses aloud (simulating deaf user listening/reading)
  speakText(text);
  
  // Simulate automated sign reply after 3 seconds for active demonstration
  setTimeout(() => {
    const responses = [
      "Alright, thank you for writing back.",
      "I appreciate your patience.",
      "Yes, I understand completely.",
      "That is correct."
    ];
    const randomReply = responses[Math.floor(Math.random() * responses.length)];
    appendChatTimeline('deaf', randomReply);
    speakText(randomReply);
  }, 3000);
}

function handleChatKeyPress(event) {
  if (event.key === 'Enter') {
    sendHearingMessage();
  }
}

// ==================== SESSION HISTORY LOGS ====================
function appendHistoryItem(gestures, sentence, confidence) {
  const container = document.getElementById('history-list-container');
  if (!container) return;
  
  const item = document.createElement('div');
  item.className = 'history-item';
  
  item.innerHTML = `
    <div class="history-meta">
      <span class="history-time">Just now</span>
      <span class="history-accuracy">${confidence.toFixed(1)}% confidence</span>
    </div>
    <div class="history-gestures">${gestures}</div>
    <div class="history-sentence-row">
      <span class="history-sentence">"${sentence}"</span>
      <button class="history-action-btn" onclick="speakText('${sentence.replace(/'/g, "\\'")}')"><i class="fa-solid fa-volume-up"></i></button>
    </div>
  `;
  
  // Insert at front of history list
  container.insertBefore(item, container.firstChild);
}

// ==================== ANALYTICS GRAPHICS ====================
function initializeAnalyticsCharts() {
  const chartCanvas = document.getElementById('activityLineChart');
  if (!chartCanvas) return;
  
  // Destroy previous instance to avoid canvas overlapping redraw issues
  if (activityChart) {
    activityChart.destroy();
  }
  
  const ctxChart = chartCanvas.getContext('2d');
  
  // Create gorgeous gradients
  const primaryGrad = ctxChart.createLinearGradient(0, 0, 0, 240);
  primaryGrad.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
  primaryGrad.addColorStop(1, 'rgba(59, 130, 246, 0.02)');

  const secondaryGrad = ctxChart.createLinearGradient(0, 0, 0, 240);
  secondaryGrad.addColorStop(0, 'rgba(139, 92, 246, 0.45)');
  secondaryGrad.addColorStop(1, 'rgba(139, 92, 246, 0.02)');
  
  activityChart = new Chart(ctxChart, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Translations volume',
          data: state.translationVolumeHistory,
          borderColor: '#3b82f6',
          borderWidth: 3,
          backgroundColor: primaryGrad,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointHoverRadius: 7
        },
        {
          label: 'Avg Accuracy (%)',
          data: state.accuracyHistory.map(v => v * 2), // scaled for dual presentation volume visibility
          borderColor: '#8b5cf6',
          borderWidth: 2,
          backgroundColor: secondaryGrad,
          fill: false,
          tension: 0.4,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#ffffff',
          borderDash: [5, 5]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { family: 'Plus Jakarta Sans', weight: '600' }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

// ==================== THEME SYSTEM ====================
function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  updateThemeIcon(isLight);
  
  // Re-draw chart to update grid colors
  if (state.activePage === 'analytics') {
    initializeAnalyticsCharts();
  }
}

function updateThemeIcon(isLight) {
  const icon = document.querySelector('#theme-toggle-btn i');
  if (icon) {
    if (isLight) {
      icon.className = 'fa-solid fa-sun';
      icon.style.color = '#eab308'; // sunny gold color
    } else {
      icon.className = 'fa-solid fa-moon';
      icon.style.color = '';
    }
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  
  if (savedTheme === 'light' || (!savedTheme && prefersLight)) {
    document.body.classList.add('light-theme');
    updateThemeIcon(true);
  } else {
    document.body.classList.remove('light-theme');
    updateThemeIcon(false);
  }
}

// Initialise Application when page loads
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  // Navigation active check
  navigateTo('landing');
});
