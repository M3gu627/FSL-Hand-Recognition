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
        for (let index = 0; index < results.multiHandLandmarks.length; index++) {
            const landmarks = results.multiHandLandmarks[index];
            const handedness = results.multiHandedness[index]; // Left/right hand info

            // 1. Draw standard connections (skeleton lines) - Enhanced: Thicker and colored
            drawConnectors(
                ctx,
                landmarks,
                HAND_CONNECTIONS,
                { color: handedness.label === 'Left' ? '#00FF00' : '#0000FF', lineWidth: 5 } // Green for left, blue for right; thicker lines
            );

            // 2. Draw landmarks (markers/dots) - Enhanced: Larger and colored
            drawLandmarks(
                ctx,
                landmarks,
                {
                    color: handedness.label === 'Left' ? '#00FF00' : '#0000FF', // Match line color
                    lineWidth: 2,
                    radius: 5 // Larger markers for better visibility
                }
            );

            // 3. Calculate hand center for pinning (average of all landmark positions)
            let centerX = 0, centerY = 0;
            landmarks.forEach(lm => {
                centerX += lm.x * canvas.width; // Scale to canvas size
                centerY += lm.y * canvas.height;
            });
            centerX /= landmarks.length;
            centerY /= landmarks.length;

            // 4. Draw pinning lines: From center to each landmark (pointers)
            ctx.strokeStyle = '#FF0000'; // Red lines for pointers
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]); // Dashed lines for distinction (optional: remove for solid)
            landmarks.forEach((lm, i) => {
                const x = lm.x * canvas.width;
                const y = lm.y * canvas.height;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(x, y);
                ctx.stroke();

                // 5. Add arrowhead to end of pointer line (pinning effect)
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

                // 6. Add text labels to markers (e.g., joint number or name)
                ctx.fillStyle = '#FFFFFF'; // White text
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(i.toString(), x, y - 10); // Joint index (0-20)
                // Optional: Custom labels, e.g., if (i === 4) ctx.fillText('Thumb Tip', x, y + 15);
            });
            ctx.setLineDash([]); // Reset to solid lines

            // Update info with hand details
            info.textContent = `${handedness.label} Hand Detected: ${results.multiHandLandmarks.length} hands`;
        }
    } else {
        info.textContent = 'Hands Detected: 0';
    }
    ctx.restore();
}
