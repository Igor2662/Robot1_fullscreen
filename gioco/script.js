// script.js — versione unificata (Livello1 + Livello2 + Livello3)
// include: import JSON multi-storie per L3, nuova sequenza random, celebrazione (immagine+suono+stelle)

const safeAudio = (src)=>{ try{ return new Audio(src); }catch(e){ return { play: ()=>{} }; } };
const soundError = safeAudio('error.mp3');
const soundCorrect = safeAudio('correct.mp3');
const soundSuccess = safeAudio('success.mp3');
const victorySound = safeAudio('sounds/victory.mp3');
if(victorySound && victorySound.volume !== undefined) victorySound.volume = 0.8;

const rows = 7;
const cols = 10;
let grid = [];
let player = { r:0, c:0 };
let orientation = 'S';
let wordList = ["CASA","LIBRO","PANE","GATTO","SOLE","FIORE","SCUOLA"];
let targetWord = '';
let collected = [];
let letters = [];
let traps = [];
let executing = false;
let currentLevel = 1;

// per tastierino numerico su LIM
let activeInput = null;

function attachNumpad(input) {
  input.addEventListener("click", () => {
    activeInput = input;
    document.getElementById("numPad").classList.remove("hidden");
  });
}

// gestione bottoni
document.querySelectorAll("#numPad button").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!activeInput) return;

    const value = btn.textContent;

    if (value === "C") {
      activeInput.value = "";
    } 
    else if (value === "OK") {
      document.getElementById("numPad").classList.add("hidden");
      activeInput = null;
    } 
    else {
      activeInput.value += value;
    }
  });
});

// per scalare il gioco e adattarlo automaticamente allo schermo oppure quella sotto

function scaleIfNeeded() {
  const wrapper = document.getElementById('app-wrapper');
  if (!wrapper) return; // 🔥 evita errori

  const scaleX = window.innerWidth / wrapper.offsetWidth;
  const scaleY = window.innerHeight / wrapper.offsetHeight;

  const scale = Math.min(scaleX, scaleY, 1);

  wrapper.style.transform = `scale(${scale})`;
  wrapper.style.transformOrigin = "top left";
}

window.addEventListener('load', scaleIfNeeded);
window.addEventListener('resize', scaleIfNeeded);

/* questa alternativa centra il gioco
function scaleIfNeeded() {
  const wrapper = document.getElementById('app-wrapper');
  if (!wrapper) return;

  const scaleX = window.innerWidth / wrapper.offsetWidth;
  const scaleY = window.innerHeight / wrapper.offsetHeight;

  const scale = Math.min(scaleX, scaleY, 1);

  wrapper.style.transform = `scale(${scale})`;

  // 🔥 CENTRATURA PERFETTA
  const offsetX = (window.innerWidth - wrapper.offsetWidth * scale) / 2;
  const offsetY = (window.innerHeight - wrapper.offsetHeight * scale) / 2;

  wrapper.style.transformOrigin = "top left";
  wrapper.style.position = "absolute";
  wrapper.style.left = `${offsetX}px`;
  wrapper.style.top = `${offsetY}px`;
}

window.addEventListener('load', scaleIfNeeded);
window.addEventListener('resize', scaleIfNeeded);
*/

// LEVEL 3 state
let allStories = [
    {
        story: "Ho voglia di un gelato.",
        sequence: ["💰", "🚲", "🏪", "🍦"],
        grid: [
            { x: 2, y: 3, icon: "💰", hintOrder: 1 },
            { x: 5, y: 3, icon: "🚲" },
            { x: 6, y: 7, icon: "🏪" },
            { x: 8, y: 4, icon: "🍦" }
        ]
    },
    {
        story: "Devo andare a scuola.",
        sequence: ["⏰", "🚶‍♂️", "🚌", "🏫"],
        grid: [
            { x: 1, y: 2, icon: "⏰" , hintOrder: 1},
            { x: 3, y: 2, icon: "🚶‍♂️" },
            { x: 4, y: 5, icon: "🚌" },
            { x: 7, y: 6, icon: "🏫" }
        ]
    },
    {
        story: "Preparo una torta.",
        sequence: ["🛒", "🥚", "🥣", "🎂"],
        grid: [
            { x: 0, y: 1, icon: "🛒" , hintOrder: 1},
            { x: 2, y: 4, icon: "🥚" },
            { x: 5, y: 6, icon: "🥣" },
            { x: 8, y: 2, icon: "🎂" }
        ]
    }
];

let currentStory = null; // storie in uso
let lastStoryIndex = -1;
let targetIcons = [];  // sequenza (array di emoji) corrente in L3


// LEVEL 4 state
//let correctPath = [];
//let startX = 0;
//let startY = 0;
//let loadedPaths = [];   // tutti i percorsi importati



const sleep = ms => new Promise(res => setTimeout(res, ms));

function normEmoji(e) {
    return [...String(e)].join('');
}

function getCellValue(cell){
    if(!cell) return '';

    // cerca un nodo testo puro che non sia span hint
    for (let node of cell.childNodes) {
        if(node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== '') {
            return node.nodeValue.trim();
        }
    }

    // fallback: unisce tutti i nodi testo ignorando span con hint-number
    let text = '';
    cell.childNodes.forEach(n => {
        if(n.nodeType === Node.TEXT_NODE) text += n.nodeValue;
        else if(n.nodeType === Node.ELEMENT_NODE && !n.classList.contains('hint-number')) {
            text += n.textContent;
        }
    });

    return text.trim();
}

// --- COLLEGA NUOVA PAROLA L1 AL COMPORTAMENTO DI L2 ---

// Bottone nuova parola L1
const newWordBtnL1 = document.getElementById("newWordBtnL1");
// Bottone nuova parola L2
const newWordBtnL2 = document.getElementById("newWordBtn");

// Quando si clicca L1, simula click sul bottone L2
newWordBtnL1.addEventListener("click", () => {
    newWordBtnL2.click();
});


// ---------- GRID ----------
function buildGrid(){
  const g = document.getElementById('grid'); if(!g) return;
  g.innerHTML=''; grid=[];
  for(let r=0;r<rows;r++){
    grid[r]=[];
    for(let c=0;c<cols;c++){
      const cell = document.createElement('div');
      cell.className='cell empty';
      cell.id=`cell-${r}-${c}`;
      g.appendChild(cell);
      grid[r][c]=cell;
    }
  }
}

function placeLettersRandom(word){
  letters = [];
  const taken = new Set(); taken.add('0-0');
  let idx=0;
  while(idx < word.length){
    const r = Math.floor(Math.random()*rows);
    const c = Math.floor(Math.random()*cols);
    const key = `${r}-${c}`;
    if(taken.has(key)) continue;
    taken.add(key);
    letters.push({r,c,ch:word[idx]});
    idx++;
  }
}

function placeSymbolsRandom(symbols) {
    if (!symbols || symbols.length === 0) return;

    letters = []; // resetta letters
    const taken = new Set(); 
    taken.add('0-0'); // cella iniziale del player

    let idx = 0;
    while (idx < symbols.length) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        const key = `${r}-${c}`;
        if (taken.has(key)) continue;
        taken.add(key);

        let symbol = symbols[idx];
        let displayIcon = symbol;
        let hintNumber = null;

        // separa eventuale numero hint
        const match = /^(\d+)(.+)/.exec(symbol);
        if (match) {
            hintNumber = match[1];
            displayIcon = match[2];
        }

        letters.push({ r, c, ch: displayIcon, hint: hintNumber });
        idx++;
    }
}

function placeTrapsRandom(n){
  traps=[]; 
  const taken=new Set(); 
  taken.add('0-0'); 
  letters.forEach(l=>taken.add(`${l.r}-${l.c}`));
  while(traps.length < n){
    const r = Math.floor(Math.random()*rows);
    const c = Math.floor(Math.random()*cols);
    const key = `${r}-${c}`;
    if(taken.has(key)) continue;
    taken.add(key);
    traps.push({r,c});
  }
}
// ---------- RENDER LETTERS / EMOJI / TRAPS ----------
// ---------- RENDER LETTERS / EMOJI / TRAPS ----------
function renderLettersAndTraps(mode="L3") {
    for(let r=0; r<rows; r++) {
        for(let c=0; c<cols; c++){
            const cell = grid[r][c];
            cell.classList.remove('letter','emoji','trap');
            cell.textContent='';
        }
    }

    letters.forEach(l=>{
        const cell = grid[l.r][l.c];
        if(!cell) return;

        if(mode === "L2") cell.classList.add('letter');
        else if(mode === "L3") cell.classList.add('emoji');

        // hint number
        if(l.hint !== undefined && l.hint !== null){
            const hintEl = document.createElement('span');
            hintEl.className = 'hint-number';
            hintEl.textContent = l.hint;
            hintEl.style.fontSize = '0.7em';
            hintEl.style.color = '#555';
            hintEl.style.marginRight = '2px';
            cell.appendChild(hintEl);
        }

        // emoji
        const emojiNode = document.createTextNode(normEmoji(l.ch));
        cell.appendChild(emojiNode);
    });

    traps.forEach(t=>{
        const cell = grid[t.r][t.c];
        if(!cell) return;
        cell.classList.add('trap');
        cell.textContent = "";
    });
}
// resetta il colore nei livelli 1-3
function resetTitle() {
    const title = document.getElementById('titleStatic');
    title.classList.remove('level4-title');
}


