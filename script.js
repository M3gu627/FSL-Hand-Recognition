// script.js - Fixed version with proper canvas context initialization
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const info = document.getElementById('info');
const translationBox = document.getElementById('translation-box');

let camera;
let hands;
let animationId;
let isRunning = false;
let lastDetectionTime = 0;
let currentLandmarks = null;
let currentHandedness = null;

// Initialize canvas context immediately
let ctx = canvasElement.getContext('2d');

startBtn.addEventListener('click', async () => {
    try {
        // Ensure canvas context is available
        if (!ctx) {
            ctx = canvasElement.getContext('2d');
        }
        
        // Initialize MediaPipe Hands
        hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        
        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1, // Balanced performance
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        hands.onResults(onResults);

        // Initialize Camera
        camera = new Camera(videoElement, {
            onFrame: async () => {
                if (isRunning && hands) {
                    await hands.send({ image: videoElement });
                }
            },
            width: 640,
            height: 480,
            facingMode: 'user'
        });

        // Set up video event listener
        videoElement.addEventListener('loadedmetadata', () => {
            const width = videoElement.videoWidth || 640;
            const height = videoElement.videoHeight || 480;
            
            // Set canvas dimensions to match video
            canvasElement.width = width;
            canvasElement.height = height;
            
            console.log(`Canvas dimensions set to: ${width}x${height}`);
        });

        // Set initial canvas dimensions in case video metadata isn't available yet
        canvasElement.width = 640;
        canvasElement.height = 480;

        await camera.start();
        
        isRunning = true;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        canvasElement.style.display = 'block';
        
        // Start render loop
        renderLoop();
        
        console.log('Camera and Hands initialized successfully');
        
    } catch (error) {
        console.error('Error starting camera:', error);
        info.textContent = 'Error: ' + error.message;
        resetUI();
    }
});

stopBtn.addEventListener('click', () => {
    stopDetection();
});

function stopDetection() {
    isRunning = false;
    
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    if (camera) {
        camera.stop();
        camera = null;
    }
    
    if (hands) {
        hands.close();
        hands = null;
    }
    
    resetUI();
}

function resetUI() {
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    canvasElement.style.display = 'none';
    info.textContent = 'Hands Detected: 0';
    
    // Remove translation box if it exists
    if (translationBox) {
        translationBox.textContent = 'Translation: No gesture detected';
    }
    
    // Clear canvas with proper context check
    if (ctx && canvasElement.width && canvasElement.height) {
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }
}

function renderLoop() {
    if (!isRunning) return;
    
    animationId = requestAnimationFrame(renderLoop);
    
    // Check if context and video are ready
    if (!ctx || !videoElement || videoElement.readyState < videoElement.HAVE_CURRENT_DATA) {
        return;
    }
    
    // Ensure canvas has dimensions
    if (!canvasElement.width || !canvasElement.height) {
        return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Draw video frame (flipped horizontally for mirror effect)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvasElement.width, 0);
    ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    ctx.restore();
    
    // Draw hand landmarks if available and recent
    if (currentLandmarks && (Date.now() - lastDetectionTime < 1000)) {
        drawHandLandmarks();
    }
}

function onResults(results) {
    if (!isRunning) return;
    
    lastDetectionTime = Date.now();
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        currentLandmarks = results.multiHandLandmarks[0];
        currentHandedness = results.multiHandedness[0].label;
        
        info.textContent = `${currentHandedness} Hand detected`;
        
        if (translationBox) {
            translationBox.textContent = `Translation: ${currentHandedness} hand gesture detected`;
        }
        
        console.log(`Hand detected: ${currentHandedness}`);
    } else {
        // Clear landmarks after a delay to avoid flickering
        setTimeout(() => {
            if (Date.now() - lastDetectionTime > 500) {
                currentLandmarks = null;
                currentHandedness = null;
                info.textContent = 'Show your hand clearly';
                
                if (translationBox) {
                    translationBox.textContent = 'Translation: No gesture detected';
                }
            }
        }, 300);
    }
}

function drawHandLandmarks() {
    if (!currentLandmarks || !ctx || !canvasElement.width || !canvasElement.height) return;
    
    const landmarks = currentLandmarks;
    const color = currentHandedness === 'Left' ? '#00FF00' : '#0000FF';
    
    // Adjust coordinates for flipped canvas
    const adjustedLandmarks = landmarks.map(landmark => ({
        x: (1 - landmark.x) * canvasElement.width,  // Flip X coordinate
        y: landmark.y * canvasElement.height
    }));
    
    // Draw connections
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Hand connections (simplified version)
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],        // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8],        // Index finger
        [9, 10], [10, 11], [11, 12],           // Middle finger
        [13, 14], [14, 15], [15, 16],          // Ring finger
        [17, 18], [18, 19], [19, 20],          // Pinky
        [0, 17], [5, 9], [9, 13], [13, 17]     // Palm
    ];
    
    connections.forEach(([start, end]) => {
        if (adjustedLandmarks[start] && adjustedLandmarks[end]) {
            ctx.moveTo(adjustedLandmarks[start].x, adjustedLandmarks[start].y);
            ctx.lineTo(adjustedLandmarks[end].x, adjustedLandmarks[end].y);
        }
    });
    
    ctx.stroke();
    
    // Draw landmarks
    ctx.fillStyle = color;
    adjustedLandmarks.forEach((landmark, index) => {
        ctx.beginPath();
        ctx.arc(landmark.x, landmark.y, 4, 0, 2 * Math.PI);
        ctx.fill();
    });
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRunning) {
        stopDetection();
    }
});

// Handle beforeunload to clean up resources
window.addEventListener('beforeunload', () => {
    if (isRunning) {
        stopDetection();
    }
});
