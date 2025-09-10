// script.js - Refined fix for ghosting and sync, video flip, translation box, mobile compatibility
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const offscreenCanvas = document.createElement('canvas'); // Off-screen canvas
const offscreenCtx = offscreenCanvas.getContext('2d');
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
        canvasElement.width = videoElement.videoWidth;
        offscreenCanvas.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        offscreenCanvas.height = videoElement.videoHeight;
        console.log(`Canvas synced to video: ${canvasElement.width}x${canvasElement.height}`);
        videoElement.style.transform = 'scaleX(-1)'; // Flip video feed
        document.getElementById('offscreen-canvas')?.remove(); // Clean up old offscreen
        document.body.appendChild(offscreenCanvas); // Add off-screen canvas
    });

    camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480,
        facingMode: 'user',
        frameRate: { ideal: 24 }
    });

    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({
        maxNumHands: 2, // Multi-hand support
        modelComplexity: 1,
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
        renderLoop(); // Start synced rendering
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
    if (frameCount % 30 === 0) console.log(`Frame count: ${frameCount}`); // Monitor frame rate
    // Clear and draw video frame
    ctx.save();
    ctx.resetTransform(); // Full reset of transformation matrix
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height); // Clear entire canvas
    if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    }
    ctx.restore();

    // Copy off-screen landmarks only if updated
    if (Date.now() - lastDetectionTime < 1000) { // Show landmarks for 1 second after last detection
        ctx.drawImage(offscreenCanvas, 0, 0);
    } else {
        offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height); // Clear old if stale
    }
}

function onResults(results) {
    lastDetectionTime = Date.now(); // Update last detection time
    // Draw landmarks on off-screen canvas
    offscreenCtx.save();
    offscreenCtx.resetTransform(); // Reset transformation
    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height); // Clear off-screen
    offscreenCtx.scale(-1, 1); // Flip for video inversion
    if (results.multiHandLandmarks && results.multiHandedness) {
        console.log(`Hands detected: ${results.multiHandLandmarks.length}, Time: ${lastDetectionTime}`);
        for (let index = 0; index < results.multiHandLandmarks.length; index++) {
            const landmarks = results.multiHandLandmarks[index];
            const handedness = results.multiHandedness[index].label;

            const lineColor = handedness === 'Left' ? '#00FF00' : '#0000FF';
            drawConnectors(offscreenCtx, landmarks, HAND_CONNECTIONS, { color: lineColor, lineWidth: 5 });
            drawLandmarks(offscreenCtx, landmarks, { color: lineColor, lineWidth: 2, radius: 5 });

            // Simplified pointers (remove for now to isolate ghosting)
            let centerX = 0, centerY = 0;
            landmarks.forEach(lm => {
                centerX += lm.x * offscreenCanvas.width;
                centerY += lm.y * offscreenCanvas.height;
            });
            centerX /= landmarks.length;
            centerY /= landmarks.length;

            offscreenCtx.strokeStyle = '#FF0000';
            offscreenCtx.lineWidth = 2;
            offscreenCtx.setLineDash([5, 5]);
            landmarks.forEach((lm, i) => {
                const x = lm.x * offscreenCanvas.width;
                const y = lm.y * offscreenCanvas.height;
                offscreenCtx.beginPath();
                offscreenCtx.moveTo(-centerX, centerY);
                offscreenCtx.lineTo(-x, y);
                offscreenCtx.stroke();
            });
            offscreenCtx.setLineDash([]);

            info.textContent = `${handedness} Hand: ${results.multiHandLandmarks.length} hands detected`;
            translationBox.textContent = `Translation: Gesture ${index + 1} - Add FSL database`;
        }
    } else {
        console.log('No hands detected');
        info.textContent = 'Hands Detected: 0 - Show your hand clearly';
        translationBox.textContent = 'Translation: No gesture detected';
    }
    offscreenCtx.restore();
}