// colora di giallo il percorso sbagliato nel livello 4
function highlightWrongCell(r, c) {

    // vale solo per il livello 4
    if (currentLevel !== 4) return;

    const index = r * cols + c;
    const cell = grid.children[index];

    if (!cell) return;

    cell.classList.add("wrong-cell");

    setTimeout(() => {
        cell.classList.remove("wrong-cell");
    }, 2000);
}


// resetta la griglia su L3 quando si provine da un altro livello, se già caricato il file json
function clearGridForLevel3() {
    for(let r = 0; r < rows; r++){
        for(let c = 0; c < cols; c++){
            const cell = document.getElementById(`cell-${r}-${c}`);
            if(!cell) continue;
            cell.textContent = '';
            cell.style.backgroundColor = '';
            cell.className = 'grid-cell'; // ripristina classi di base
        }
    }
    // rimuove eventuali elementi robot residui
    document.querySelectorAll('.player-root').forEach(e => e.remove());
}





// ---------- PLAYER ----------
function updatePlayer() {

    // Rimuovi robot precedente
    document.querySelectorAll('.player-root').forEach(e => e.remove());

    // Crea contenitore principale del robot
    const root = document.createElement('div');
    root.className = 'player-root';
    root.style.position = 'relative';
    root.style.width = '32px';
    root.style.height = '32px';
    root.style.margin = '0 auto';

    // Nel livello 4 il robot deve essere overlay
    if (currentLevel === 4) {
        root.style.position = 'absolute';
        root.style.top = '0';
        root.style.left = '0';
        root.style.width = '100%';
        root.style.height = '100%';
        root.style.display = 'flex';
        root.style.alignItems = 'center';
        root.style.justifyContent = 'center';
        root.style.pointerEvents = 'none';
        root.style.zIndex = '10';
    }

    // Gruppo che ruota
    const group = document.createElement('div');
    group.className = 'orient-group';
    group.style.position = 'absolute';
    group.style.left = '50%';
    group.style.top = '50%';
    group.style.width = '32px';
    group.style.height = '32px';
    group.style.transform = 'translate(-50%, -50%) ' + (
        orientation === 'S' ? 'rotate(0deg)' :
        orientation === 'E' ? 'rotate(-90deg)' :
        orientation === 'N' ? 'rotate(180deg)' :
                              'rotate(90deg)'
    );
    group.style.transition = 'transform 0.25s ease';

    // Immagine PNG del robot
    const img = document.createElement('img');
    img.src = 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png';
    img.className = 'player-icon';
    img.style.width = '32px';
    img.style.height = '32px';

    // Triangolino direzionale
    const pointer = document.createElement('div');
    pointer.className = 'direction-pointer';
    pointer.style.position = 'absolute';
    pointer.style.left = '50%';
    pointer.style.transform = 'translateX(-50%)';
    pointer.style.bottom = '-10px';

    // Montaggio
    group.appendChild(img);
    group.appendChild(pointer);
    root.appendChild(group);

    // Inserimento nella cella
    const cell = document.getElementById(`cell-${player.r}-${player.c}`);
    if (cell) cell.appendChild(root);
}


function resetGame(full=true){
  player={r:0,c:0}; orientation='S'; collected=[];
  const msg = document.getElementById('message'); if(msg) msg.textContent='';

  // default to word mode: set targetWord and slots
  targetWord = wordList[Math.floor(Math.random()*wordList.length)];
  const tw = document.getElementById('targetWord');
  if(tw) { tw.textContent = targetWord; tw.style.display='inline'; }
  const st = document.getElementById('storyText'); if(st) st.style.display='none';

  const cw = document.getElementById('collectedWord'); if(cw){ cw.innerHTML=''; for(let i=0;i<targetWord.length;i++){ const s=document.createElement('div'); s.className='letter-slot'; s.id=`slot-${i}`; cw.appendChild(s);} }

  buildGrid();
  placeLettersRandom(targetWord);
  placeTrapsRandom(parseInt((document.getElementById('trapCount') && document.getElementById('trapCount').value) || 6));
  renderLettersAndTraps();
  updatePlayer();
}
function softResetAfterError(mode="L3") {
    // Non toccare collected o slot
    const msgEl = document.getElementById('message');
    if(msgEl) msgEl.textContent = "Sequenza sbagliata, ritenta senza perdere le icone catturate!";
    robotSpeak("Sequenza sbagliata, ritenta senza perdere le icone catturate!", msgEl);

    // Svuota solo la sequenza corrente
    if(mode==="L3"){
        const seq = document.getElementById('iconSequence');
        if(seq) seq.innerHTML = '';
    } else {
        const seq = document.getElementById('sequence');
        if(seq) seq.innerHTML = '';
    }

    // Reset robot alla posizione iniziale della sequenza
    player = { r: 0, c: 0 };
    orientation = 'S';
    updatePlayer();
}


// ---------- MOVEMENT & CHECK ----------
// ---------- MOVEMENT & CHECK (unificata L1, L2, L3) ----------
async function checkCellAfterMove(mode){
    const cell = grid[player.r] && grid[player.r][player.c];
    const msgEl = document.getElementById('message');
    if(!cell) return { ok:true };

    // -------- TRAPPOLA (tutti i livelli) --------
    if(cell.classList.contains('trap')){
        try { soundError.play(); } catch(e){}
        robotSpeak("Oh no, sono caduto in una trappola!", msgEl);

        cell.classList.add('shake');
        await sleep(1000);
        cell.classList.remove('shake');

        softResetAfterError(mode);

        // ritorno alla posizione iniziale
        player = { r:0, c:0 };
        orientation = 'S';
        updatePlayer();

        return { ok:false, reason:'trap' };
    }

    // -------- CELLA CON LETTERA / EMOJI --------
    let ch = '';
    if(cell.textContent.trim() !== ''){
        // L1/L2 → lettera, L3 → emoji
        if(mode === "L1" || mode === "L2"){
            cell.childNodes.forEach(n => {
                if(n.nodeType === Node.TEXT_NODE) ch += n.nodeValue;
                else if(n.nodeType === Node.ELEMENT_NODE && !n.classList.contains('hint-number')){
                    ch += n.textContent;
                }
            });
            ch = ch.trim();
        } else if(mode === "L3" && cell.classList.contains('emoji')){
            // prendi solo il testo principale (ignora span hint)
            const textNode = Array.from(cell.childNodes)
                .find(n => n.nodeType === Node.TEXT_NODE);
            ch = textNode ? textNode.nodeValue.trim() : '';
        }
    }

    if(ch !== ''){
        const expected = mode === "L3" ? targetIcons[collected.length] : targetWord[collected.length];
        if((mode==="L3" && normEmoji(ch) === normEmoji(expected)) || (mode!=="L3" && ch === expected)){
            collected.push(ch);
            const slot = document.getElementById(`slot-${collected.length-1}`);
            if(slot) slot.textContent = ch;

            cell.classList.remove('letter','emoji');
            cell.textContent = '';
            updatePlayer();
            try{ soundCorrect.play(); } catch(e){}

            if(mode==="L3" ? collected.length === targetIcons.length : collected.length === targetWord.length){
                try{ soundSuccess.play(); } catch(e){}
                robotSpeak("Hai completato la sequenza!", msgEl);
                celebrateWithImage();
            }

        } else {
            // ❌ Lettera / emoji sbagliata
            cell.classList.add("shake");
            try { if(soundError){ soundError.currentTime=0; soundError.play(); } } catch(e){}
            robotSpeak("Elemento sbagliato!", msgEl);
            await sleep(1000);
            cell.classList.remove("shake");

            player = { r:0, c:0 };
            orientation = 'S';
            updatePlayer();

            return { ok:false, reason:'wrongLetter' };
        }
    }

    // -------- CELLA VUOTA --------
    else if(cell.textContent.trim() === ''){
        // L1: ignorare
        if(mode==="L1") return { ok:true };

        // L2/L3: avvisa e reset
        try{ soundError.play(); } catch(e){}
        robotSpeak("Sei finito su una cella vuota!", msgEl);

        cell.classList.add('shake');
        await sleep(1000);
        cell.classList.remove('shake');

        player = { r:0, c:0 };
        orientation = 'S';
        updatePlayer();

        return { ok:false, reason:'empty' };
    }

    return { ok:true };
}

