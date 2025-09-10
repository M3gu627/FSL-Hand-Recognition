// script.js - Fixed version with proper canvas context initialization
document.addEventListener("DOMContentLoaded", () => {
    const videoElement = document.getElementById('video');
    const canvasElement = document.getElementById('canvas');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const info = document.getElementById('info');
    const translationBox = document.getElementById('translation-box');

    let ctx = canvasElement.getContext('2d'); // initialize after DOM is ready
    let camera;
    let hands;
    let animationId;
    let isRunning = false;
    let lastDetectionTime = 0;
    let currentLandmarks = null;
    let currentHandedness = null;

    startBtn.addEventListener('click', async () => {
        try {
            if (!ctx) ctx = canvasElement.getContext('2d'); // double check ctx

            // Initialize MediaPipe Hands
            hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            hands.setOptions({
                maxNumHands: 1,
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

        if (currentLandmarks && (Date.now() - lastDetectionTime < 1000)) {
            drawHandLandmarks();
        }
    }

    function onResults(results) {
        if (!isRunning) return;
        lastDetectionTime = Date.now();

        if (results.multiHandLandmarks?.length > 0) {
            currentLandmarks = results.multiHandLandmarks[0];
            currentHandedness = results.multiHandedness[0].label;
            info.textContent = `${currentHandedness} Hand detected`;
            if (translationBox) translationBox.textContent = `Translation: ${currentHandedness} hand gesture detected`;
        } else {
            setTimeout(() => {
                if (Date.now() - lastDetectionTime > 500) {
                    currentLandmarks = null;
                    currentHandedness = null;
                    info.textContent = 'Show your hand clearly';
                    if (translationBox) translationBox.textContent = 'Translation: No gesture detected';
                }
            }, 300);
        }
    }

    function drawHandLandmarks() {
        if (!currentLandmarks || !ctx) return;

        const color = currentHandedness === 'Left' ? '#00FF00' : '#0000FF';
        const adjustedLandmarks = currentLandmarks.map(p => ({
            x: (1 - p.x) * canvasElement.width,
            y: p.y * canvasElement.height
        }));

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [9, 10], [10, 11], [11, 12],
            [13, 14], [14, 15], [15, 16],
            [17, 18], [18, 19], [19, 20],
            [0, 17], [5, 9], [9, 13], [13, 17]
        ];

        connections.forEach(([s, e]) => {
            if (adjustedLandmarks[s] && adjustedLandmarks[e]) {
                ctx.moveTo(adjustedLandmarks[s].x, adjustedLandmarks[s].y);
                ctx.lineTo(adjustedLandmarks[e].x, adjustedLandmarks[e].y);
            }
        });

        ctx.stroke();

        ctx.fillStyle = color;
        adjustedLandmarks.forEach(p => {
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
