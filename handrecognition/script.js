const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const info = document.getElementById('info');

let camera;
let hands;

startBtn.addEventListener('click', async () => {
    // Set canvas size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Initialize Camera
    camera = new Camera(video, {
        onFrame: async () => {
            await hands.send({ image: video });
        },
        width: 640,
        height: 480
    });

    // Initialize Hands
    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });
    hands.setOptions({
        maxNumHands: 2,  // Detect up to 2 hands
        modelComplexity: 1,  // Higher = more accurate but slower
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    hands.onResults(onResults);

    // Start camera
    await camera.start();
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    video.style.display = 'block';
    canvas.style.display = 'block';
});

stopBtn.addEventListener('click', () => {
    camera.stop();
    hands.close();
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    video.style.display = 'none';
    canvas.style.display = 'none';
    info.textContent = 'Hands Detected: 0';
});

function onResults(results) {
    // Clear canvas
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandedness) {
        // Draw landmarks and connections for each hand
        for (let index = 0; index < results.multiHandLandmarks.length; index++) {
            const landmarks = results.multiHandLandmarks[index];
            drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 3});
            drawLandmarks(ctx, landmarks, {color: '#FF0000', lineWidth: 1, radius: 3});

            // Update info
            info.textContent = `Hands Detected: ${results.multiHandLandmarks.length}`;
        }
    } else {
        info.textContent = 'Hands Detected: 0';
    }
    ctx.restore();
}