async function moveRight(n=1, mode="L1"){
  if(orientation!=='E'){ robotSpeak("Devi guardare a destra!", document.getElementById('message')); try{ soundError.play(); }catch(e){}; return; }
  for(let i=0;i<n;i++){ player.c = Math.min(cols-1, player.c+1); updatePlayer(); const r = await checkCellAfterMove(mode); if(!r.ok) return; }
}
async function moveLeft(n=1, mode="L1"){
  if(orientation!=='W'){ robotSpeak("Devi guardare a sinistra!", document.getElementById('message')); try{ soundError.play(); }catch(e){}; return; }
  for(let i=0;i<n;i++){ player.c = Math.max(0, player.c-1); updatePlayer(); const r = await checkCellAfterMove(mode); if(!r.ok) return; }
}
async function moveUp(n=1, mode="L1"){
  if(orientation!=='N'){ robotSpeak("Devi guardare in su!", document.getElementById('message')); try{ soundError.play(); }catch(e){}; return; }
  for(let i=0;i<n;i++){ player.r = Math.max(0, player.r-1); updatePlayer(); const r = await checkCellAfterMove(mode); if(!r.ok) return; }
}
async function moveDown(n=1, mode="L1"){
  if(orientation!=='S'){ robotSpeak("Devi guardare in giù!", document.getElementById('message')); try{ soundError.play(); }catch(e){}; return; }
  for(let i=0;i<n;i++){ player.r = Math.min(rows-1, player.r+1); updatePlayer(); const r = await checkCellAfterMove(mode); if(!r.ok) return; }
}
async function jump(n=1, mode="L1"){ await moveRight(n, mode); }

function rotate(dir){
  if(dir==='R' || dir==='rotR'){ orientation = orientation==='N' ? 'E' : orientation==='E' ? 'S' : orientation==='S' ? 'W' : 'N'; }
  else { orientation = orientation==='N' ? 'W' : orientation==='W' ? 'S' : orientation==='S' ? 'E' : 'N'; }
  updatePlayer();
}

// ---------- SEQUENCE TOOLBOX (L2) ----------
let seqSortable, toolboxSortable;
function setupToolboxAndSequence() {
  const toolbox = document.getElementById('toolbox');
  if (toolbox) toolbox.innerHTML = '';

  const defs = [
    { action: 'moveRight', cls: 'cmd-right', icon: '➡️' },
    { action: 'moveLeft', cls: 'cmd-left', icon: '⬅️' },
    { action: 'moveUp', cls: 'cmd-up', icon: '⬆️' },
    { action: 'moveDown', cls: 'cmd-down', icon: '⬇️' },
    { action: 'rotR', cls: 'cmd-rotR', icon: '↻<span class="small-text">D</span>' },
    { action: 'rotL', cls: 'cmd-rotL', icon: '↺<span class="small-text">S</span>' },
    { action: 'jump', cls: 'cmd-jump', icon: '⤴️' }
  ];

  // --- CREA TESSERE TOOLBOX ---
  defs.forEach(d => {
    const el = document.createElement('div');
    el.className = `tool ${d.cls}`;
    el.dataset.action = d.action;
    el.draggable = true;

    const ic = document.createElement('div');
    ic.className = 'icon';
    ic.innerHTML = d.icon;
    el.appendChild(ic);

    const hint = document.createElement('div');
    hint.style.fontSize = '12px';
    hint.style.color = '#555';
    //hint.textContent = 'Trascina';
    el.appendChild(hint);

    toolbox.appendChild(el);
  });

  // --- SORTABLE TOOLBOX (solo clonaggio) ---
  Sortable.create(toolbox, {
    group: { name: 'shared', pull: 'clone', put: false },
    sort: false,
    animation: 150
  });

  // --- SORTABLE SEQUENZA ---
  const seq = document.getElementById('sequence');
  seq.innerHTML = '';

  Sortable.create(seq, {
      group: { name: 'shared', pull: false, put: true },
      animation: 150,
      removeOnSpill: true,

      // 👉 drag solo dall’icona
      handle: '.icon',

      // 👉 gli input NON devono attivare il drag
      filter: 'input, [data-no-drag="true"]',
      onFilter(evt) {
          if (evt.target.tagName === 'INPUT') {
              evt.preventDefault();
              evt.target.focus();
          }
      },

      onAdd(evt) {
          const node = evt.item;
          node.className = 'seq-block';

          const action = node.dataset.action || node.getAttribute('data-action');
          node.dataset.action = action;
          node.innerHTML = '';

          // Icona
          const ic = document.createElement('div');
          ic.className = 'icon';
          ic.innerHTML =
              action === 'moveRight' ? '➡️' :
              action === 'moveLeft' ? '⬅️' :
              action === 'moveUp' ? '⬆️' :
              action === 'moveDown' ? '⬇️' :
              action === 'rotR' ? '↻<span class="small-text">D</span>' :
              action === 'rotL' ? '↺<span class="small-text">S</span>' :
              '⤴️';
          node.appendChild(ic);

          // 👉 Input compatibile con Chrome tablet
          const input = document.createElement('input');
		  attachNumpad(input);
          input.readOnly = true;
          input.type = 'text';
          input.inputMode = 'numeric';
          input.pattern = '[0-9]*';
          input.value = '1';
          input.classList.add('seq-input');
          input.setAttribute('data-no-drag', 'true');
          node.appendChild(input);

          // Pulsante X
          const rm = document.createElement('button');
          rm.className = 'remove';
          rm.textContent = '✖';
          rm.onclick = () => node.remove();
          node.appendChild(rm);
      }
  });

}


function clearSequence(){ document.getElementById('sequence') && (document.getElementById('sequence').innerHTML=''); }

