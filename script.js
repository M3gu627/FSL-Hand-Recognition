// script.js - Two hands support, no ghosting
document.addEventListener("DOMContentLoaded", () => {
    const videoElement = document.getElementById('video');
    const canvasElement = document.getElementById('canvas');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const info = document.getElementById('info');
    const translationBox = document.getElementById('translation-box');

    let ctx = canvasElement.getContext('2d');
    let camera;
    let hands;
    let animationId;
    let isRunning = false;
    let lastDetectionTime = 0;
    let currentLandmarks = [];
    let currentHandedness = [];

    startBtn.addEventListener('click', async () => {
        try {
            if (!ctx) ctx = canvasElement.getContext('2d');

            // Initialize MediaPipe Hands
            hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            hands.setOptions({
                maxNumHands: 2, // ✅ allow two hands
                modelComplexity: 1,
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

            videoElement.addEventListener('loadedmetadata', () => {
                canvasElement.width = videoElement.videoWidth || 640;
                canvasElement.height = videoElement.videoHeight || 480;
                console.log(`Canvas dimensions set to: ${canvasElement.width}x${canvasElement.height}`);
            });

            canvasElement.width = 640;
            canvasElement.height = 480;

            await camera.start();

            isRunning = true;
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            canvasElement.style.display = 'block';

            renderLoop();

            console.log('Camera and Hands initialized successfully');
        } catch (error) {
            console.error('Error starting camera:', error);
            info.textContent = 'Error: ' + error.message;
            resetUI();
        }
    });

    stopBtn.addEventListener('click', () => stopDetection());

    function stopDetection() {
        isRunning = false;
        if (animationId) cancelAnimationFrame(animationId);
        if (camera) camera.stop();
        if (hands) hands.close();

        camera = null;
        hands = null;
        animationId = null;

        resetUI();
    }

    function resetUI() {
        startBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
        canvasElement.style.display = 'none';
        info.textContent = 'Hands Detected: 0';
        if (translationBox) translationBox.textContent = 'Translation: No gesture detected';
        if (ctx) ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        currentLandmarks = [];
        currentHandedness = [];
    }

    function renderLoop() {
        if (!isRunning) return;
        animationId = requestAnimationFrame(renderLoop);

        if (!ctx || !videoElement || videoElement.readyState < videoElement.HAVE_CURRENT_DATA) return;

        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // Draw video (mirror effect)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvasElement.width, 0);
        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        ctx.restore();

        // Draw all hands
        if (currentLandmarks.length > 0) {
            currentLandmarks.forEach((landmarks, index) => {
                drawHandLandmarks(landmarks, currentHandedness[index]);
            });
        }
    }

    function onResults(results) {
        if (!isRunning) return;
        lastDetectionTime = Date.now();

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            currentLandmarks = results.multiHandLandmarks;
            currentHandedness = results.multiHandedness.map(h => h.label);

            info.textContent = `Hands Detected: ${results.multiHandLandmarks.length}`;

            if (translationBox) {
                translationBox.textContent =
                    `Translation: ${currentHandedness.join(", ")} gesture(s) detected`;
            }
        } else {
            // ✅ immediately clear when no hands
            currentLandmarks = [];
            currentHandedness = [];
            info.textContent = 'No hands detected';
            if (translationBox) translationBox.textContent = 'Translation: No gesture detected';
        }
    }

    function drawHandLandmarks(landmarks, handedness) {
        if (!landmarks || !ctx) return;

        const color = handedness === 'Left' ? '#00FF00' : '#0000FF';

        // Flip X coordinates for mirrored canvas
        const adjusted = landmarks.map(p => ({
            x: (1 - p.x) * canvasElement.width,
            y: p.y * canvasElement.height
        }));

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],        // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],        // Index finger
            [9, 10], [10, 11], [11, 12],           // Middle finger
            [13, 14], [14, 15], [15, 16],          // Ring finger
            [17, 18], [18, 19], [19, 20],          // Pinky
            [0, 17], [5, 9], [9, 13], [13, 17]     // Palm
        ];

        connections.forEach(([s, e]) => {
            if (adjusted[s] && adjusted[e]) {
                ctx.moveTo(adjusted[s].x, adjusted[s].y);
                ctx.lineTo(adjusted[e].x, adjusted[e].y);
            }
        });

        ctx.stroke();

        ctx.fillStyle = color;
        adjusted.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isRunning) stopDetection();
    });

    window.addEventListener('beforeunload', () => {
        if (isRunning) stopDetection();
    });
});
