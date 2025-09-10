// script.js - Adjusted per request, fixing ghosting and misalignment
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const offscreenCanvas = document.createElement('canvas'); // Off-screen for landmarks
const offscreenCtx = offscreenCanvas.getContext('2d'); // Only off-screen context for landmarks
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const info = document.getElementById('info');
const translationBox = document.getElementById('translation-box');

let camera;
let hands;
let animationId;
let frameCount = 0;
let lastDetectionTime = 0;

startBtn.addEventListener('click', async () => {
    videoElement.addEventListener('loadedmetadata', () => {
        // Match canvas and off-screen to video dimensions exactly
        const width = Math.min(videoElement.videoWidth, 640);
        const height = width * (videoElement.videoHeight / videoElement.videoWidth);
        canvasElement.width = width;
        offscreenCanvas.width = width;
        canvasElement.height = height;
        offscreenCanvas.height = height;
        console.log(`Canvas synced to video: ${width}x${height}`);
        videoElement.style.transform = 'scaleX(-1)'; // Flip video
        document.getElementById('offscreen-canvas')?.remove();
        document.body.appendChild(offscreenCanvas); // Keep off-screen canvas
    });

    camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 480, // Reduced for PC performance
        height: 360, // Reduced for PC performance
        facingMode: 'user',
        frameRate: { ideal: 15 } // Lowered to reduce lag
    });

    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({
        maxNumHands: 1, // Limit to 1 hand to avoid multi-duplication
        modelComplexity: 0, // Lower complexity for faster detection
        minDetectionConfidence: 0.3,
        minTrackingConfidence: 0.3
    });
    hands.onResults(onResults);

    try {
        await camera.start();
        console.log('Camera and Hands initialized');
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        videoElement.style.display = 'none';
        canvasElement.style.display = 'block';
        renderLoop();
    } catch (error) {
        console.error('Error starting camera:', error);
        info.textContent = 'Error: ' + error.message;
    }
});

stopBtn.addEventListener('click', () => {
    if (animationId) cancelAnimationFrame(animationId);
    if (camera) camera.stop();
    if (hands) hands.close();
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    videoElement.style.display = 'none';
    canvasElement.style.display = 'none';
    info.textContent = 'Hands Detected: 0';
    translationBox.textContent = 'Translation: No gesture detected';
});

function renderLoop() {
    animationId = requestAnimationFrame(renderLoop);
    frameCount++;
    if (frameCount % 30 === 0) console.log(`Frame count: ${frameCount}`); // Monitor performance
    const ctx = canvasElement.getContext('2d'); // Re-initialize ctx per frame to avoid global state
    ctx.save();
    ctx.resetTransform(); // Fully reset transformation
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height); // Clear all
    if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    }
    ctx.restore();

    // Copy landmarks only if recent detection
    if (Date.now() - lastDetectionTime < 500) { // 0.5-second timeout
        ctx.drawImage(offscreenCanvas, 0, 0);
    } else {
        offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height); // Clear stale
    }
}

function onResults(results) {
    lastDetectionTime = Date.now();
    offscreenCtx.save();
    offscreenCtx.resetTransform(); // Reset off-screen transformation
    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height); // Clear before draw
    offscreenCtx.scale(-1, 1); // Flip for video inversion
    if (results.multiHandLandmarks && results.multiHandedness) {
        console.log(`Hands detected: ${results.multiHandLandmarks.length}, Time: ${lastDetectionTime}`);
        const landmarks = results.multiHandLandmarks[0]; // Single hand
        const handedness = results.multiHandedness[0].label;

        const lineColor = handedness === 'Left' ? '#00FF00' : '#0000FF';
        drawConnectors(offscreenCtx, landmarks, HAND_CONNECTIONS, { color: lineColor, lineWidth: 5 });
        drawLandmarks(offscreenCtx, landmarks, { color: lineColor, lineWidth: 2, radius: 5 });

        info.textContent = `${handedness} Hand detected`;
        translationBox.textContent = `Translation: Gesture 1 - Add FSL database`;
    } else {
        console.log('No hands detected');
        info.textContent = 'Hands Detected: 0 - Show your hand clearly';
        translationBox.textContent = 'Translation: No gesture detected';
    }
    offscreenCtx.restore();
}