// ---------- ROBOT SPEECH ----------
function robotSpeak(text, msgEl){
  if(!('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'it-IT';
  utter.rate = 1;
  utter.pitch = 1;
  if(msgEl) msgEl.textContent = text;
  utter.onend = () => { if(msgEl) msgEl.textContent = ''; };
  speechSynthesis.speak(utter);
}

// ---------- TRAP DESTRUCTION ----------
async function destroyTrapStep(){
  // salva la posizione di partenza
  const prevR = player.r;
  const prevC = player.c;

  // muovi in base all'orientamento
  if(orientation === 'N') player.r = Math.max(0, player.r-1);
  else if(orientation === 'S') player.r = Math.min(rows-1, player.r+1);
  else if(orientation === 'E') player.c = Math.min(cols-1, player.c+1);
  else if(orientation === 'W') player.c = Math.max(0, player.c-1);

  updatePlayer();

  const cell = grid[player.r] && grid[player.r][player.c];
  const msgEl = document.getElementById('message');

  if(cell && cell.classList.contains('trap')){
    // ✅ caso trappola: esplosione
    cell.classList.remove('trap');
    cell.textContent = '';
    try{ soundCorrect.play(); }catch(e){}
    robotSpeak("Ho distrutto la trappola!", msgEl);

    const overlay = document.createElement('div');
    overlay.className = 'explosion-overlay';
    cell.appendChild(overlay);

    await new Promise(res => setTimeout(res, 1000));
    overlay.remove();
    updatePlayer();
  } else {
    // ❌ nessuna trappola: shake + ritorno DOPO
    try{ soundError.play(); }catch(e){}
    robotSpeak("Nessuna trappola da distruggere… ritorno indietro!", msgEl);

    if(cell){
      cell.classList.add("shake");
      await new Promise(res => setTimeout(res, 1000)); // attende fine shake
      cell.classList.remove("shake");
    }

    // solo dopo ritorna alla cella di provenienza
    player.r = prevR;
    player.c = prevC;
    updatePlayer();
  }
}


// ---------- EXECUTE SEQUENCE (BOMB & NORMAL) ----------
// ---------- EXECUTE SEQUENCE (BOMB - versione rigida) ----------
async function executeSequenceBombFromContainer(containerId, mode="L2") {
    if(executing) return;
    executing = true;
    const msgEl = document.getElementById('message');
    robotSpeak("Sto eseguendo la sequenza con bomba!", msgEl);

    const seqEl = document.getElementById(containerId);
    if(!seqEl){ executing = false; return; }
    const seq = Array.from(seqEl.children);

    const startR = player.r;
    const startC = player.c;
    const startOrientation = orientation;

    // Pre-calcolo cella finale
    let finalR = startR, finalC = startC;
    seq.forEach(node=>{
        const action = node.dataset.action || node.getAttribute('data-action');
        const valEl = node.querySelector('input');
        const val = parseInt(valEl ? valEl.value : (node.dataset.count||1)) || 1;
        for(let i=0;i<val;i++){
            if(action==='R' || action==='moveRight') finalC = Math.min(cols-1, finalC+1);
            else if(action==='L' || action==='moveLeft') finalC = Math.max(0, finalC-1);
            else if(action==='U' || action==='moveUp') finalR = Math.max(0, finalR-1);
            else if(action==='D' || action==='moveDown') finalR = Math.min(rows-1, finalR+1);
            else if(action==='J' || action==='jump') finalC = Math.min(cols-1, finalC+1);
        }
    });

    let pathTrapTriggered = false;

    // Esecuzione passo passo con vincolo di orientamento
    for(const node of seq){
        const action = node.dataset.action || node.getAttribute('data-action');
        const valEl = node.querySelector('input');
        const val = parseInt(valEl ? valEl.value : (node.dataset.count||1)) || 1;

        for(let i=0;i<val;i++){
            // Controllo orientamento rigido
            if(action==='moveRight' || action==='R'){
                if(orientation!=='E'){ await wrongOrientation(startR,startC,startOrientation); return; }
                player.c = Math.min(cols-1, player.c+1);
            }
            else if(action==='moveLeft' || action==='L'){
                if(orientation!=='W'){ await wrongOrientation(startR,startC,startOrientation); return; }
                player.c = Math.max(0, player.c-1);
            }
            else if(action==='moveUp' || action==='U'){
                if(orientation!=='N'){ await wrongOrientation(startR,startC,startOrientation); return; }
                player.r = Math.max(0, player.r-1);
            }
            else if(action==='moveDown' || action==='D'){
                if(orientation!=='S'){ await wrongOrientation(startR,startC,startOrientation); return; }
                player.r = Math.min(rows-1, player.r+1);
            }
            else if(action==='jump' || action==='J'){
                if(orientation!=='E'){ await wrongOrientation(startR,startC,startOrientation); return; }
                player.c = Math.min(cols-1, player.c+1);
            }
            else if(action==='rotR' || action==='RR') rotate('R');
            else if(action==='rotL' || action==='RL') rotate('L');

            updatePlayer();
            await sleep(350);

            const cell = grid[player.r][player.c];
            const isFinalCell = (player.r===finalR && player.c===finalC);

            // Se trappola intermedia
            if(cell && cell.classList.contains('trap') && !isFinalCell){
                pathTrapTriggered = true;
                break;
            }
        }
        if(pathTrapTriggered) break;
    }

    const finalCell = grid[player.r][player.c];

    if(pathTrapTriggered){
        try{ soundError.play(); }catch(e){}
        robotSpeak("💥 Oh no! Sono caduto in una trappola!", msgEl);

        const cellHit = grid[player.r][player.c];
        if(cellHit){
            cellHit.classList.add('shake');
            await sleep(1000);
            cellHit.classList.remove('shake');
        }

        // Solo dopo ritorno
        player.r = startR; player.c = startC; orientation = startOrientation;
        updatePlayer();

        executing=false;
        return;
    } else if(finalCell && finalCell.classList.contains('trap')){
        try{ soundCorrect.play(); }catch(e){}
        robotSpeak("💥 Ho distrutto la trappola finale!", msgEl);

        // Effetto esplosione
        const overlay = document.createElement('div');
        overlay.className = 'explosion-overlay';
        finalCell.appendChild(overlay);

        await sleep(1000); // durata esplosione
        overlay.remove();

        // Solo dopo rimuovi la trappola
        finalCell.classList.remove('trap');
        finalCell.textContent = '';
        updatePlayer();
    } else {
        try{ soundError.play(); }catch(e){}
        robotSpeak("Nessuna trappola da distruggere, ritorno al punto di partenza.", msgEl);

        await sleep(1000);
        player.r = startR; player.c = startC; orientation = startOrientation;
        updatePlayer();
    }

    executing = false;
}


// ---------- EXECUTE SEQUENCE (NORMAL - versione rigida con controllo orientamento) ----------
async function executeSequenceFromContainer(containerId, mode="L2") {
    if(executing) return;
    executing = true;
    const msgEl = document.getElementById('message');
    robotSpeak("Sto eseguendo la sequenza!", msgEl);

    const collectedBefore = collected.length;
    const seqEl = document.getElementById(containerId);
    if(!seqEl){ executing=false; return; }
    const seq = Array.from(seqEl.children);

    const startR = player.r;
    const startC = player.c;
    const startOrientation = orientation;

    for(const node of seq){
        const action = node.dataset.action || node.getAttribute('data-action');
        const valEl = node.querySelector('input');
        const val = parseInt(valEl ? valEl.value : (node.dataset.count||1)) || 1;

        for(let i=0;i<val;i++){
            // Controllo orientamento rigido
            if(action==='moveRight' || action==='R'){
                if(orientation!=='E'){ await wrongOrientation(startR,startC,startOrientation); return; }
                player.c = Math.min(cols-1, player.c+1);
            }
            else if(action==='moveLeft' || action==='L'){
                if(orientation!=='W'){ await wrongOrientation(startR,startC,startOrientation); return; }
                player.c = Math.max(0, player.c-1);
            }
            else if(action==='moveUp' || action==='U'){
                if(orientation!=='N'){ await wrongOrientation(startR,startC,startOrientation); return; }
                player.r = Math.max(0, player.r-1);
            }
            else if(action==='moveDown' || action==='D'){
                if(orientation!=='S'){ await wrongOrientation(startR,startC,startOrientation); return; }
                player.r = Math.min(rows-1, player.r+1);
            }
            else if(action==='jump' || action==='J'){
                if(orientation!=='E'){ await wrongOrientation(startR,startC,startOrientation); return; }
                player.c = Math.min(cols-1, player.c+1);
            }
            else if(action==='rotR' || action==='RR') rotate('R');
            else if(action==='rotL' || action==='RL') rotate('L');
            else if(action==='destroyTrap') await destroyTrapStep();

            updatePlayer();
            await sleep(350);

            // Controllo immediato della cella
            const cell = grid[player.r][player.c];
            if(cell && cell.classList.contains('trap')){
                try{ soundError.play(); }catch(e){}
                robotSpeak("💥 Oh no! Sono caduto in una trappola!", msgEl);

                cell.classList.add('shake');
                await sleep(1000);
                cell.classList.remove('shake');

                player.r = startR; player.c = startC; orientation = startOrientation;
                updatePlayer();
                executing=false;
                return;
            }
        }
    }

    const cell = grid[player.r] && grid[player.r][player.c];

    if(cell){
        // -------- CATTURA LETTERA/ICONA --------
        const hasContent = cell.textContent.trim() !== '';

        const isCorrectCell = (mode==="L2" && hasContent) ||
                              (mode==="L3" && cell.classList.contains('emoji'));

        if(isCorrectCell){
            // prende SOLO l’emoji ignorando il numero
            const textNode = Array.from(cell.childNodes)
                .find(n => n.nodeType === Node.TEXT_NODE);

            const ch = textNode ? textNode.nodeValue.trim() : '';
			
            const expected = (mode==="L3" ? targetIcons[collected.length] : targetWord[collected.length]);

            if(normEmoji(ch) === normEmoji(expected)){
                collected.push(normEmoji(ch));
                const slot = document.getElementById(`slot-${collected.length-1}`);
                if(slot) slot.textContent = ch;

                cell.classList.remove('letter','emoji');
                cell.textContent='';
                updatePlayer();
                try{ soundCorrect.play(); }catch(e){}

                if(collected.length === (mode==="L3" ? targetIcons.length : targetWord.length)){
                    try{ soundSuccess.play(); }catch(e){}
                    robotSpeak("Complimenti!", msgEl);
                    celebrateWithImage();
                }
            } else {
                // ❌ Lettera/Icona sbagliata
                try{ soundError.play(); }catch(e){}
                robotSpeak("Elemento sbagliato!", msgEl);

                cell.classList.add('shake');
                await sleep(1000);
                cell.classList.remove('shake');

                player.r = startR; player.c = startC; orientation = startOrientation;
                updatePlayer();
                executing=false;
                return;
            }
        }

        // -------- CELLA VUOTA --------
        else if(cell.textContent.trim() === ''){
            try{ soundError.play(); }catch(e){}
            robotSpeak("Sei finito su una cella vuota!", msgEl);

            cell.classList.add('shake');
            await sleep(1000);
            cell.classList.remove('shake');

            player.r = startR; player.c = startC; orientation = startOrientation;
            updatePlayer();
            executing=false;
            return;
        }
    }

    // -------- Controllo finale --------
    const capturedThisRun = collected.length > collectedBefore;
    if(mode==="L3" ? (collected.length === targetIcons.length) : (collected.length === targetWord.length)){
        try{ soundSuccess.play(); }catch(e){}
        robotSpeak("Hai completato la sequenza!", msgEl);
        celebrateWithImage();
    } else if(!capturedThisRun){
        try{ soundError.play(); }catch(e){}
        robotSpeak("Sequenza non valida: nessuna cattura.", msgEl);

        cell?.classList.add('shake');
        await sleep(1000);
        cell?.classList.remove('shake');

        player.r = startR; player.c = startC; orientation = startOrientation;
        updatePlayer();
    }

    executing=false;
}

// Funzione di supporto per errore di orientamento
async function wrongOrientation(startR,startC,startOrientation){
    try{ soundError.play(); }catch(e){}
    robotSpeak("Orientamento sbagliato! Non posso muovermi in quella direzione.", document.getElementById('message'));

    const cellHit = grid[player.r][player.c];
    if(cellHit){
        cellHit.classList.add('shake');
        await sleep(1000);
        cellHit.classList.remove('shake');
    }

    player.r = startR; player.c = startC; orientation = startOrientation;
    updatePlayer();
    executing=false;
}


// ---------- CLEAR ----------
function clearAllSequences() {
    // Svuota i contenitori delle sequenze
    const s1 = document.getElementById('sequence'); 
    if (s1) s1.innerHTML = '';

    const s2 = document.getElementById('iconSequence'); 
    if (s2) s2.innerHTML = '';

    // Reset raccolta
    collected = [];

    // Svuota gli slot
    const slots = document.querySelectorAll("[id^='slot-']");
    slots.forEach(s => s.textContent = "");

    // Reset robot
    player = { r: 0, c: 0 };
    orientation = 'S';
    updatePlayer();

    // Messaggio sullo schermo
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = "Pronto per una nuova missione!";

    // Messaggio vocale del robot
    robotSpeak("Pronto per una nuova missione!", msgEl);
}



// ---------- UI wiring (words import) ----------
document.getElementById('runSeqBomb') && document.getElementById('runSeqBomb').addEventListener('click', ()=>executeSequenceBombFromContainer('sequence'));
document.getElementById('runSeq') && document.getElementById('runSeq').addEventListener('click', ()=>executeSequenceFromContainer('sequence',"L2"));
document.getElementById('clearSeq') && document.getElementById('clearSeq').addEventListener('click', clearSequence);
document.getElementById('newWordBtn') && document.getElementById('newWordBtn').addEventListener('click', ()=>resetGame());
document.getElementById('regenTraps') && document.getElementById('regenTraps').addEventListener('click', ()=>{ placeTrapsRandom(parseInt((document.getElementById('trapCount')&&document.getElementById('trapCount').value)||6)); renderLettersAndTraps(); updatePlayer(); });
document.getElementById('resetBtn') && document.getElementById('resetBtn').addEventListener('click', ()=>resetGame());
document.getElementById('importWords') && document.getElementById('importWords').addEventListener('click', ()=>document.getElementById('wordFile').click());
document.getElementById('wordFile') && document.getElementById('wordFile').addEventListener('change', async (event)=>{
  const file = event.target.files[0];
  if(!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    if(Array.isArray(data)){
      wordList = data;
      alert("Nuove parole caricate!");
      resetGame();
    } else {
      alert("Formato JSON non valido. Deve essere un array di stringhe.");
    }
  } catch(e){
    alert("Errore nel parsing del file JSON.");
    console.error(e);
  }
});

// ---------- CURRENT LEVEL TRACKER ----------
//let currentLevel = 1;

//document.getElementById('btnLevel1').onclick = () => { currentLevel = 1; };
//document.getElementById('btnLevel2').onclick = () => { currentLevel = 2; };
//document.getElementById('btnLevel3').onclick = () => { currentLevel = 3; };
//document.getElementById('btnLevel4').onclick = () => { currentLevel = 4; };


// ---------- LEVEL SWITCH ----------
document.getElementById('btnLevel1') && document.getElementById('btnLevel1').addEventListener('click', ()=>{
  document.body.className = "level1";
  document.getElementById('level1').style.display='block';
  document.getElementById('level2').style.display='none';
  document.getElementById('level3').style.display='none';
  document.getElementById('targetWord').style.display='inline';
  document.getElementById('storyText').style.display='none';
  document.getElementById('titleStatic').textContent = "Costruisci la parola:";
  resetGame();

  resetTitle();


  
});
document.getElementById('btnLevel2') && document.getElementById('btnLevel2').addEventListener('click', ()=>{
  document.body.className = "level2";
  document.getElementById('level2').style.display='block';
  document.getElementById('level1').style.display='none';
  document.getElementById('level3').style.display='none';
  document.getElementById('targetWord').style.display='inline';
  document.getElementById('storyText').style.display='none';
  document.getElementById('titleStatic').textContent = "Costruisci la parolla:";
  resetGame();

  resetTitle();
  
});
document.getElementById('btnLevel3')?.addEventListener('click', () => {
    document.body.className = "level3";
    document.getElementById('level3').style.display='block';
    document.getElementById('level1').style.display='none';
    document.getElementById('level2').style.display='none';
    document.getElementById('targetWord').style.display='none';
    document.getElementById('storyText').style.display='inline';
    document.getElementById('titleStatic').textContent = "ricostruisci la sequenza:";

    // pulisce sequenza precedente
    clearGridForLevel3();   
    clearIconSequence();    

    // ricostruisce griglia e icone usando la storia corrente
    if(currentStory) renderStory(currentStory);

    resetTitle();
    
});




// ---------- LIVELLO 4 ---------- funzionava benino

//document.getElementById('btnLevel4') && document.getElementById('btnLevel4').addEventListener('click', ()=>{
  //document.getElementById('level4').style.display='block';
  //document.getElementById('level1').style.display='none';
  //document.getElementById('level2').style.display='none';
  //document.getElementById('level3').style.display='none';

  // Mostra titolo o testo specifico del livello 4
  //document.getElementById('targetWord').style.display='none';
  //document.getElementById('storyText').style.display='inline';

  // Inizializza griglia e percorso robot
  //buildGrid();
  //resetRobot();  // funzione da creare per posizionare il robot sulla casella di partenza
  //renderLettersAndTraps();
//});

document.getElementById('randomPath')?.addEventListener('click', () => {
    if (builtInPaths.length === 0) {
        alert("Nessun percorso predefinito disponibile.");
        return;
    }

    const random = builtInPaths[Math.floor(Math.random() * builtInPaths.length)];

    loadLevel4Path(random);  // 🔥 NON random.path

    showMessage("Percorso caricato: " + random.name);
});




// ---------- ICON TOOLBOX / ICON SEQUENCE (L3) ----------
function setupIconToolboxAndSequence(){
  const iconToolbox = document.getElementById('iconToolbox'); 
  if(iconToolbox) iconToolbox.innerHTML='';

  const defs = [
    {action:'R',  cls:'cmd-right', icon:'➡️'},
    {action:'L',  cls:'cmd-left',  icon:'⬅️'},
    {action:'U',  cls:'cmd-up',    icon:'⬆️'},
    {action:'D',  cls:'cmd-down',  icon:'⬇️'},
    {action:'RR', cls:'cmd-rotR',  icon:'↻<span class="small-text">D</span>'},
    {action:'RL', cls:'cmd-rotL',  icon:'↺<span class="small-text">S</span>'},
    {action:'J',  cls:'cmd-jump',  icon:'⤴️'},
  ];
   

  // --- CREA TOOLBOX ---
  defs.forEach(d=>{
    const el = document.createElement('div');
    el.className = `tool ${d.cls} icon-tool`;
    el.dataset.action = d.action;
    el.draggable = true;

    const ic = document.createElement('div'); 
    ic.className='icon'; 
    ic.innerHTML = d.icon; 
    el.appendChild(ic);

    const hint = document.createElement('div'); 
    hint.style.fontSize='12px'; 
    hint.style.color='#555'; 
    //hint.textContent='Trascina'; 
    el.appendChild(hint);

    iconToolbox.appendChild(el);
  });

  // --- SORTABLE TOOLBOX (clone only) ---
  Sortable.create(iconToolbox, {
    group: { name: 'shared-icons', pull: 'clone', put: false },
    sort: false,
    animation: 150
  });

  // --- SORTABLE SEQUENZA ---
  const seq = document.getElementById('iconSequence'); 
  seq.innerHTML='';

  Sortable.create(seq, {
      group: { name: 'shared-icons', pull: false, put: true },
      animation: 150,
      removeOnSpill: true,

      // 👉 drag solo dall’icona
      handle: '.icon',

      // 👉 input NON trascinabili
      filter: 'input, [data-no-drag="true"]',
      onFilter(evt) {
          if (evt.target.tagName === 'INPUT') {
              evt.preventDefault();
              evt.target.focus();
          }
      },

      onAdd(evt) {
          const action = evt.item.dataset.action;

          const block = document.createElement('div');
          block.className = 'icon-seq-block';
          block.dataset.action = action;

          const ic = document.createElement('div');
          ic.className = 'icon';
          ic.innerHTML =
              action === 'R'  ? '➡️' :
              action === 'L'  ? '⬅️' :
              action === 'U'  ? '⬆️' :
              action === 'D'  ? '⬇️' :
              action === 'RR' ? '↻<span class="small-text">D</span>' :
              action === 'RL' ? '↺<span class="small-text">S</span>' :
                              '⤴️';
          block.appendChild(ic);

          // 👉 Input compatibile con Chrome tablet
          const input = document.createElement('input');
		  attachNumpad(input);
          input.readOnly = true;
          input.type = 'text';
          input.inputMode = 'numeric';
          input.pattern = '[0-9]*';
          input.value = '1';
          input.classList.add('seq-input');
          input.setAttribute('data-no-drag', 'true');
          block.appendChild(input);

          const rm = document.createElement('button');
          rm.className = 'remove';
          rm.textContent = '✖';
          rm.onclick = () => block.remove();
          block.appendChild(rm);

          evt.item.replaceWith(block);
      }
  });
}

function clearIconSequence(){ const el = document.getElementById('iconSequence'); if(el) el.innerHTML=''; }

// ---------- IMPORT ICON JSON (L3) ----------
// file input: #iconFile, button: #importIcons
document.getElementById('importIcons') && document.getElementById('importIcons').addEventListener('click', ()=>document.getElementById('iconFile').click());

// When a JSON file is selected, parse and store all stories in allStories.
document.getElementById('iconFile') && document.getElementById('iconFile').addEventListener('change', async (event)=>{
  const file = event.target.files[0];
  if(!file) return;
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch(err){
    alert("Errore: file JSON non valido.");
    console.error(err);
    return;
  }

  // Accept either single-object or array-of-objects
  if(Array.isArray(data)){
    // keep only valid stories with 'sequence' array
    allStories = data.filter(d => d && Array.isArray(d.sequence) && d.sequence.length>0);
  } else if(data && Array.isArray(data.sequence)) {
    allStories = [data];
  } else {
    alert("Formato JSON icone non riconosciuto.");
    return;
  }

  if(allStories.length === 0){
    alert("Nessuna sequenza valida trovata nel file.");
    return;
  }

  // prepare first random story immediately
  loadRandomStory();
  alert(`${allStories.length} sequenze caricate!`);
});

// ---------- LOAD & RENDER STORY (L3) ----------
function loadRandomStory(){
  if(allStories.length === 0) {
    alert("Prima importa un file JSON con sequenze.");
    return;
  }
  // Pulisce sequenze precedenti e resetta raccolta/slot/robot
  clearAllSequences();
  let newIndex;
  do {
    newIndex = Math.floor(Math.random() * allStories.length);
  } while(allStories.length > 1 && newIndex === lastStoryIndex);

  lastStoryIndex = newIndex;
  currentStory = allStories[newIndex];

  renderStory(currentStory);
}

function renderStory(story){
    if(!story) return;
    collected = [];

    const storyEl = document.getElementById('storyText'); 
    if(storyEl) storyEl.textContent = story.story || '';

    // target icons: estrai solo l'emoji principale per il confronto
    targetIcons = story.sequence.map(x => 
        typeof x === 'string' ? x : (x.icon || String(x))
    );

    // ricrea SEMPRE gli slot per il livello 3
    const cw = document.getElementById('collectedWord'); 
    if (cw) {
        cw.innerHTML = ""; // svuota slot precedenti
        for (let i = 0; i < targetIcons.length; i++) {
            const s = document.createElement('div');
            s.className = 'letter-slot';
            s.id = `slot-${i}`;
            cw.appendChild(s);
        }
    }

    buildGrid();

    // prepara simboli con eventuali hint numerici
    const symbolsWithHint = story.grid.map(cell => {
        if(cell.hintOrder !== undefined && cell.hintOrder !== null) {
            return `${cell.hintOrder}${cell.icon}`;
        }
        return cell.icon;
    });

    placeSymbolsRandom(symbolsWithHint);

    placeTrapsRandom(parseInt((document.getElementById('trapCount') && document.getElementById('trapCount').value) || 6));
    renderLettersAndTraps("L3");
    updatePlayer();
}


// ==================== Livello 4 – Percorso Robot ====================

// ====== Percorsi predefiniti per Livello 4 ======
const builtInPaths = [
    {
        name: "Linea orizzontale",
        path: [
            {x:0, y:0},
            {x:1, y:0},
            {x:2, y:0},
            {x:3, y:0}
        ]
    },
    {
        name: "Linea verticale",
        path: [
            {x:0, y:0},
            {x:0, y:1},
            {x:0, y:2},
            {x:0, y:3}
        ]
    },
    {
        name: "L semplice",
        path: [
            {x:0, y:0},
            {x:1, y:0},
            {x:2, y:0},
            {x:2, y:1},
            {x:2, y:2}
        ]
    },
    {
        name: "Quadrato",
        path: [
            {x:1, y:1},
            {x:2, y:1},
            {x:2, y:2},
            {x:1, y:2}
        ]
    },
	
    {
      "name": "Tema - Numero 3",
      "path": [
        { "x": 0, "y": 0, "label": "1" },
        { "x": 1, "y": 0, "label": "2" },
        { "x": 2, "y": 0, "label": "3" },
        { "x": 2, "y": 1, "label": "4" },
        { "x": 1, "y": 1, "label": "5" },
        { "x": 0, "y": 1, "label": "6" },
        { "x": 0, "y": 2, "label": "7" },
        { "x": 1, "y": 2, "label": "8" },
        { "x": 2, "y": 2, "label": "9🏆" }
      ]
    },	
	
    {
        name: "Zig-Zag",
        path: [
            {x:0, y:0},
            {x:1, y:0},
            {x:1, y:1},
            {x:2, y:1},
            {x:2, y:2},
            {x:3, y:2}
        ]
    }
];

function clearGridForLevel4() {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.getElementById(`cell-${r}-${c}`);
            if (!cell) continue;

            cell.textContent = "";
            cell.style.backgroundColor = "";
            cell.classList.remove("letter", "emoji", "trap", "shake");
        }
    }
}


