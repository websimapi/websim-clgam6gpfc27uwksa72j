import interact from 'interactjs';
import confetti from 'canvas-confetti';

const sandbox = document.getElementById('sandbox');
const toolbar = document.getElementById('toolbar');
const clearBtn = document.getElementById('clear-btn');
const readBtn = document.getElementById('read-btn');
const handBtn = document.getElementById('hand-btn');
const knifeBtn = document.getElementById('knife-btn');
const palinBtn = document.getElementById('palin-btn');
const kbBtn = document.getElementById('kb-btn');
const nonoBtn = document.getElementById('nono-btn');

const modal = document.getElementById('keyboard-modal');
const nonoModal = document.getElementById('nono-modal');
const closeNonoBtn = document.getElementById('close-nono-btn');
const nonoList = document.getElementById('nono-list');
const wordInput = document.getElementById('word-input');
const spawnWordBtn = document.getElementById('spawn-word-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

const SNAP_THRESHOLD = 30;
const BLOCK_SIZE = 80;
const SWEAR_WORDS = ['SHIT', 'FUCK', 'DAMN', 'HELL', 'Bitch', 'Ass'].map(w => w.toUpperCase());
const FORBIDDEN_WORDS = ['NIGGER', 'NIGGA'];

const CHARACTER_SETS = {
    alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    punctuation: ['!', '?', '.', ',', '-', "'", '"', '(', ')'],
    languages: ['Á', 'É', 'Í', 'Ó', 'Ú', 'Ñ', 'Ü', '¡', '¿', 'Ç', 'ß'],
    suggestions: [{ label: 'Bob', value: 'B', class: 'placeholder-bob' }]
};

let currentTool = 'hand'; // hand, knife, palin
let currentTab = 'alphabet';
let isLockdown = false;

// Audio assets
const popSound = new Audio('/pop.mp3');
const snapSound = new Audio('/snap.mp3');
const alarmSound = new Audio('/alarm.mp3');
alarmSound.loop = true;

function playPopSound() {
    popSound.currentTime = 0;
    popSound.play().catch(() => {}); // Catch browser block
}

function playSnapSound() {
    snapSound.currentTime = 0;
    snapSound.play().catch(() => {});
}

// Initialize Toolbar & Tabs
function renderToolbar() {
    toolbar.innerHTML = '';
    
    if (isLockdown) {
        const sorryItems = ['S', 'O', 'R', 'Y'];
        sorryItems.forEach(letter => {
            const spawner = document.createElement('div');
            spawner.className = `spawner letter-${letter.toLowerCase()}`;
            spawner.textContent = letter;
            spawner.addEventListener('click', () => spawnBlock(letter));
            toolbar.appendChild(spawner);
        });
        return;
    }

    const items = CHARACTER_SETS[currentTab];
    
    items.forEach(item => {
        const isObject = typeof item === 'object';
        const letter = isObject ? item.value : item;
        const label = isObject ? item.label : item;
        
        const spawner = document.createElement('div');
        // Sanitize class name for special characters
        const safeClass = letter.toLowerCase().replace(/[^a-z]/g, 'symbol');
        spawner.className = `spawner letter-${safeClass}`;
        spawner.textContent = label;
        spawner.addEventListener('click', () => spawnBlock(letter, null, null, isObject ? item : null));
        toolbar.appendChild(spawner);
    });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        renderToolbar();
    });
});

renderToolbar();

function spawnBlock(letter, x = null, y = null, specialData = null) {
    const block = document.createElement('div');
    const safeClass = letter.toLowerCase().replace(/[^a-z]/g, 'symbol');
    block.className = `alphablock letter-${safeClass}`;
    if (specialData && specialData.class) block.classList.add(specialData.class);
    
    block.dataset.letter = letter;
    block.id = 'block-' + Math.random().toString(36).substr(2, 9);
    
    // Main letter container
    const letterDisplay = document.createElement('div');
    letterDisplay.className = 'letter-display';
    letterDisplay.textContent = letter;
    block.appendChild(letterDisplay);
    
    // Glass Casing
    const glassCasing = document.createElement('div');
    glassCasing.className = 'glass-casing';
    
    // Alphaling (mini letter inside)
    const alphaling = document.createElement('div');
    alphaling.className = 'alphaling';
    alphaling.textContent = letter;
    glassCasing.appendChild(alphaling);
    
    block.appendChild(glassCasing);
    
    // Add eyes
    const eyes = document.createElement('div');
    eyes.className = 'eyes';
    eyes.innerHTML = '<div class="eye"></div><div class="eye"></div>';
    block.appendChild(eyes);

    // Initial position
    const startX = x !== null ? x : (sandbox.clientWidth / 2) - (BLOCK_SIZE / 2) + (Math.random() * 40 - 20);
    const startY = y !== null ? y : (sandbox.clientHeight / 2) - (BLOCK_SIZE / 2) + (Math.random() * 40 - 20);
    
    block.style.transform = `translate(${startX}px, ${startY}px)`;
    block.dataset.x = startX;
    block.dataset.y = startY;

    sandbox.appendChild(block);
    playPopSound();
    setupDraggable(block);

    block.addEventListener('click', (e) => {
        if (currentTool === 'knife') {
            cutWord(block);
        } else if (currentTool === 'palin') {
            palindromeinateWord(block);
        }
    });
}

