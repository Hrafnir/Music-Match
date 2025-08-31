/* Version: #17 */
// === DOM-ELEMENTER ===
const startButton = document.getElementById('startButton');
const statusMessage = document.getElementById('statusMessage');
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');
const frequencyValueElement = document.getElementById('frequencyValue');
const noteNameElement = document.getElementById('noteName');
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
let oscillator; // NYTT: Oscillator for å generere toner

// === SANG-DATA VARIABLER ===
let currentSong = null;
let isPlaying = false; // NYTT: Holder styr på om avspilling pågår

// === KONSTANTER ===
const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
// NYTT: Mapping fra notenavn til frekvens (A4 = 440Hz)
const A4 = 440;
const noteFrequencies = {};
for (let i = 0; i < 12; i++) {
    noteFrequencies[noteStrings[i]] = i;
}


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
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        currentSong = await response.json();
        console.log("loadSong: Sang lastet successfully:", currentSong);
        populatePartSelector();
        songStatus.textContent = `Lastet: ${currentSong.title}`;
        playSongButton.disabled = true;
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
    partSelector.innerHTML = '<option value="">-- Velg stemme --</option>';
    const parts = Object.keys(currentSong.parts);
    console.log("populatePartSelector: Fant stemmer:", parts);
    parts.forEach(partName => {
        if (currentSong.parts[partName].length > 0) {
            const option = document.createElement('option');
            option.value = partName;
            option.textContent = partName.charAt(0).toUpperCase() + partName.slice(1);
            partSelector.appendChild(option);
        }
    });
    partSelector.disabled = false;
}

/**
 * Spiller av den valgte sangstemmen.
 */
function playSong() {
    if (!currentSong || isPlaying) {
        console.log("playSong: Kan ikke spille, enten ingen sang lastet eller spiller allerede.");
        return;
    }
    
    const selectedPart = partSelector.value;
    if (!selectedPart) {
        console.log("playSong: Ingen stemme valgt.");
        return;
    }

    const partData = currentSong.parts[selectedPart];
    const bpm = currentSong.bpm;
    const beatDuration = 60 / bpm; // Varighet av ett slag i sekunder

    // Deaktiver kontroller under avspilling
    isPlaying = true;
    playSongButton.disabled = true;
    playSongButton.textContent = "Spiller...";
    console.log(`playSong: Starter avspilling av '${selectedPart}' med ${bpm} BPM.`);

    let currentTime = audioContext.currentTime;
    console.log(`playSong: Starter på AudioContext-tid: ${currentTime.toFixed(2)}s`);

    partData.forEach(noteInfo => {
        const noteDuration = noteInfo.duration * beatDuration;
        
        if (noteInfo.note !== "REST") {
            const frequency = getFrequencyForNote(noteInfo.note);
            if (frequency) {
                // Planlegg avspilling av denne noten
                scheduleTone(currentTime, frequency, noteDuration);
            }
        }
        
        // Oppdater tidspunktet for neste note
        currentTime += noteDuration;
    });

    // Planlegg re-aktivering av knappen når sangen er ferdig
    const totalDuration = currentTime - audioContext.currentTime;
    setTimeout(() => {
        isPlaying = false;
        playSongButton.disabled = false;
        playSongButton.textContent = "Spill av";
        console.log("playSong: Avspilling ferdig.");
    }, totalDuration * 1000); // setTimeout bruker millisekunder
}

/**
 * Planlegger en tone til å spilles på et spesifikt tidspunkt.
 * @param {number} startTime - Tiden i AudioContext-klokken når tonen skal starte.
 * @param {number} frequency - Frekvensen til tonen i Hz.
 * @param {number} duration - Varigheten til tonen i sekunder.
 */
function scheduleTone(startTime, frequency, duration) {
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain(); // For myk start/slutt

    osc.connect(gainNode);
    gainNode.connect(audioContext.destination);

    osc.type = 'sine'; // En ren, myk tone
    osc.frequency.setValueAtTime(frequency, startTime);

    // Myk start (attack) for å unngå klikkelyder
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.02); // Rask fade-in

    // Myk slutt (release)
    const endTime = startTime + duration;
    gainNode.gain.setValueAtTime(0.5, endTime - 0.05);
    gainNode.gain.linearRampToValueAtTime(0, endTime);
    
    console.log(`scheduleTone: Planlegger tone ${frequency.toFixed(1)}Hz fra ${startTime.toFixed(2)}s til ${endTime.toFixed(2)}s`);

    osc.start(startTime);
    osc.stop(endTime);
}


// === VISUALISERING OG HJELPEFUNKSJONER ===

function getFrequencyForNote(noteName) {
    const match = /([A-G]#?)([0-9])/.exec(noteName);
    if (!match) return null;

    const name = match[1];
    const octave = parseInt(match[2], 10);
    
    const semitone = noteFrequencies[name];
    const noteNumber = semitone + (octave + 1) * 12;

    return A4 * Math.pow(2, (noteNumber - 69) / 12);
}

function drawWaveform() { /* (Uendret fra forrige versjon) */
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

function noteFromPitch(frequency) { /* (Uendret fra forrige versjon) */
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    const roundedNote = Math.round(noteNum) + 69;
    const octave = Math.floor(roundedNote / 12) - 1;
    return noteStrings[roundedNote % 12] + octave;
}

function autoCorrelate(buf, sampleRate) { /* (Uendret fra forrige versjon) */
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
        for (let j = 0; j < SIZE - i; j++) c[i] = c[i] + buf[j] * buf[j + i];
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
    playSongButton.disabled = !partSelector.value || isPlaying;
    if (partSelector.value) console.log(`partSelector: Valgt stemme: ${partSelector.value}`);
});

// NYTT: Kobler playSong-funksjonen til knappen
playSongButton.addEventListener('click', playSong);

console.log("Script lastet. Venter på brukerinteraksjon.");
/* Version: #17 */