function resetRobot() {

    // Rimuovi robot precedente
    document.querySelectorAll('.player-root').forEach(e => e.remove());

    // Imposta coordinate di partenza
    player.r = startY;
    player.c = startX;

    // Orientamento iniziale
    orientation = 'S';

    // Disegna robot PNG
    updatePlayer();
}


async function runLevel4Path(path) {
    if (!path || path.length === 0 || currentLevel !== 4) return;

    const startPos = { r: path[0].y, c: path[0].x };
    const origR = player.r, origC = player.c;
    player.r = startPos.r;
    player.c = startPos.c;
    orientation = 'S'; // default
    updatePlayer();

    for (let i = 1; i < path.length; i++) {
        const target = path[i];
        const dr = target.y - player.r;
        const dc = target.x - player.c;

        // calcola direzione desiderata
        let desiredOrientation;
        if (dr === -1) desiredOrientation = 'N';
        else if (dr === 1) desiredOrientation = 'S';
        else if (dc === 1) desiredOrientation = 'E';
        else if (dc === -1) desiredOrientation = 'W';
        else continue; // salto diagonali o stesse coordinate

        // ruota robot se necessario
        if (orientation !== desiredOrientation) {
            await rotateRobotTo(desiredOrientation);
            orientation = desiredOrientation;
        }

        // muovi robot
        player.r = target.y;
        player.c = target.x;
        updatePlayer();
        await sleep(350);

        // controlla se è sulla cella corretta del percorso
        const onPath = path.some(p => p.x === player.c && p.y === player.r);
        if (!onPath) {
            const cell = grid[player.r][player.c];
            if (cell) cell.style.backgroundColor = 'yellow';
            await sleep(700);

            // reset al punto di partenza
            player.r = startPos.r;
            player.c = startPos.c;
            orientation = 'S';
            updatePlayer();

            // rimuove evidenziazione gialla
            grid.forEach(row => row.forEach(c => c.style.backgroundColor = ''));
            return;
        }
    }

    // percorso completato correttamente
    robotSpeak("Percorso completato!", document.getElementById('message'));
}