function getConnectedBlocks(block) {
    const allBlocks = Array.from(document.querySelectorAll('.alphablock'));
    const rowY = parseFloat(block.dataset.y);
    const row = allBlocks.filter(b => Math.abs(parseFloat(b.dataset.y) - rowY) < 5);
    row.sort((a, b) => parseFloat(a.dataset.x) - parseFloat(b.dataset.x));

    let index = row.indexOf(block);
    let group = [block];

    // Look left
    for (let i = index - 1; i >= 0; i--) {
        const curr = row[i];
        const next = row[i + 1];
        if (Math.abs(parseFloat(next.dataset.x) - (parseFloat(curr.dataset.x) + BLOCK_SIZE + 4)) < 10) {
            group.unshift(curr);
        } else break;
    }
    // Look right
    for (let i = index + 1; i < row.length; i++) {
        const curr = row[i];
        const prev = row[i - 1];
        if (Math.abs(parseFloat(curr.dataset.x) - (parseFloat(prev.dataset.x) + BLOCK_SIZE + 4)) < 10) {
            group.push(curr);
        } else break;
    }
    return group;
}

function setupDraggable(el) {
    let group = [];
    interact(el).draggable({
        inertia: true,
        listeners: {
            start(event) {
                if (currentTool !== 'hand') return event.interaction.stop();
                group = getConnectedBlocks(event.target);
                group.forEach(b => b.style.zIndex = 1000);
            },
            move(event) {
                group.forEach(b => {
                    const x = (parseFloat(b.dataset.x) || 0) + event.dx;
                    const y = (parseFloat(b.dataset.y) || 0) + event.dy;
                    b.style.transform = `translate(${x}px, ${y}px)`;
                    b.dataset.x = x;
                    b.dataset.y = y;
                });
            },
            end(event) {
                group.forEach(b => b.style.zIndex = 10);
                handleSnapping(event.target, group);
                checkWords();
            }
        }
    });
}

function handleSnapping(activeBlock, group) {
    const allBlocks = Array.from(document.querySelectorAll('.alphablock'));
    const others = allBlocks.filter(b => !group.includes(b));
    
    // We snap the group based on the activeBlock's position
    const activeX = parseFloat(activeBlock.dataset.x);
    const activeY = parseFloat(activeBlock.dataset.y);

    let snapDeltaX = 0;
    let snapDeltaY = 0;
    let snapped = false;

    for (const other of others) {
        const ox = parseFloat(other.dataset.x);
        const oy = parseFloat(other.dataset.y);
        const dy = Math.abs(activeY - oy);

        // Snap to left of other
        const dxLeft = Math.abs((activeX + BLOCK_SIZE + 4) - ox);
        if (dxLeft < SNAP_THRESHOLD && dy < SNAP_THRESHOLD) {
            snapDeltaX = (ox - BLOCK_SIZE - 4) - activeX;
            snapDeltaY = oy - activeY;
            snapped = true;
            break;
        }

        // Snap to right of other
        const dxRight = Math.abs(activeX - (ox + BLOCK_SIZE + 4));
        if (dxRight < SNAP_THRESHOLD && dy < SNAP_THRESHOLD) {
            snapDeltaX = (ox + BLOCK_SIZE + 4) - activeX;
            snapDeltaY = oy - activeY;
            snapped = true;
            break;
        }
    }

    if (snapped) {
        group.forEach(b => {
            b.dataset.x = parseFloat(b.dataset.x) + snapDeltaX;
            b.dataset.y = parseFloat(b.dataset.y) + snapDeltaY;
            b.style.transform = `translate(${b.dataset.x}px, ${b.dataset.y}px)`;
        });
        playSnapSound();
    }
}

