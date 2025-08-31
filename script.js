/* Version: #15 */
// === DOM-ELEMENTER ===
const startButton = document.getElementById('startButton');
const statusMessage = document.getElementById('statusMessage');
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');
const frequencyValueElement = document.getElementById('frequencyValue');
const noteNameElement = document.getElementById('noteName');

// NYTT: Elementer for sangkontroll
const loadSongButton = document.getElementById('loadSongButton');
const songSelector = document.getElementById('songSelector');
const partSelector = document.getElementById('partSelector');
const playSongButton = document.getElementById('playSongButton');
const songStatus = document.getElementById('songStatus');


// === LYD-VARIABLER ===
let audioContext;
let analyser;
let source;
let dataArray;
let bufferLength;
let isInitialized = false;

// === SANG-DATA VARIABLER ===
let currentSong = null;


// === KONSTANTER ===
const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];


// === KJERNEFUNKSJONER ===

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

        bufferLength = analyser.fftSize;
        dataArray = new Float32Array(bufferLength);
        console.log("initAudio: Databuffer (Float32Array) opprettet med lengde =", bufferLength);

        source.connect(analyser);
        console.log("initAudio: Koblet kilde (mikrofon) til analysator.");

        isInitialized = true;
        statusMessage.textContent = "Mikrofon aktiv. Lytter etter toner...";
        console.log("initAudio: Initialisering vellykket.");
        
        update();

    } catch (err) {
        console.error("initAudio: Feil ved henting av mikrofon-stream:", err);
        statusMessage.textContent = `Kunne ikke få tilgang til mikrofonen. Feilmelding: ${err.message}`;
        isInitialized = false;
    }
}

/**
 * Hovedloopen som kjører på hver animasjonsramme.
 */
function update() {
    if (!isInitialized) return;

    analyser.getFloatTimeDomainData(dataArray);

    const frequency = autoCorrelate(dataArray, audioContext.sampleRate);
    
    if (frequency !== -1) {
        const note = noteFromPitch(frequency);
        frequencyValueElement.textContent = frequency.toFixed(2);
        noteNameElement.textContent = note;
    } else {
        frequencyValueElement.textContent = "---";
        noteNameElement.textContent = "---";
    }

    drawWaveform();
    requestAnimationFrame(update);
}

// === SANG-FUNKSJONER ===

/**
 * Laster sangdata fra en JSON-fil.
 */
async function loadSong() {
    const songPath = songSelector.value;
    console.log(`loadSong: Forsøker å laste sang fra: ${songPath}`);
    songStatus.textContent = "Laster sang...";
    
    try {
        const response = await fetch(songPath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        currentSong = await response.json();
        console.log("loadSong: Sang lastet successfully:", currentSong);
        
        populatePartSelector();
        songStatus.textContent = `Lastet: ${currentSong.title}`;
        playSongButton.disabled = true; // Deaktiveres til en stemme er valgt

    } catch (error) {
        console.error("loadSong: Kunne ikke laste sangfil:", error);
        songStatus.textContent = `Feil ved lasting av sang. Sjekk konsollen.`;
        currentSong = null;
    }
}

/**
 * Fyller stemme-velgeren (partSelector) med stemmer fra den lastede sangen.
 */
function populatePartSelector() {
    if (!currentSong) return;

    partSelector.innerHTML = '<option value="">-- Velg stemme --</option>'; // Nullstill
    const parts = Object.keys(currentSong.parts);
    console.log("populatePartSelector: Fant stemmer:", parts);
    
    parts.forEach(partName => {
        // Legg kun til stemmer som faktisk har noter
        if (currentSong.parts[partName].length > 0) {
            const option = document.createElement('option');
            option.value = partName;
            option.textContent = partName.charAt(0).toUpperCase() + partName.slice(1); // "sopran" -> "Sopran"
            partSelector.appendChild(option);
        }
    });

    partSelector.disabled = false;
}


// === VISUALISERING OG HJELPEFUNKSJONER ===

function drawWaveform() {
    canvasCtx.fillStyle = '#1e2127';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#61dafb';
    canvasCtx.beginPath();
    const sliceWidth = canvas.width * 1.0 / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i]; 
        const y = (v * canvas.height / 2) + (canvas.height / 2);
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
        x += sliceWidth;
    }
    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
}

function noteFromPitch(frequency) {
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    const roundedNote = Math.round(noteNum) + 69;
    const octave = Math.floor(roundedNote / 12) - 1;
    return noteStrings[roundedNote % 12] + octave;
}

function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) {
        const val = buf[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1;

    let r1 = 0, r2 = SIZE - 1;
    const c = new Float32Array(SIZE);
    for (let i = 0; i < SIZE; i++) {
        c[i] = 0;
        for (let j = 0; j < SIZE - i; j++) {
            c[i] = c[i] + buf[j] * buf[j + i];
        }
    }
    let d = 0;
    while (d < c.length && c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }
    let T0 = maxpos;
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);
    return T0 > 0 ? sampleRate / T0 : -1;
}

// === HENDELSESLYTTERE ===
startButton.addEventListener('click', () => {
    console.log("startButton: Knappen ble klikket.");
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    } else if (!isInitialized) {
        initAudio();
    }
});

loadSongButton.addEventListener('click', loadSong);

partSelector.addEventListener('change', () => {
    // Aktiver "Spill av"-knappen kun hvis en gyldig stemme er valgt
    if (partSelector.value) {
        playSongButton.disabled = false;
        console.log(`partSelector: Valgt stemme: ${partSelector.value}`);
    } else {
        playSongButton.disabled = true;
    }
});

console.log("Script lastet. Venter på brukerinteraksjon.");
/* Version: #15 */
