const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const info = document.getElementById('info');

let camera;
let hands;

startBtn.addEventListener('click', async () => {
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    console.log(`Starting with Canvas: ${canvas.width}x${canvas.height}`);

    camera = new Camera(video, {
        onFrame: async () => {
            await hands.send({ image: video });
        },
        width: 640,
        height: 480
    });

    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    hands.onResults(onResults);

    await camera.start();
    console.log('Camera started');
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
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandedness) {
        console.log('Hands detected:', results.multiHandLandmarks.length);
        for (let index = 0; index < results.multiHandLandmarks.length; index++) {
            const landmarks = results.multiHandLandmarks[index];
            const handedness = results.multiHandedness[index];

            drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: handedness.label === 'Left' ? '#00FF00' : '#0000FF', lineWidth: 5 });
            drawLandmarks(ctx, landmarks, { color: handedness.label === 'Left' ? '#00FF00' : '#0000FF', lineWidth: 2, radius: 5 });

            let centerX = 0, centerY = 0;
            landmarks.forEach(lm => {
                centerX += lm.x * canvas.width;
                centerY += lm.y * canvas.height;
            });
            centerX /= landmarks.length;
            centerY /= landmarks.length;

            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            landmarks.forEach((lm, i) => {
                const x = lm.x * canvas.width;
                const y = lm.y * canvas.height;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(x, y);
                ctx.stroke();

                const angle = Math.atan2(y - centerY, x - centerX);
                ctx.save();
                ctx.fillStyle = '#FF0000';
                ctx.translate(x, y);
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
                ctx.fillText(i.toString(), x, y - 10);
            });
            ctx.setLineDash([]);

            info.textContent = `${handedness.label} Hand Detected: ${results.multiHandLandmarks.length}`;
        }
    } else {
        info.textContent = 'Hands Detected: 0';
    }
    ctx.restore();
}