function checkWords() {
    const blocks = Array.from(document.querySelectorAll('.alphablock'));
    blocks.forEach(b => b.classList.remove('censored'));

    const words = getAllWordGroups();
    
    if (isLockdown) {
        const hasSorry = words.some(group => {
            const wordStr = group.map(b => b.dataset.letter).join('').toUpperCase();
            return wordStr === 'SORRY';
        });
        if (hasSorry) {
            exitLockdown();
        }
        return;
    }

    words.forEach(group => {
        const wordStr = group.map(b => b.dataset.letter).join('').toUpperCase();
        
        // Trigger lockdown for forbidden words
        if (FORBIDDEN_WORDS.some(f => wordStr.includes(f))) {
            triggerLockdown();
            return;
        }

        if (SWEAR_WORDS.some(swear => wordStr.includes(swear))) {
            group.forEach(b => b.classList.add('censored'));
        }
    });
}

function triggerLockdown() {
    if (isLockdown) return;
    isLockdown = true;
    sandbox.innerHTML = ''; // Clear all blocks
    alarmSound.play().catch(() => {});
    document.body.style.backgroundColor = '#ffcdd2';
    document.body.classList.add('lockdown-mode');
    
    // Hide tabs during lockdown
    document.getElementById('tabs').style.display = 'none';
    renderToolbar();
    
    // Alert the user (optional visual cue)
    const warning = document.createElement('div');
    warning.id = 'lockdown-msg';
    warning.textContent = "ALARM! Spell SORRY to unlock the game!";
    sandbox.appendChild(warning);
}

function exitLockdown() {
    isLockdown = false;
    alarmSound.pause();
    alarmSound.currentTime = 0;
    document.body.style.backgroundColor = '';
    document.body.classList.remove('lockdown-mode');
    document.getElementById('tabs').style.display = 'flex';
    
    const msg = document.getElementById('lockdown-msg');
    if (msg) msg.remove();
    
    confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 }
    });
    
    renderToolbar();
}

function getAllWordGroups() {
    const blocks = Array.from(document.querySelectorAll('.alphablock'));
    const rows = {};
    blocks.forEach(b => {
        const y = Math.round(parseFloat(b.dataset.y) / 5) * 5;
        if (!rows[y]) rows[y] = [];
        rows[y].push(b);
    });

    const groups = [];
    Object.values(rows).forEach(row => {
        row.sort((a, b) => parseFloat(a.dataset.x) - parseFloat(b.dataset.x));
        let currentGroup = [];
        for (let i = 0; i < row.length; i++) {
            const b = row[i];
            if (currentGroup.length === 0) {
                currentGroup.push(b);
            } else {
                const prev = currentGroup[currentGroup.length - 1];
                const dist = parseFloat(b.dataset.x) - (parseFloat(prev.dataset.x) + BLOCK_SIZE);
                if (dist < 10) {
                    currentGroup.push(b);
                } else {
                    groups.push(currentGroup);
                    currentGroup = [b];
                }
            }
        }
        if (currentGroup.length > 0) groups.push(currentGroup);
    });
    return groups;
}

function cutWord(block) {
    const group = getConnectedBlocks(block);
    if (group.length <= 1) return;
    
    // Move the block and everything to its right slightly further away
    const idx = group.indexOf(block);
    for (let i = idx; i < group.length; i++) {
        const b = group[i];
        const newX = parseFloat(b.dataset.x) + 20;
        b.dataset.x = newX;
        b.style.transform = `translate(${newX}px, ${b.dataset.y}px)`;
    }
    playSnapSound();
    checkWords();
}

function palindromeinateWord(block) {
    const group = getConnectedBlocks(block);
    const word = group.map(b => b.dataset.letter);
    const reversed = [...word].reverse();
    
    // We append the reversed word (minus the first letter to make a nice palindrome)
    const toAdd = reversed.slice(1);
    let lastX = parseFloat(group[group.length - 1].dataset.x);
    let y = parseFloat(group[group.length - 1].dataset.y);

    toAdd.forEach((letter, i) => {
        const nextX = lastX + BLOCK_SIZE + 4;
        spawnBlock(letter, nextX, y);
        lastX = nextX;
    });
    
    setTimeout(checkWords, 100);
}

function readAllWords() {
    const blocks = Array.from(document.querySelectorAll('.alphablock'));
    if (blocks.length === 0) return;

    // Group blocks by row (same or very close Y)
    const rows = {};
    blocks.forEach(b => {
        const y = Math.round(parseFloat(b.dataset.y) / 5) * 5;
        if (!rows[y]) rows[y] = [];
        rows[y].push(b);
    });

    Object.values(rows).forEach(row => {
        // Sort by X
        row.sort((a, b) => parseFloat(a.dataset.x) - parseFloat(b.dataset.x));
        
        // Find contiguous segments
        let currentWord = [];
        for (let i = 0; i < row.length; i++) {
            const b = row[i];
            if (currentWord.length === 0) {
                currentWord.push(b);
            } else {
                const prev = currentWord[currentWord.length - 1];
                const dist = parseFloat(b.dataset.x) - (parseFloat(prev.dataset.x) + BLOCK_SIZE);
                if (dist < 10) { // close enough to be a word
                    currentWord.push(b);
                } else {
                    speakWord(currentWord);
                    currentWord = [b];
                }
            }
        }
        if (currentWord.length > 0) speakWord(currentWord);
    });
}

