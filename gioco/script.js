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

// LEVEL 3 state
let allStories = [];      // tutte le storie caricate dal JSON
let currentStory = null;  // storia in uso
let lastStoryIndex = -1;
let targetIcons = [];     // sequenza (array di emoji) corrente per L3

const sleep = ms => new Promise(res => setTimeout(res, ms));

function normEmoji(e) {
    return [...String(e)].join('');
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

function placeSymbolsRandom(symbols){
  // symbols is array of emoji strings
  letters = [];
  const taken = new Set(); taken.add('0-0');
  let idx=0;
  while(idx < symbols.length){
    const r = Math.floor(Math.random()*rows);
    const c = Math.floor(Math.random()*cols);
    const key = `${r}-${c}`;
    if(taken.has(key)) continue;
    taken.add(key);
    // ensure we store string (guard against objects)
    const ch = (typeof symbols[idx] === 'string') ? symbols[idx] : (symbols[idx].icon || String(symbols[idx]));
    letters.push({ r, c, ch: normEmoji(ch) });
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
function renderLettersAndTraps(mode="L2"){
  for(let r=0;r<rows;r++) 
    for(let c=0;c<cols;c++){
      const cell = grid[r][c];
      cell.classList.remove('letter','emoji','trap');
      cell.textContent='';
    }

  letters.forEach(l=>{
    const cell = grid[l.r][l.c];
    if(!cell) return;
    if(mode === "L2") cell.classList.add('letter');
    else if(mode === "L3") cell.classList.add('emoji');
    cell.textContent = normEmoji(l.ch);
  });

  traps.forEach(t=>{
    const cell = grid[t.r][t.c];
    if(!cell) return;
    cell.classList.add('trap');
    cell.textContent = ""; 
  });
}


// ---------- PLAYER ----------
function updatePlayer(){
  document.querySelectorAll('.player-icon-container, .player-root').forEach(e=>e.remove());

  const root = document.createElement('div');
  root.className = 'player-root';
  root.style.position = 'relative';
  root.style.width = '32px';
  root.style.height = '32px';
  root.style.margin = '0 auto';

  const group = document.createElement('div');
  group.className = 'orient-group';
  group.style.position = 'absolute';
  group.style.left = '50%';
  group.style.top = '50%';
  group.style.width = '32px';
  group.style.height = '32px';
  group.style.transform = 'translate(-50%, -50%) ' + (
    orientation==='S' ? 'rotate(0deg)'  :
    orientation==='E' ? 'rotate(-90deg)' :
    orientation==='N' ? 'rotate(180deg)':
                        'rotate(90deg)'
  );
  group.style.transition = 'transform 0.25s ease';

  const img=document.createElement('img');
  img.src='https://cdn-icons-png.flaticon.com/512/4712/4712035.png';
  img.className='player-icon';
  img.style.width='32px';
  img.style.height='32px';

  const pointer=document.createElement('div');
  pointer.className='direction-pointer';
  pointer.style.position='absolute';
  pointer.style.left='50%';
  pointer.style.transform='translateX(-50%)';
  pointer.style.bottom='-10px';

  group.appendChild(img);
  group.appendChild(pointer);
  root.appendChild(group);
  const cell = grid[player.r] && grid[player.r][player.c];
  if(cell) cell.appendChild(root);
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
async function checkCellAfterMove(mode){
  const cell = grid[player.r] && grid[player.r][player.c];
  const msgEl = document.getElementById('message');

  if(!cell) return { ok:true };

  // TRAPPOLA — versione aggiornata come in L2
  if (cell.classList.contains('trap')) {

      // disattivo movimento successivo
      try { soundError.play(); } catch(e) {}

      robotSpeak("Oh no, sono caduto in una trappola!", msgEl);

      // aggiunge effetto shake alla cella trappola
      cell.classList.add('shake');

      // attende la fine dell’animazione (1s)
      await sleep(1000);

      // rimuove la classe shake
      cell.classList.remove('shake');

      // reset morbido (NON cancella lettere o progressi)
      softResetAfterError(mode);

      // dopo l'animazione torna alla posizione iniziale
      player = { r: 0, c: 0 };
      orientation = 'S';
      updatePlayer();

      return { ok:false, reason:'trap' };
  }


  // letter/icon in L1
  if(mode === "L1" && cell.classList.contains('letter')){
    const ch = cell.textContent;
    const expected = targetWord[collected.length];
    if(ch === expected){
      collected.push(ch);
      const slot = document.getElementById(`slot-${collected.length-1}`);
      if(slot) slot.textContent = ch;
      cell.classList.remove('letter');
      cell.textContent='';
      updatePlayer();
      try{ soundCorrect.play(); }catch(e){}
      if(collected.length === targetWord.length){
        try{ soundSuccess.play(); }catch(e){}
        robotSpeak("Hai completato la parola!", msgEl);
        celebrateWithImage();
      }
    } else {
        // Effetto visivo tipo L2: shake + flash
        cell.classList.add("shake");

        // Suono di errore
        try { if (soundError) { soundError.currentTime = 0; soundError.play(); } } catch(e){}

        // Messaggio vocale
        robotSpeak("Oh no! Questa non è la lettera giusta!", msgEl);

        // Attendi la fine dell’animazione shake (1s)
        await new Promise(res => setTimeout(res, 1000));
        cell.classList.remove("shake");

        // Reset morbido come trappola in L3
        player = { r:0, c:0 };
        orientation = 'S';
        updatePlayer();

        return { ok:false, reason:'wrongLetter' };
    }
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
    hint.textContent = 'Trascina';
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

    // 👇 QUESTA È LA CHIAVE: elimina gli elementi trascinati fuori
    removeOnSpill: true,

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

      // Input numerico
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.value = '1';
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
        const isCorrectCell = (mode==="L2" && cell.classList.contains('letter')) ||
                              (mode==="L3" && cell.classList.contains('emoji'));

        if(isCorrectCell){
            const ch = cell.textContent;
            const expected = (mode==="L3" ? targetIcons[collected.length] : targetWord[collected.length]);

            if(normEmoji(ch) === normEmoji(expected)){
                collected.push(ch);
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
        else if(cell.classList.contains('empty')){
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

// ---------- LEVEL SWITCH ----------
document.getElementById('btnLevel1') && document.getElementById('btnLevel1').addEventListener('click', ()=>{
  document.getElementById('level1').style.display='block';
  document.getElementById('level2').style.display='none';
  document.getElementById('level3').style.display='none';
  document.getElementById('targetWord').style.display='inline';
  document.getElementById('storyText').style.display='none';
  resetGame();
});
document.getElementById('btnLevel2') && document.getElementById('btnLevel2').addEventListener('click', ()=>{
  document.getElementById('level2').style.display='block';
  document.getElementById('level1').style.display='none';
  document.getElementById('level3').style.display='none';
  document.getElementById('targetWord').style.display='inline';
  document.getElementById('storyText').style.display='none';
  resetGame();
});
document.getElementById('btnLevel3') && document.getElementById('btnLevel3').addEventListener('click', ()=>{
  document.getElementById('level3').style.display='block';
  document.getElementById('level1').style.display='none';
  document.getElementById('level2').style.display='none';
  document.getElementById('targetWord').style.display='none';
  document.getElementById('storyText').style.display='inline';

  // prepare collected slots for currentStory/targetIcons
  const cw = document.getElementById('collectedWord'); if(cw){ cw.innerHTML=''; if(targetIcons && targetIcons.length){ for(let i=0;i<targetIcons.length;i++){ const s=document.createElement('div'); s.className='letter-slot'; s.id=`slot-${i}`; cw.appendChild(s);} } }

  buildGrid();
  if(targetIcons && targetIcons.length){
    placeSymbolsRandom(targetIcons);
    placeTrapsRandom(parseInt((document.getElementById('trapCount')&&document.getElementById('trapCount').value)||6));
    renderLettersAndTraps();
    updatePlayer();
  } else {
    placeTrapsRandom(parseInt((document.getElementById('trapCount')&&document.getElementById('trapCount').value)||6));
    renderLettersAndTraps();
    updatePlayer();
  }
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
    hint.textContent='Trascina'; 
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

    // 👇 ELIMINA AUTOMATICAMENTE SE TRASCINATO FUORI
    removeOnSpill: true,

    onAdd: function (evt){
      const action = evt.item.dataset.action;

      // crea nuovo blocco
      const block = document.createElement('div');
      block.className = 'icon-seq-block';
      block.dataset.action = action;

      const ic = document.createElement('div'); 
      ic.className='icon';
      ic.innerHTML = 
        action === 'R'  ? '➡️' :
        action === 'L'  ? '⬅️' :
        action === 'U'  ? '⬆️' :
        action === 'D'  ? '⬇️' :
        action === 'RR' ? '↻<span class="small-text">D</span>' :
        action === 'RL' ? '↺<span class="small-text">S</span>' :
                          '⤴️';
      block.appendChild(ic);

      const input = document.createElement('input'); 
      input.type='number'; 
      input.min='0'; 
      input.value='1'; 
      block.appendChild(input);

      const rm = document.createElement('button'); 
      rm.className='remove'; 
      rm.textContent='✖'; 
      rm.onclick = ()=>block.remove(); 
      block.appendChild(rm);

      // sostituisce il clone con il blocco vero
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
  collected = []; /* azzera le variabili per una nuova sequenza */

  const storyEl = document.getElementById('storyText'); 
  if(storyEl) storyEl.textContent = story.story || '';

  // set target icons (array di emoji)
  targetIcons = story.sequence.map(x => normEmoji(typeof x === 'string' ? x : (x.icon || String(x))));

  // set collected slots
  const cw = document.getElementById('collectedWord'); 
  if(cw){ 
    cw.innerHTML=''; 
    for(let i=0;i<targetIcons.length;i++){ 
      const s=document.createElement('div'); 
      s.className='letter-slot'; 
      s.id=`slot-${i}`; 
      cw.appendChild(s); 
    } 
  }

  // build grid and place icons
  buildGrid();
  placeSymbolsRandom(targetIcons);
  placeTrapsRandom(parseInt((document.getElementById('trapCount') && document.getElementById('trapCount').value) || 6));
  renderLettersAndTraps("L3");
  updatePlayer();
}
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
    const freezeTime = 59000;     // fermo immagine: 4 secondi
    const overlayDuration = 7000; // totale: overlay visibile 6 secondi

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
