// script.js - Fixed sync, no duplication, video flip, translation box, mobile compatibility
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const ctx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const info = document.getElementById('info');
const translationBox = document.getElementById('translation-box');

let camera;
let hands;
let animationId; // For frame syncing

startBtn.addEventListener('click', async () => {
    // Dynamic canvas sizing after video loads
    videoElement.addEventListener('loadedmetadata', () => {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        console.log(`Canvas synced to video: ${canvasElement.width}x${canvasElement.height}`);
        videoElement.style.transform = 'scaleX(-1)'; // Flip video feed
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
        maxNumHands: 1, // Limit to 1 hand to avoid duplication
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
        videoElement.style.display = 'none'; // Hide video, use canvas only
        canvasElement.style.display = 'block';
        renderLoop(); // Start synced rendering loop
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

// Synced rendering loop to prevent duplication
function renderLoop() {
    animationId = requestAnimationFrame(renderLoop);
    // Draw the current frame only (no accumulation)
    ctx.save();
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height); // Full clear each frame
    if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    }
    ctx.restore();
}

function onResults(results) {
    // Draw landmarks on the current frame only
    ctx.save();
    ctx.scale(-1, 1); // Flip for video inversion
    ctx.drawImage(results.image, -canvasElement.width, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandedness) {
        console.log(`Hands detected: ${results.multiHandLandmarks.length}`);
        const landmarks = results.multiHandLandmarks[0]; // Single hand
        const handedness = results.multiHandedness[0].label;

        const lineColor = handedness === 'Left' ? '#00FF00' : '#0000FF';
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: lineColor, lineWidth: 5 });
        drawLandmarks(ctx, landmarks, { color: lineColor, lineWidth: 2, radius: 5 });

        let centerX = 0, centerY = 0;
        landmarks.forEach(lm => {
            centerX += lm.x * canvasElement.width;
            centerY += lm.y * canvasElement.height;
        });
        centerX /= landmarks.length;
        centerY /= landmarks.length;

        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        landmarks.forEach((lm, i) => {
            const x = lm.x * canvasElement.width;
            const y = lm.y * canvasElement.height;
            ctx.beginPath();
            ctx.moveTo(-centerX, centerY);
            ctx.lineTo(-x, y);
            ctx.stroke();

            const angle = Math.atan2(y - centerY, -x - centerX);
            ctx.save();
            ctx.fillStyle = '#FF0000';
            ctx.translate(-x, y);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-10, 5);
            ctx.lineTo(-10, -5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            ctx.fillStyle = '#FFFFFF';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(i.toString(), -x, y - 10);
        });
        ctx.setLineDash([]);

        info.textContent = `${handedness} Hand detected`;
        translationBox.textContent = `Translation: Gesture 1 - Add FSL database`;
    } else {
        console.log('No hands detected');
        info.textContent = 'Hands Detected: 0 - Show your hand clearly';
        translationBox.textContent = 'Translation: No gesture detected';
    }
    ctx.restore();
}