function speakWord(blockArray) {
    const word = blockArray.map(b => b.dataset.letter).join('');
    if (word.length < 1) return;

    const utterance = new SpeechSynthesisUtterance(word.toLowerCase());
    utterance.rate = 0.8;
    utterance.pitch = 1.2;
    
    // Visual feedback
    blockArray.forEach((b, i) => {
        setTimeout(() => {
            b.animate([
                { transform: `translate(${b.dataset.x}px, ${b.dataset.y}px) scale(1)` },
                { transform: `translate(${b.dataset.x}px, ${b.dataset.y}px) scale(1.2)` },
                { transform: `translate(${b.dataset.x}px, ${b.dataset.y}px) scale(1)` }
            ], { duration: 300 });
        }, i * 200);
    });

    if (blockArray[0].classList.contains('censored')) {
        // Don't read censored words clearly
        const censUtterance = new SpeechSynthesisUtterance("Oops! That's a naughty word.");
        window.speechSynthesis.speak(censUtterance);
        return;
    }

    window.speechSynthesis.speak(utterance);
    
    // Fun effect for longer words
    if (word.length >= 3) {
        setTimeout(() => {
            confetti({
                particleCount: 50,
                spread: 70,
                origin: { y: 0.6 }
            });
        }, word.length * 200);
    }
}

clearBtn.addEventListener('click', () => {
    sandbox.innerHTML = '';
});

readBtn.addEventListener('click', () => {
    readAllWords();
});

function setTool(tool) {
    currentTool = tool;
    [handBtn, knifeBtn, palinBtn].forEach(btn => btn.classList.remove('active'));
    if (tool === 'hand') handBtn.classList.add('active');
    if (tool === 'knife') knifeBtn.classList.add('active');
    if (tool === 'palin') palinBtn.classList.add('active');
}

handBtn.addEventListener('click', () => setTool('hand'));
knifeBtn.addEventListener('click', () => setTool('knife'));
palinBtn.addEventListener('click', () => setTool('palin'));

// Keyboard Logic
kbBtn.addEventListener('click', () => {
    if (isLockdown) return;
    modal.style.display = 'flex';
    wordInput.focus();
});

closeModalBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    wordInput.value = '';
});

nonoBtn.addEventListener('click', () => {
    nonoList.innerHTML = '';
    
    const h4_1 = document.createElement('h4');
    h4_1.textContent = "Censored Words:";
    nonoList.appendChild(h4_1);
    
    const swearList = document.createElement('div');
    swearList.className = 'nono-group';
    swearList.textContent = SWEAR_WORDS.join(', ');
    nonoList.appendChild(swearList);

    const h4_2 = document.createElement('h4');
    h4_2.textContent = "Forbidden (ALARM!) Words:";
    nonoList.appendChild(h4_2);

    const forbiddenList = document.createElement('div');
    forbiddenList.className = 'nono-group forbidden';
    forbiddenList.textContent = FORBIDDEN_WORDS.join(', ');
    nonoList.appendChild(forbiddenList);

    nonoModal.style.display = 'flex';
});

closeNonoBtn.addEventListener('click', () => {
    nonoModal.style.display = 'none';
});

function spawnWord(text) {
    const letters = text.toUpperCase().replace(/[^A-Z]/g, '').split('');
    if (letters.length === 0) return;

    const totalWidth = letters.length * (BLOCK_SIZE + 4);
    const startX = (sandbox.clientWidth / 2) - (totalWidth / 2);
    const startY = (sandbox.clientHeight / 2) - (BLOCK_SIZE / 2);

    letters.forEach((letter, i) => {
        spawnBlock(letter, startX + (i * (BLOCK_SIZE + 4)), startY);
    });
    
    setTimeout(checkWords, 100);
}

spawnWordBtn.addEventListener('click', () => {
    spawnWord(wordInput.value);
    modal.style.display = 'none';
    wordInput.value = '';
});

wordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        spawnWordBtn.click();
    }
});

// Initial greeting
window.addEventListener('load', () => {
    // Spawn 'H' 'I'
    const centerX = sandbox.clientWidth / 2;
    const centerY = sandbox.clientHeight / 2;
    spawnBlock('H', centerX - BLOCK_SIZE - 5, centerY - 40);
    spawnBlock('I', centerX + 5, centerY - 40);
});