// pulizia casella Start e End
function clearStartEndCells() {
    document.querySelectorAll('.start-cell').forEach(c => c.classList.remove('start-cell'));
    document.querySelectorAll('.end-cell').forEach(c => c.classList.remove('end-cell'));
}

function updateRobotDirection() {
    if (currentLevel !== 4) return;

    const arrow = document.querySelector("#player .robot-arrow");
    if (!arrow) return;

    if (player.dir === 0) arrow.textContent = "▲";
    if (player.dir === 1) arrow.textContent = "▶";
    if (player.dir === 2) arrow.textContent = "▼";
    if (player.dir === 3) arrow.textContent = "◀";
}



// MUOVE IL ROBOT (stessa logica comandi L3)
// MUOVE IL ROBOT (livello 4 - versione stabile)
async function moveRobot(action) {

    // ---- MOVIMENTI ----
    if (action === 'R') {
        player.c = Math.min(cols - 1, player.c + 1);
    }
    else if (action === 'L') {
        player.c = Math.max(0, player.c - 1);
    }
    else if (action === 'U') {
        player.r = Math.max(0, player.r - 1);
    }
    else if (action === 'D') {
        player.r = Math.min(rows - 1, player.r + 1);
    }

    // ---- SALTO ----
    else if (action === 'J') {
        player.c = Math.min(cols - 1, player.c + 2);
    }

    // ---- ROTAZIONI ----
    else if (action === 'RL') {
        rotate('L');
    }
    else if (action === 'RR') {
        rotate('R');
    }

    // aggiorna grafica robot
    updatePlayer();
    updateRobotDirection();

    await new Promise(resolve => setTimeout(resolve, 400));
}


// CARICA PERCORSO DA JSON E COLORA CASELLE VERDI
function loadLevel4Path(data) {
    if (!data || !Array.isArray(data.path) || data.path.length === 0) {
        alert("Percorso JSON non valido.");
        return;
    }

    correctPath = data.path;

    // coordinate partenza
    startX = correctPath[0].x;
    startY = correctPath[0].y;

    // 1️⃣ PULIZIA
    clearGridForLevel4();
    clearStartEndCells();

    // 2️⃣ COLORA E NUMERA IL PERCORSO
    correctPath.forEach((cell, index) => {
        const cellDiv = document.getElementById(`cell-${cell.y}-${cell.x}`);
        if (!cellDiv) return;

        cellDiv.style.backgroundColor = 'lightgreen';
        cellDiv.textContent = cell.label ?? (index + 1).toString();
        cellDiv.style.fontWeight = "bold";
        cellDiv.style.fontSize = "16px";
    });

    // 3️⃣ START ROSSO
    const startCell = document.getElementById(`cell-${startY}-${startX}`);
    if (startCell) startCell.classList.add('start-cell');

    // 4️⃣ END BLU
    const last = correctPath[correctPath.length - 1];
    const endCell = document.getElementById(`cell-${last.y}-${last.x}`);
    if (endCell) endCell.classList.add('end-cell');

    // 5️⃣ MESSAGGIO
    showMessage("Percorso caricato: " + (data.name || "senza nome"));

    // POSIZIONA IL ROBOT SULLA CASELLA START
    player.r = startY;
    player.c = startX;
    orientation = 'S';
    updatePlayer();

    }






