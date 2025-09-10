// script.js - Full code with fallback to fix inverted camera, mobile compatibility, and clarity
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const ctx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const info = document.getElementById('info');

let camera;
let hands;

startBtn.addEventListener('click', async () => {
    // Dynamic canvas sizing after video loads, adjusted for mobile
    videoElement.addEventListener('loadedmetadata', () => {
        const maxWidth = Math.min(window.innerWidth, 1280); // Cap at 1280px or screen width
        const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
        canvasElement.width = maxWidth;
        canvasElement.height = maxWidth / aspectRatio;
        console.log(`Canvas set to: ${canvasElement.width}x${canvasElement.height}`);
        // Apply CSS flip if needed (fallback for inverted feed)
        canvasElement.style.transform = 'scaleX(-1)'; // Flip horizontally
        ctx.scale(-1, 1); // Adjust drawing context to match
    });

    // Initialize Camera with non-mirrored settings
    camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,  // Mobile-friendly resolution
        height: 480, // Mobile-friendly resolution
        facingMode: 'user', // Front camera
        mirror: false,     // Explicitly disable mirroring
        frameRate: { ideal: 24 } // Balanced for mobile
    });

    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.3,
        minTrackingConfidence: 0.3
    });
    hands.onResults(onResults);

    try {
        await camera.start();
        console.log('Camera and Hands initialized successfully');
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        videoElement.style.display = 'block';
        canvasElement.style.display = 'block';
    } catch (error) {
        console.error('Error starting camera:', error);
        info.textContent = 'Error: ' + error.message;
    }
});

stopBtn.addEventListener('click', () => {
    if (camera) camera.stop();
    if (hands) hands.close();
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    videoElement.style.display = 'none';
    canvasElement.style.display = 'none';
    info.textContent = 'Hands Detected: 0';
});

function onResults(results) {
    ctx.save();
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.scale(-1, 1); // Apply flip to drawing context
    ctx.drawImage(results.image, -canvasElement.width, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandedness) {
        console.log(`Hands detected: ${results.multiHandLandmarks.length}`);
        for (let index = 0; index < results.multiHandLandmarks.length; index++) {
            const landmarks = results.multiHandLandmarks[index];
            const handedness = results.multiHandedness[index].label;

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
                ctx.moveTo(-centerX, centerY); // Adjust for flipped context
                ctx.lineTo(-x, y);
                ctx.stroke();

                const angle = Math.atan2(y - centerY, -x - centerX); // Adjust angle
                ctx.save();
                ctx.fillStyle = '#FF0000';
                ctx.translate(-x, y); // Adjust translation
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
                ctx.fillText(i.toString(), -x, y - 10); // Adjust text position
            });
            ctx.setLineDash([]);

            info.textContent = `${handedness} Hand: ${results.multiHandLandmarks.length} hands detected`;
        }
    } else {
        console.log('No hands detected this frame');
        info.textContent = 'Hands Detected: 0 - Show your hand clearly';
    }
    ctx.restore();
}
