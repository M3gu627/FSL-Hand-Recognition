const canvasElement = document.getElementById('canvas');
const ctx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const info = document.getElementById('info');
const translationBox = document.getElementById('translation');
const recordingControls = document.getElementById('recording-controls');
const letterInput = document.getElementById('letter-input');
const recordBtn = document.getElementById('record-btn');
const exportDbBtn = document.getElementById('export-db-btn');
const toggleRecordBtn = document.getElementById('toggle-record');

// Create an off-screen video element for camera feed processing
const videoElement = document.createElement('video');
videoElement.width = 640;
videoElement.height = 480;

let camera;
let hands;
let recordedSamples = {}; // { 'A': [sample1, sample2, ...], ... }
let fslDatabase = {}; // Loaded JSON database

// Load database on startup
async function loadDatabase() {
    try {
        const response = await fetch('fsl_database.json');
        fslDatabase = await response.json();
        if (Object.keys(fslDatabase).length === 0) {
            console.warn('FSL database is empty. Record samples to build it.');
            info.textContent = 'No database found. Use recording mode to add FSL letters.';
        } else {
            console.log('FSL database loaded:', Object.keys(fslDatabase));
        }
    } catch (error) {
        console.error('Failed to load database:', error);
        fslDatabase = {};
        info.textContent = 'No database found. Use recording mode to add FSL letters.';
    }
}

startBtn.addEventListener('click', async () => {
    // Set canvas size
    canvasElement.width = 640;
    canvasElement.height = 480;
    console.log(`Canvas set to: ${canvasElement.width}x${canvasElement.height}`);

    camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
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
        minDetectionConfidence: 0.3,
        minTrackingConfidence: 0.3
    });
    hands.onResults(onResults);

    try {
        await loadDatabase();
        await camera.start();
        console.log('Camera and Hands initialized successfully');
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        canvasElement.style.display = 'block';
        translationBox.value = '--/--/--';
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
    canvasElement.style.display = 'none';
    info.textContent = 'Hands Detected: 0';
    translationBox.value = '--/--/--';
    recordingControls.classList.add('hidden'); // ✅ hide properly
});

// ✅ Fixed toggle using class
toggleRecordBtn.addEventListener('click', () => {
    recordingControls.classList.toggle('hidden');
});

recordBtn.addEventListener('click', () => {
    if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length !== 1) {
        alert('Show one hand clearly to record.');
        return;
    }
    const letter = letterInput.value.toUpperCase();
    if (!letter || !/[A-Z]/.test(letter)) {
        alert('Enter a valid letter A-Z.');
        return;
    }

    const landmarks = results.multiHandLandmarks[0];
    const flattened = landmarks.flatMap(lm => [lm.x, lm.y, lm.z]);
    const normalized = normalizeLandmarks(flattened);

    if (!recordedSamples[letter]) recordedSamples[letter] = [];
    recordedSamples[letter].push(normalized);

    alert(`Recorded sample for ${letter}. Total: ${recordedSamples[letter].length}`);
    letterInput.value = '';
});

exportDbBtn.addEventListener('click', () => {
    const database = {};
    Object.keys(recordedSamples).forEach(letter => {
        const samples = recordedSamples[letter];
        if (samples.length > 0) {
            const avg = samples[0].map((_, i) => 
                samples.reduce((sum, sample) => sum + sample[i], 0) / samples.length
            );
            database[letter] = avg;
        }
    });

    const dataStr = JSON.stringify(database, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fsl_database.json';
    a.click();
    URL.revokeObjectURL(url);
});

function normalizeLandmarks(flatLandmarks) {
    const landmarks = [];
    for (let i = 0; i < 21; i++) {
        landmarks.push({
            x: flatLandmarks[i*3],
            y: flatLandmarks[i*3 + 1],
            z: flatLandmarks[i*3 + 2]
        });
    }

    // Center to wrist (landmark 0)
    const wrist = landmarks[0];
    landmarks.forEach(lm => {
        lm.x -= wrist.x;
        lm.y -= wrist.y;
        lm.z -= wrist.z;
    });

    // Scale by max distance
    let maxDist = 0;
    landmarks.forEach(lm => {
        const dist = Math.sqrt(lm.x**2 + lm.y**2 + lm.z**2);
        if (dist > maxDist) maxDist = dist;
    });
    if (maxDist > 0) {
        landmarks.forEach(lm => {
            lm.x /= maxDist;
            lm.y /= maxDist;
            lm.z /= maxDist;
        });
    }

    return landmarks.flatMap(lm => [lm.x, lm.y, lm.z]);
}

function euclideanDistance(vec1, vec2) {
    return Math.sqrt(vec1.reduce((sum, val, i) => sum + (val - vec2[i]) ** 2, 0));
}

let results; // Store results globally for recording
function onResults(res) {
    results = res; // Save for recording
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandedness) {
        console.log(`Hands detected: ${results.multiHandLandmarks.length}`);
        const handLabels = results.multiHandedness.map(hand => `${hand.label} Hand`);
        info.textContent = handLabels.join(', ');

        let translation = '--/--/--';
        if (results.multiHandLandmarks.length === 1) {
            const landmarks = results.multiHandLandmarks[0];
            const flattened = landmarks.flatMap(lm => [lm.x, lm.y, lm.z]);
            const normalized = normalizeLandmarks(flattened);

            let bestMatch = null;
            let minDistance = Infinity;
            Object.entries(fslDatabase).forEach(([letter, template]) => {
                const distance = euclideanDistance(normalized, template);
                if (distance < minDistance && distance < 0.5) {
                    minDistance = distance;
                    bestMatch = letter;
                }
            });
            translation = bestMatch ? `FSL Letter: ${bestMatch}` : '--/--/--';
        }
        translationBox.value = translation;

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
        }
    } else {
        console.log('No hands detected this frame');
        info.textContent = 'Hands Detected: 0 - Show your hand clearly';
        translationBox.value = '--/--/--';
    }
}