// MOSTRA MESSAGGI
function showMessage(msg) {
    const msgDiv = document.getElementById('message');
    if (msgDiv) {
        msgDiv.innerText = msg;
        setTimeout(()=>{ msgDiv.innerText=''; }, 3000);
    }
}

// INIZIALIZZAZIONE LIVELLO 4
// ======================= LIVELLO 4 =======================

// Stato livello 4
let correctPath = [];
let startX = 0;
let startY = 0;
let loadedPaths = [];   // 🔥 tutti i percorsi importati

// INIZIALIZZAZIONE LIVELLO 4
document.getElementById('btnLevel4')?.addEventListener('click', () => {

    // Mostra livello 4
	document.body.className = "level4";
    document.getElementById('level4').style.display = 'block';
    document.getElementById('level1').style.display = 'none';
    document.getElementById('level2').style.display = 'none';
    document.getElementById('level3').style.display = 'none';
    document.getElementById('targetWord').style.display = 'none';
    document.getElementById('storyText').style.display = 'inline';

    const title = document.getElementById('titleStatic');
    title.textContent = "🤖 Aiuta il robot a non sbagliare percorso:";
    
    // Aggiunge una classe speciale per lo stile
    title.classList.add('level4-title');	

    // Costruisci griglia
    buildGrid();
    clearGridForLevel4();
    clearStartEndCells();

    // 0️⃣ Reset posizione robot per evitare r3 c10
    player.r = 0;
    player.c = 0;

    // 1️⃣ Carica percorso casuale
    if (loadedPaths && loadedPaths.length > 0) {
        const random = loadedPaths[Math.floor(Math.random() * loadedPaths.length)];
        loadLevel4Path(random);

        // 2️⃣ Imposta posizione robot
        //player.r = startY;
        //player.c = startX;

        // 3️⃣ Disegna robot PNG
        //setTimeout(() => updatePlayer(), 20);

        showMessage("Percorso caricato: " + (random.name || "senza nome"));
    } else {
        showMessage(`⚠️ Clicca su "Percorso casuale" o importa un JSON con "Carica livelli"`);
    }


    // TOOLBOX DIREZIONI
    const pathToolbox = document.getElementById('pathToolbox');
    pathToolbox.innerHTML = '';

    const directions = [
        {action:'U',  icon:'⬆️'},
        {action:'D',  icon:'⬇️'},
        {action:'L',  icon:'⬅️'},
        {action:'R',  icon:'➡️'},
        {action:'J',  icon:'⤴️'},
        {action:'RL', icon:'↺'},
        {action:'RR', icon:'↻'}
    ];

    directions.forEach(d => {
        const el = document.createElement('div');
        el.className = 'tool icon-tool';
        el.dataset.action = d.action;
        el.draggable = true;

        const ic = document.createElement('div');
        ic.className = 'icon';
        ic.innerHTML = d.icon;
        el.appendChild(ic);

        const hint = document.createElement('div');
        hint.style.fontSize = '12px';
        hint.style.color = '#555';
        //hint.textContent = 'Trascina';
        el.appendChild(hint);

        pathToolbox.appendChild(el);
    });

    Sortable.create(pathToolbox, {
        group: { name: 'shared-icons', pull: 'clone', put: false },
        sort: false,
        animation: 150
    });

    // SEQUENZA
    const seq = document.getElementById('pathSequence');
    seq.innerHTML = '';

    Sortable.create(seq, {
        group: { name: 'shared-icons', pull: false, put: true },
        animation: 150,
        removeOnSpill: true,
        handle: '.icon',

        filter: 'input, [data-no-drag="true"]',
        onFilter(evt) {
            if (evt.target.tagName === 'INPUT') {
                evt.preventDefault();
                evt.target.focus();
            }
        },

        onAdd(evt) {
            const action = evt.item.dataset.action;

            const block = document.createElement('div');
            block.className = 'icon-seq-block';
            block.dataset.action = action;

            const ic = document.createElement('div');
            ic.className = 'icon';
            ic.innerHTML =
                action === 'U'  ? '⬆️' :
                action === 'D'  ? '⬇️' :
                action === 'L'  ? '⬅️' :
                action === 'R'  ? '➡️' :
                action === 'J'  ? '⤴️' :
                action === 'RL' ? '↺' :
                                  '↻';
            block.appendChild(ic);

            const input = document.createElement('input');
			attachNumpad(input);
            input.readOnly = true;
            input.type = 'text';
            input.inputMode = 'numeric';
            input.pattern = '[0-9]*';
            input.value = '1';
            input.classList.add('seq-input');
            input.setAttribute('data-no-drag', 'true');
            block.appendChild(input);

            const rm = document.createElement('button');
            rm.className = 'remove';
            rm.textContent = '✖';
            rm.onclick = () => block.remove();
            block.appendChild(rm);

            evt.item.replaceWith(block);
        }
    });
	
	
// per livello 4 incaso orentamento non corretto

async function wrongOrientationLevel4() {
    try { soundError.play(); } catch(e){}

    robotSpeak("Orientamento sbagliato! Non posso procedere in questa direzione.", document.getElementById('message'));

    // anima il robot sulla cella corrente
    const cell = grid[player.r][player.c];
    if(cell){
        cell.classList.add('shake');
        await sleep(1000);
        cell.classList.remove('shake');
    }

    // --- RIPRISTINO CELLE SBAGLIATE ---
    wrongCells.forEach(cell => {
        cell.style.backgroundColor = cell.dataset.originalColor || "";
        delete cell.dataset.originalColor;
    });
    wrongCells.length = 0; // svuota l’array

    // --- TORNA AL PUNTO DI PARTENZA ---
    player.r = startY;
    player.c = startX;
    orientation = 'S'; // orientamento iniziale del livello
    updatePlayer();

    // opzionale: piccolo delay per vedere il reset
    await sleep(200);
}

// ---------- RUN PERCORSO LIVELLO 4 (AGGIORNATO CON CONTROLLO ORIENTAMENTO) ----------
document.getElementById('runPath').onclick = async () => {
    const seqDivs = document.getElementById('pathSequence').children;

    if (!correctPath || correctPath.length === 0) {
        showMessage("Puoi anche caricare un file JSON.");
        return;
    }

    // --- COSTRUISCI SEQUENZA DI AZIONI DAL DOM ---
    const playerPath = [];
    for (let div of seqDivs) {
        const action = div.dataset.action;
        const val = parseInt(div.querySelector('input').value) || 1;
        for (let i = 0; i < val; i++) playerPath.push(action);
    }

    const wrongCells = [];
    let moveIndex = 1; // parte dalla seconda cella del percorso

    // --- FUNZIONE DI SUPPORTO PER ORIENTAMENTO SBAGLIATO ---
    async function wrongOrientationLevel4(wrongCellsArray) {
        try { soundError.play(); } catch(e){}
        robotSpeak("Orientamento sbagliato! Non posso procedere in questa direzione.", document.getElementById('message'));

        const cell = grid[player.r][player.c];
        if(cell){
            cell.classList.add('shake');
            await sleep(1000);
            cell.classList.remove('shake');
        }

        // ripristina colori celle sbagliate
        wrongCellsArray.forEach(c => {
            c.style.backgroundColor = c.dataset.originalColor || "";
            delete c.dataset.originalColor;
        });
        wrongCellsArray.length = 0;

        // torna al punto di partenza
        player.r = startY;
        player.c = startX;
        orientation = 'S';
        updatePlayer();

        await sleep(200);
    }

    // --- ESECUZIONE PERCORSO ---
    let correct = true;

    for (let stepIndex = 0; stepIndex < playerPath.length; stepIndex++) {
        const action = playerPath[stepIndex];

        // Controllo orientamento
        if (!['RL','RR'].includes(action)) {
            let requiredOrientation;
            if (action === 'R' || action === 'J') requiredOrientation = 'E';
            else if (action === 'L') requiredOrientation = 'W';
            else if (action === 'U') requiredOrientation = 'N';
            else if (action === 'D') requiredOrientation = 'S';

            if (orientation !== requiredOrientation) {
                await wrongOrientationLevel4(wrongCells);
                return;
            }
        }

        // Esegui azione
        await moveRobot(action, "L4");

        // Salta rotazioni per controllo celle
        if (['RL','RR'].includes(action)) continue;

        // Controlla posizione solo se c'è un expected valido
        const expected = correctPath[moveIndex];
        if (!expected || player.c !== expected.x || player.r !== expected.y) {
            correct = false;
            const cell = document.getElementById(`cell-${player.r}-${player.c}`);
            if (cell && !wrongCells.includes(cell)) {
                cell.dataset.originalColor = cell.style.backgroundColor || "";
                cell.style.backgroundColor = "yellow";
                wrongCells.push(cell);
            }
        }
        moveIndex++;
    }

    // --- MESSAGGIO FINALE ---
    if (correct && player.r === correctPath[correctPath.length - 1].y && player.c === correctPath[correctPath.length - 1].x) {
        showMessage("✅ Percorso corretto!");
        await robotSpeak("Percorso completato correttamente!", document.getElementById('message'));

        // 🎉 CELEBRAZIONE PER LIVELLO 4
        celebrateWithImage();
    } else {
        await robotSpeak("Percorso non corretto, ritorno al punto di partenza.", document.getElementById('message'));

        // evidenzia temporaneamente celle sbagliate
        for (let cell of wrongCells) cell.style.backgroundColor = "red";

        await sleep(2000);

        // ripristina colori celle sbagliate
        wrongCells.forEach(cell => {
            cell.style.backgroundColor = cell.dataset.originalColor || "";
            delete cell.dataset.originalColor;
        });

        // reset robot
        resetRobot();
    }
};
    // CLEAR
    document.getElementById('clearPath').onclick = () => {
        document.getElementById('pathSequence').innerHTML = '';
        resetRobot();
    };

});

