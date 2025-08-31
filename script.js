/* Version: #5 */
// === KONSTANTER OG VARIABLER ===
const startButton = document.getElementById('startButton');
const statusMessage = document.getElementById('statusMessage');
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');

let audioContext;
let analyser;
let source;
let dataArray;
let bufferLength;
let isInitialized = false;

// === FUNKSJJONER ===

/**
 * Initialiserer Web Audio API og mikrofon-input.
 */
async function initAudio() {
    console.log("initAudio: Forsøker å initialisere lyd...");
    if (isInitialized) {
        console.log("initAudio: Lyd er allerede initialisert.");
        return;
    }

    try {
        statusMessage.textContent = "Ber om mikrofontilgang...";
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("initAudio: AudioContext opprettet.");

        source = audioContext.createMediaStreamSource(stream);
        console.log("initAudio: MediaStreamSource opprettet fra mikrofon-stream.");

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048; // Standard FFT-størrelse, bra for visualisering
        console.log("initAudio: AnalyserNode opprettet med fftSize =", analyser.fftSize);

        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        console.log("initAudio: Databuffer opprettet med lengde =", bufferLength);

        source.connect(analyser);
        console.log("initAudio: Koblet kilde (mikrofon) til analysator.");

        isInitialized = true;
        statusMessage.textContent = "Mikrofon aktiv. Visualisering kjører.";
        console.log("initAudio: Initialisering vellykket.");
        
        // Start visualiserings-loopen
        draw();

    } catch (err) {
        console.error("initAudio: Feil ved henting av mikrofon-stream:", err);
        statusMessage.textContent = `Kunne ikke få tilgang til mikrofonen. Feilmelding: ${err.message}`;
        isInitialized = false;
    }
}

/**
 * Tegner lydbølgen på canvas-elementet.
 */
function draw() {
    if (!isInitialized) {
        console.log("draw: Avbryter fordi lyd ikke er initialisert.");
        return;
    }
    
    // Sett opp en loop for kontinuerlig tegning
    requestAnimationFrame(draw);

    // Hent bølgeform-data fra analysatoren
    analyser.getByteTimeDomainData(dataArray);

    // Tøm canvaset
    canvasCtx.fillStyle = '#1e2127'; // Bakgrunnsfarge
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    // Sett strek-egenskaper
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#61dafb'; // Linjefarge

    canvasCtx.beginPath();

    const sliceWidth = canvas.width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; // Normaliser verdien (0-255 -> 0-2)
        const y = v * canvas.height / 2;

        if (i === 0) {
            canvasCtx.moveTo(x, y);
        } else {
            canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
}


// === HENDELSESLYTTERE ===

startButton.addEventListener('click', () => {
    console.log("startButton: Knappen ble klikket.");
    if (!isInitialized) {
        initAudio();
    } else {
        console.log("startButton: Lyd er allerede i gang.");
    }
});

console.log("Script lastet. Venter på brukerinteraksjon.");
/* Version: #5 */
