/* Version: #9 */
// === KONSTANTER OG VARIABLER ===
const startButton = document.getElementById('startButton');
const statusMessage = document.getElementById('statusMessage');
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');

// NYTT: Referanser til de nye HTML-elementene for tone-visning
const frequencyValueElement = document.getElementById('frequencyValue');
const noteNameElement = document.getElementById('noteName');

let audioContext;
let analyser;
let source;
let dataArray; // Vil nå være Float32Array for tone-deteksjon
let bufferLength;
let isInitialized = false;

// NYTT: Konstanter for tone-deteksjon
const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MIN_SAMPLES = 0; // Minimum antall samples for autokorrelasjon
const GOOD_ENOUGH_CORRELATION = 0.9; // Terskel for en "bra nok" korrelasjon

// === FUNKSJONER ===

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
        console.log("initAudio: AudioContext opprettet med sample rate:", audioContext.sampleRate);

        source = audioContext.createMediaStreamSource(stream);
        console.log("initAudio: MediaStreamSource opprettet.");

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        console.log("initAudio: AnalyserNode opprettet med fftSize =", analyser.fftSize);

        bufferLength = analyser.fftSize; // VIKTIG: For tone-deteksjon bruker vi hele bufferet, ikke frequencyBinCount
        dataArray = new Float32Array(bufferLength); // ENDRET: Bruker Float32Array for mer nøyaktige data (-1.0 til 1.0)
        console.log("initAudio: Databuffer (Float32Array) opprettet med lengde =", bufferLength);

        source.connect(analyser);
        console.log("initAudio: Koblet kilde (mikrofon) til analysator.");

        isInitialized = true;
        statusMessage.textContent = "Mikrofon aktiv. Lytter etter toner...";
        console.log("initAudio: Initialisering vellykket.");
        
        // Start visualiserings- og analyse-loopen
        update();

    } catch (err) {
        console.error("initAudio: Feil ved henting av mikrofon-stream:", err);
        statusMessage.textContent = `Kunne ikke få tilgang til mikrofonen. Feilmelding: ${err.message}`;
        isInitialized = false;
    }
}

/**
 * Konverterer frekvens (Hz) til nærmeste note-navn (f.eks. "A4").
 */
function noteFromPitch(frequency) {
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    const roundedNote = Math.round(noteNum) + 69;
    const octave = Math.floor(roundedNote / 12) - 1;
    return noteStrings[roundedNote % 12] + octave;
}

/**
 * Algoritme for å detektere tonehøyde ved hjelp av autokorrelasjon.
 * @param {Float32Array} buf - Lydbufferet som skal analyseres.
 * @param {number} sampleRate - Samplingsfrekvensen til AudioContext.
 * @returns {number} - Den detekterte frekvensen i Hz, eller -1 hvis ingen klar tone ble funnet.
 */
function autoCorrelate(buf, sampleRate) {
    // 1. Beregn RMS (Root Mean Square) for å sjekke om det er nok lyd
    let SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) {
        const val = buf[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) { // Hvis lyden er for svak, ikke analyser
        return -1;
    }

    // 2. Finn korrelasjoner
    let r1 = 0, r2 = SIZE - 1;
    const c = new Float32Array(SIZE);
    for (let i = 0; i < SIZE; i++) {
        c[i] = 0;
        for (let j = 0; j < SIZE - i; j++) {
            c[i] = c[i] + buf[j] * buf[j + i];
        }
    }

    // 3. Finn den første dippen i korrelasjonsverdiene
    let d = 0;
    while (d < c.length && c[d] > c[d + 1]) {
        d++;
    }

    // 4. Finn den høyeste toppen etter dippen
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }

    let T0 = maxpos;

    // 5. Parabolsk interpolasjon for å forbedre nøyaktigheten av toppen
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) {
        T0 = T0 - b / (2 * a);
    }

    if (T0 > 0) {
        return sampleRate / T0;
    }
    return -1;
}

/**
 * Hovedloopen som kjører på hver animasjonsramme.
 * Kaller på funksjoner for visualisering og toneanalyse.
 */
function update() {
    if (!isInitialized) return;

    // Hent de nyeste lyddataene
    analyser.getFloatTimeDomainData(dataArray);

    // --- Del 1: Tone-analyse ---
    const frequency = autoCorrelate(dataArray, audioContext.sampleRate);
    
    if (frequency !== -1) {
        // En tone ble funnet
        const note = noteFromPitch(frequency);
        frequencyValueElement.textContent = frequency.toFixed(2);
        noteNameElement.textContent = note;
    } else {
        // Ingen klar tone funnet
        frequencyValueElement.textContent = "---";
        noteNameElement.textContent = "---";
    }

    // --- Del 2: Visualisering ---
    drawWaveform();

    // Loop for neste ramme
    requestAnimationFrame(update);
}


/**
 * Tegner lydbølgen på canvas-elementet.
 */
function drawWaveform() {
    // Tøm canvaset
    canvasCtx.fillStyle = '#1e2127';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    // Sett strek-egenskaper
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#61dafb';
    canvasCtx.beginPath();

    const sliceWidth = canvas.width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        // ENDRET: Verdien er nå mellom -1.0 og 1.0
        const v = dataArray[i]; 
        const y = (v * canvas.height / 2) + (canvas.height / 2); // Juster y-posisjon

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
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    } else if (!isInitialized) {
        initAudio();
    } else {
        console.log("startButton: Lyd er allerede i gang.");
    }
});

console.log("Script lastet. Venter på brukerinteraksjon.");
/* Version: #9 */