// ======================= IMPORT JSON (FUORI DAL LIVELLO 4) =======================

document.getElementById('importPaths').onclick = () => {
    document.getElementById('pathFile').click();
};

document.getElementById('pathFile').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            console.log("JSON caricato:", data);

            if (Array.isArray(data.paths)) {
                loadedPaths = data.paths;
                const first = loadedPaths[0];
                loadLevel4Path(first);
                showMessage("Percorso caricato: " + (first.name || "senza nome"));
                return;
            }

            if (Array.isArray(data.path)) {
                loadedPaths = [data];
                loadLevel4Path(data);
                showMessage("Percorso singolo caricato.");
                return;
            }

            alert("File JSON non corretto per il livello 4.");

        } catch (err) {
            alert("Errore nel parsing del file JSON del percorso.");
            console.error(err);
        }
    };

    reader.readAsText(file);
};

// ======================= PERCORSO CASUALE =======================

document.getElementById('randomPath').onclick = () => {
    if (!loadedPaths || loadedPaths.length === 0) {
        showMessage("Puoi anche importare un file JSON.");
        return;
    }

    const random = loadedPaths[Math.floor(Math.random() * loadedPaths.length)];
    loadLevel4Path(random);
    showMessage("Percorso casuale: " + (random.name || "senza nome"));
};

// ======================= FINE LIVELLO 4 =======================


// ---------- NEW ICON SEQ BUTTON ----------
document.getElementById('newIconSeqBtn') && document.getElementById('newIconSeqBtn').addEventListener('click', ()=>{
  if(allStories.length === 0){
    alert("Prima importa un file JSON con sequenze.");
    return;
  }
  loadRandomStory();
});

// ---------- NEW ICON SEQ (fallback/random from built-in) ----------
document.getElementById('newIconSeqBtnFallback') && document.getElementById('newIconSeqBtnFallback').addEventListener('click', ()=>{
  // if you have a fallback built-in iconSequences array
  const seq = iconSequences[Math.floor(Math.random()*iconSequences.length)];
  targetIcons = [...seq];
  document.getElementById('storyText').textContent = "Ho voglia di un gelato";
  const cw = document.getElementById('collectedWord'); if(cw){ cw.innerHTML=''; for(let i=0;i<targetIcons.length;i++){ const s=document.createElement('div'); s.className='letter-slot'; s.id=`slot-${i}`; cw.appendChild(s); } }
  buildGrid(); placeSymbolsRandom(targetIcons); placeTrapsRandom(parseInt((document.getElementById('trapCount')&&document.getElementById('trapCount').value)||6)); renderLettersAndTraps(); updatePlayer();
});

// ---------- RUN / CLEAR ICON SEQ (L3) ----------
document.getElementById('runSeqIcons') && document.getElementById('runSeqIcons').addEventListener('click', ()=>executeSequenceFromContainer('iconSequence',"L3"));
document.getElementById('runSeqBombIcons') && document.getElementById('runSeqBombIcons').addEventListener('click', ()=>executeSequenceBombFromContainer('iconSequence'));
document.getElementById('clearSeqIcons') && document.getElementById('clearSeqIcons').addEventListener('click', clearIconSequence);

// ---------- CELEBRATION: image + sound + stars ----------
// ---------- CELEBRATION: image + sound + stars ----------
async function celebrateWithImage() {
    const images = [
        "img/celebration1.png",
        "img/celebration2.png",
        "img/celebration3.png"
    ];
    const randomImage = images[Math.floor(Math.random() * images.length)];
    const overlay = document.getElementById("celebrationOverlay");
    const image = document.getElementById("celebrationImage");
    const content = document.getElementById("celebrationContent");
    if (!overlay || !image || !content) return;

    // reset animazione
    content.style.animation = "none";
    void content.offsetWidth;
    content.style.animation = "zoomInBounce 1.2s ease-out forwards";

    // suono di vittoria
    try {
        victorySound.currentTime = 0;
        victorySound.play();
    } catch(e){}

    // mostra immagine e overlay
    image.src = randomImage;
    overlay.classList.add("active");

    // lancia stelle
    spawnStarsEpic(200); // tante stelle

    // 🔧 tempi configurabili
    const freezeTime = 69000;     // fermo immagine: 4 secondi 59000
    const overlayDuration = 4000; // totale: overlay visibile 6 secondi 7000

    // ⏱ fermo immagine: il gioco riparte dopo freezeTime
    setTimeout(() => {
        restartGame(); // reset parola/griglia
    }, freezeTime);

    // ⏱ dopo overlayDuration svanisce l’overlay
    setTimeout(() => {
        overlay.classList.remove("active");
    }, overlayDuration);
}


// versione “epica” di spawnStars
function spawnStarsEpic(count = 20) {
    return new Promise((resolve) => {
        let starsFinished = 0;

        for (let i = 0; i < count; i++) {
            const star = document.createElement("div");
            star.classList.add("star");
            star.textContent = "⭐";

            const randomX = (Math.random() - 0.5) * 2000; // più dispersione
            const randomY = (Math.random() - 0.5) * 1000;
            star.style.left = "50%";
            star.style.top = "50%";
            star.style.position = "fixed";
            star.style.transform = "translate(-50%,-50%)";

            // durata più lunga e variabile
            const duration = 1500 + Math.random() * 500; // 7–10s

            const anim = star.animate([
                { transform: "translate(-50%,-50%) scale(0.2)", opacity: 1 },
                { transform: `translate(calc(-50% + ${randomX}px), calc(-50% + ${randomY}px)) scale(1.5)`, opacity: 0 }
            ], {
                duration: duration,
                easing: "ease-out",
                fill: "forwards"
            });

            anim.onfinish = () => {
                star.remove();
                starsFinished++;
                if (starsFinished === count) resolve();
            };

            document.body.appendChild(star);
        }

        if (count === 0) resolve();
    });
}



// ---------- INIT ----------
setupToolboxAndSequence();
setupIconToolboxAndSequence();
resetGame();

// If there is an icon JSON already present in the DOM as <script id="preloadIconJson" type="application/json">...</script>
// we can preload it (optional):
(function tryPreload(){
  const el = document.getElementById('preloadIconJson');
  if(el){
    try {
      const data = JSON.parse(el.textContent || el.innerText || '{}');
      if(Array.isArray(data)) { allStories = data; loadRandomStory(); }
      else if(data && Array.isArray(data.sequence)) { allStories = [data]; loadRandomStory(); }
    } catch(e){ /* ignore */ }
  }
})();

const helpTexts = {
  1: `
    <b>Livello 1 – Comandi manuali</b><br><br>
    Usa i pulsanti freccia per muovere il robot.<br>
    Raccogli le lettere nell’ordine corretto per formare la parola.<br>
    Puoi anche ruotare o distruggere una trappola.
  `,
  2: `
    <b>Livello 2 – Percorso programmato</b><br><br>
    Trascina i blocchi per creare un sequenza.<br>
    Premi “Esegui sequenza” per far muovere il robot.<br>
    Evita le trappole e raccogli le lettere nell’ordine giusto.
  `,
  3: `
    <b>Livello 3 – Sequenza di icone</b><br><br>
    Trascina i blocchi per creare una sequenza. Premi “Esegui sequenza” per far muovere il robot.<br>
    Ogni icona rappresenta un passaggio della narrazione.<br>
    Raccogli  le icone nell’ordine corretto.
  `,
  4: `
    <b>Livello 4 – Percorso robot</b><br><br>
	Per cominciare premi "percorso casuale" o "importa livelli".
    Trascina i comandi per programmare il robot.<br>
    L’obiettivo è raggiungere la cella finale seguendo il percorso segnato.<br>
    Premi “Esegui percorso” per vedere il risultato.
  `
};

// mostra popup
document.getElementById("helpBtn").addEventListener("click", () => {
  const level = document.body.className.replace("level", "");
  document.getElementById("helpContent").innerHTML = helpTexts[level] || "Seleziona un livello e poi cliccami.";
  document.getElementById("helpPopup").style.display = "block";
});

// chiudi popup
document.getElementById("closeHelp").addEventListener("click", () => {
  document.getElementById("helpPopup").style.display = "none";
});
