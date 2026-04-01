import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDvANibal59STlmeA6jKwKOPc_6XFtq30A",
    authDomain: "the-market-technician.firebaseapp.com",
    projectId: "the-market-technician",
    storageBucket: "the-market-technician.firebasestorage.app",
    messagingSenderId: "182431949342",
    appId: "1:182431949342:web:7f100110ac6617dc0c040f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Unique Database Key for this specific app module
const DB_KEY = "wealthSandboxState";
let currentUser = null;

// ==========================================
// 2. AUTH STATE OBSERVER
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadCloudProfile();
    } else {
        // Immediately redirect guest/unauthorized users back to master login
        window.location.href = '../index.html';
    }
});

// ==========================================
// 3. CLOUD DATA HANDLING
// ==========================================
async function loadCloudProfile() {
    try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const cloudData = docSnap.data();
            
            // Check if this specific app has saved data in the user's document
            if (cloudData && cloudData[DB_KEY]) {
                const state = cloudData[DB_KEY];
                
                // Inject cloud data into the UI elements safely
                if(state.cap) els.cap.value = state.cap;
                if(state.gross) els.gross.value = state.gross;
                if(state.topup) els.topup.value = state.topup;
                if(state.freq) els.freq.value = state.freq;
                if(state.growth) els.growth.value = state.growth;
                
                if(state.age1) { els.age1.value = state.age1; els.valAge1.innerText = state.age1; }
                if(state.age2) { els.age2.value = state.age2; els.valAge2.innerText = state.age2; }
                if(state.age3) { els.age3.value = state.age3; els.valAge3.innerText = state.age3; }
                
                if(state.targetInc) els.targetInc.value = state.targetInc;
                
                // Restore DRIP vs Cash Out state
                if(state.isDrip !== undefined) {
                    isDrip = state.isDrip;
                    if(isDrip) {
                        els.toggleDrip.className = "flex-1 px-2 py-2 rounded bg-white dark:bg-slate-700 text-brand dark:text-green-400 text-xs font-bold shadow-sm transition-all";
                        els.toggleCash.className = "flex-1 px-2 py-2 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-bold transition-all";
                        els.desc.innerText = "Dividends automatically buy more shares (Exponential Growth).";
                    } else {
                        els.toggleCash.className = "flex-1 px-2 py-2 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold shadow-sm transition-all";
                        els.toggleDrip.className = "flex-1 px-2 py-2 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-bold transition-all";
                        els.desc.innerText = "Dividends are hoarded as a flat cash pile (Linear Growth).";
                    }
                }
                
                // Recalculate and redraw chart with the newly loaded cloud data
                calculateMath(); 
            }
        }
    } catch (error) {
        console.error("Error loading cloud profile:", error);
    }
}

async function saveData() {
    if (!currentUser) return;
    
    // Bundle the current UI inputs into a clean state object
    const appState = {
        cap: els.cap.value,
        gross: els.gross.value,
        topup: els.topup.value,
        freq: els.freq.value,
        growth: els.growth.value,
        age1: els.age1.value,
        age2: els.age2.value,
        age3: els.age3.value,
        targetInc: els.targetInc.value,
        isDrip: isDrip
    };
    
    try {
        // Silently push to Firestore using merge: true to protect other module data
        await setDoc(doc(db, "users", currentUser.uid), {
            [DB_KEY]: appState
        }, { merge: true });
    } catch (error) {
        console.error("Error silently saving data:", error);
    }
}

// Auto-save debounce logic to prevent spamming Firestore writes on slider drag
let saveTimeout;
function triggerAutoSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveData();
    }, 1500); // Waits 1.5s after the user stops typing/sliding before firing the save
}


// ==========================================
// 4. MT WEALTH SANDBOX V1.1 - PURE PROJECTION ENGINE
// ==========================================

const DIV_TAX = 0.10;
let isDrip = true;
let myChart = null;

// UI Element References
const els = {
    cap: document.getElementById('in-capital'),
    gross: document.getElementById('in-gross-yield'),
    netOut: document.getElementById('out-net-yield'),
    topup: document.getElementById('in-topup'),
    freq: document.getElementById('in-freq'),
    growth: document.getElementById('in-growth'),
    age1: document.getElementById('slide-age1'),
    valAge1: document.getElementById('val-age1'),
    age2: document.getElementById('slide-age2'),
    valAge2: document.getElementById('val-age2'),
    age3: document.getElementById('slide-age3'),
    valAge3: document.getElementById('val-age3'),
    retireAge: document.getElementById('out-retire-age'),
    targetInc: document.getElementById('in-target-inc'),
    scamAlert: document.getElementById('scam-alert'),
    toggleDrip: document.getElementById('toggle-drip'),
    toggleCash: document.getElementById('toggle-cash'),
    desc: document.getElementById('strategy-desc'),
    outTarget: document.getElementById('out-target-fund'),
    outReqTopup: document.getElementById('out-req-topup'),
    outReqSubtext: document.getElementById('out-req-subtext'),
    outProjFund: document.getElementById('out-proj-fund'),
    outProjInc: document.getElementById('out-proj-inc'),
    statusCard: document.getElementById('status-card'),
    statusLine: document.getElementById('status-line'),
    outPocket: document.getElementById('out-pocket'),
    outFreeMoney: document.getElementById('out-free-money'),
    narrative: document.getElementById('narrative-box')
};

// Utility: Parse commas to numbers
const parseNum = (str) => parseFloat(String(str).replace(/,/g, '')) || 0;

// Utility: Format Currency
const formatPHP = (num) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0);

// Utility: Custom Massive Number Formatter for Chart Y-Axis
const formatLargeNum = (num) => {
    if (num < 1000) return num.toFixed(0);
    if (num < 1e6) return (num / 1e3).toFixed(1) + 'k';
    if (num < 1e9) return (num / 1e6).toFixed(1) + 'M';
    if (num < 1e12) return (num / 1e9).toFixed(2) + 'B';
    if (num < 1e15) return (num / 1e12).toFixed(2) + 'T';
    if (num < 1e18) return (num / 1e15).toFixed(2) + 'Q';
    return (num / 1e18).toFixed(2) + 'Qn'; // Quintillion
};

// Comma Input Formatter Logic
document.querySelectorAll('.comma-input').forEach(input => {
    input.addEventListener('input', (e) => {
        let cursor = e.target.selectionStart;
        let origLen = e.target.value.length;
        let isNegative = e.target.value.startsWith('-');
        let val = e.target.value.replace(/[^0-9.]/g, '');
        let parts = val.split('.');
        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
        if (val.includes('.')) val = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + '.' + parts[1].substring(0, 4);
        else val = val.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        e.target.value = isNegative ? '-' + val : val;
        cursor += (e.target.value.length - origLen);
        if (cursor >= 0) e.target.setSelectionRange(cursor, cursor);
        calculateMath();
    });
});

// Theme Toggle ensuring it triggers correctly
document.getElementById('theme-toggle').addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    calculateMath(); // Redraws chart with correct colors
});

// Strategy Toggle (DRIP vs Cash)
els.toggleDrip.addEventListener('click', (e) => {
    isDrip = true;
    els.toggleDrip.className = "flex-1 px-2 py-2 rounded bg-white dark:bg-slate-700 text-brand dark:text-green-400 text-xs font-bold shadow-sm transition-all";
    els.toggleCash.className = "flex-1 px-2 py-2 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-bold transition-all";
    els.desc.innerText = "Dividends automatically buy more shares (Exponential Growth).";
    calculateMath();
});

els.toggleCash.addEventListener('click', (e) => {
    isDrip = false;
    els.toggleCash.className = "flex-1 px-2 py-2 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold shadow-sm transition-all";
    els.toggleDrip.className = "flex-1 px-2 py-2 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-bold transition-all";
    els.desc.innerText = "Dividends are hoarded as a flat cash pile (Linear Growth).";
    calculateMath();
});

// Event Listeners for standard inputs
[els.gross, els.growth].forEach(el => el.addEventListener('input', calculateMath));
els.freq.addEventListener('change', calculateMath);

// Age Sliders Logic (Prevent crossover)
const updateAges = () => {
    let a1 = parseInt(els.age1.value);
    let a2 = parseInt(els.age2.value);
    let a3 = parseInt(els.age3.value);
    if (a2 < a1) { els.age2.value = a1; a2 = a1; }
    if (a3 < a2) { els.age3.value = a2; a3 = a2; }
    if (a3 < a1) { els.age3.value = a1; }
    els.valAge1.innerText = a1; els.valAge2.innerText = a2; els.valAge3.innerText = a3;
    els.retireAge.innerText = a3;
    calculateMath();
};
[els.age1, els.age2, els.age3].forEach(el => el.addEventListener('input', updateAges));

// Core Calculation Engine
function calculateMath() {
    // 1. Gather Inputs
    const startCap = parseNum(els.cap.value);
    const grossYield = parseNum(els.gross.value) / 100;
    const netYield = grossYield * (1 - DIV_TAX);
    const topupAmt = parseNum(els.topup.value);
    const freq = parseInt(els.freq.value);
    const capGrowth = parseNum(els.growth.value) / 100;
    const targetInc = parseNum(els.targetInc.value);
    const a1 = parseInt(els.age1.value);
    const a2 = parseInt(els.age2.value);
    const a3 = parseInt(els.age3.value);

    // 2. Scam Detector logic
    if (grossYield > 0.12 || capGrowth > 0.15) {
        els.scamAlert.classList.remove('hidden');
        els.scamAlert.classList.add('flex');
    } else {
        els.scamAlert.classList.add('hidden');
        els.scamAlert.classList.remove('flex');
    }

    // 3. Math Init
    els.netOut.innerText = (netYield * 100).toFixed(2) + '%';
    
    const targetFund = netYield > 0 ? (targetInc * 12) / netYield : 0;
    const yearsTopup = a2 - a1; 
    const yearsCoast = a3 - a2; 
    const yearsTotal = a3 - a1;
    
    const totalRate = isDrip ? (netYield + capGrowth) : capGrowth; 
    const moRate = Math.pow(1 + totalRate, 1/12) - 1;
    const annualContrib = topupAmt * freq;

    let reqPmt = 0; let isCoastFire = false; let shortfall = 0;

    // Compute Required Top-up (if Target > 0)
    if (yearsTotal > 0 && totalRate > 0) {
        const fvDeployedBase = startCap * Math.pow(1 + totalRate, yearsTotal);
        shortfall = targetFund - fvDeployedBase;
        if (shortfall <= 0) {
            isCoastFire = true; reqPmt = 0;
        } else if (yearsTopup > 0) {
            reqPmt = ((shortfall / Math.pow(1 + totalRate, yearsCoast)) * moRate) / (Math.pow(1 + moRate, yearsTopup * 12) - 1);
        } else {
            reqPmt = Infinity; 
        }
    }

    // Simulation Loop
    let labels = [], dataValue = [], dataInvested = [];
    let shares = startCap / 1.0; 
    let price = 1.0; 
    let totalInvested = startCap;
    let accumulatedCash = 0;

    for (let t = 0; t <= yearsTotal; t++) {
        labels.push('Age ' + (a1 + t));
        if (t === 0) { 
            dataValue.push(startCap); dataInvested.push(totalInvested); 
        } else {
            price *= (1 + capGrowth); // Price appreciates
            if (t <= yearsTopup) { 
                shares += (annualContrib / price); // Buy shares with topup
                totalInvested += annualContrib; 
            }
            
            let dividend = (shares * price) * netYield; 
            if (isDrip) {
                shares += (dividend / price); // Exponential Reinvestment
            } else {
                accumulatedCash += dividend;  // Linear Cash Hoarding
            }
            
            dataValue.push(accumulatedCash + (shares * price)); 
            dataInvested.push(totalInvested);
        }
    }

    const projectedFinalDeployed = shares * price;
    const projectedFinalTotal = accumulatedCash + projectedFinalDeployed;
    const projectedIncome = (projectedFinalDeployed * netYield) / 12;

    updateUI({ targetFund, reqPmt, isCoastFire, projectedFinalTotal, projectedFinalDeployed, projectedIncome, totalInvested, a1, a2, a3, freqName: els.freq.options[els.freq.selectedIndex].text.toLowerCase(), topupAmt, startCap }, { labels, dataValue, dataInvested });

    // NEW: Trigger the silent auto-save to Firestore after calculations run
    triggerAutoSave();
}

function updateUI(data, chartData) {
    els.outTarget.innerText = formatPHP(data.targetFund);
    els.outProjFund.innerText = formatPHP(data.projectedFinalTotal);
    els.outProjInc.innerText = formatPHP(data.projectedIncome) + " / mo";

    // Required Pmt Logic
    if (data.isCoastFire || (data.targetFund === 0 && data.startCap > 0)) {
        els.outReqTopup.innerText = "₱0 / mo";
        els.outReqTopup.className = "text-lg font-mono font-bold text-brand transition-all";
        els.outReqSubtext.innerText = "Goal fully covered by starting capital. Let it coast!";
        els.outReqSubtext.className = "text-[9px] mt-1 leading-tight text-brand font-bold";
    } else if (data.reqPmt === Infinity) {
        els.outReqTopup.innerText = "Impossibility";
        els.outReqTopup.className = "text-lg font-mono font-bold text-amber-500 transition-all";
        els.outReqSubtext.innerText = "You must extend your Stop Age or add more Capital.";
        els.outReqSubtext.className = "text-[9px] mt-1 leading-tight text-amber-500 font-bold";
    } else if (data.topupAmt >= data.reqPmt) {
        els.outReqTopup.innerText = formatPHP(data.reqPmt) + " / mo";
        els.outReqTopup.className = "text-lg font-mono font-bold text-brand transition-all";
        els.outReqSubtext.innerText = `You only need ${formatPHP(data.reqPmt)}! Your plan puts you ahead of schedule.`;
        els.outReqSubtext.className = "text-[9px] mt-1 leading-tight text-brand font-bold";
    } else {
        els.outReqTopup.innerText = formatPHP(data.reqPmt) + " / mo";
        els.outReqTopup.className = "text-lg font-mono font-bold text-blue-600 dark:text-blue-400 transition-all";
        els.outReqSubtext.innerText = "You are falling short. Increase top-ups or extend your timeline.";
        els.outReqSubtext.className = "text-[9px] mt-1 leading-tight text-slate-500 dark:text-slate-400";
    }

    // Victory Card CSS
    if (data.projectedFinalDeployed >= data.targetFund && data.targetFund > 0) {
        els.outProjFund.className = "text-3xl sm:text-4xl font-mono font-black text-brand break-words transition-colors";
        els.outProjInc.className = "text-lg font-mono font-bold text-brand break-words transition-colors";
        els.statusCard.className = "glass-panel p-6 sm:p-8 rounded-2xl text-center border-t-4 border-t-brand transition-colors relative overflow-hidden flex flex-col justify-center duration-300";
        els.statusLine.className = "absolute top-0 left-0 w-full h-1 bg-brand";
    } else {
        els.outProjFund.className = "text-3xl sm:text-4xl font-mono font-black text-amber-500 break-words transition-colors";
        els.outProjInc.className = "text-lg font-mono font-bold text-amber-500 break-words transition-colors";
        els.statusCard.className = "glass-panel p-6 sm:p-8 rounded-2xl text-center border-t-4 border-t-amber-500 transition-colors relative overflow-hidden flex flex-col justify-center duration-300";
        els.statusLine.className = "absolute top-0 left-0 w-full h-1 bg-amber-500";
    }

    // Free Money Metric
    els.outPocket.innerText = formatPHP(data.totalInvested);
    const freeMoney = data.projectedFinalTotal - data.totalInvested;
    els.outFreeMoney.innerText = "+" + formatPHP(Math.max(0, freeMoney));

    // Narrative
    const strategyLabel = isDrip ? "Exponential DRIP" : "Linear Cash Hoarding";
    els.narrative.innerHTML = `
        Starting at age <span class="font-bold border-b border-brand/30">${data.a1}</span> with your initial capital of <span class="font-mono font-bold text-brand">${formatPHP(data.startCap)}</span>, if you top-up <span class="font-mono font-bold text-brand">${formatPHP(data.topupAmt)}</span> ${data.freqName} until age <span class="font-bold border-b border-brand/30">${data.a2}</span>, your total out-of-pocket investment will be <span class="font-mono font-bold">${formatPHP(data.totalInvested)}</span>.<br><br>
        Letting it coast using an <span class="font-bold italic">${strategyLabel}</span> strategy for another <span class="font-bold">${data.a3 - data.a2}</span> years, by age <span class="font-bold border-b border-brand/30">${data.a3}</span> your portfolio is projected to reach <span class="font-mono font-bold text-brand text-lg">${formatPHP(data.projectedFinalTotal)}</span>.<br><br>
        Living off the dividends generates <span class="font-mono font-bold text-brand text-lg">${formatPHP(data.projectedIncome)}</span> per month (via Est. Net Yield), which is <span class="font-bold underline decoration-brand decoration-2">${data.projectedFinalDeployed >= data.targetFund ? 'above' : 'short of'}</span> your original goal!
    `;

    drawChart(chartData);
}

function drawChart(chartData) {
    const ctx = document.getElementById('reinvestChart').getContext('2d');
    if (myChart) myChart.destroy();
    const isDark = document.documentElement.classList.contains('dark');
    
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                { label: 'Total Value', data: chartData.dataValue, borderColor: '#3E8E35', backgroundColor: 'rgba(62, 142, 53, 0.1)', borderWidth: 3, fill: true, tension: 0.3, pointRadius: 0 },
                { label: 'Out-of-Pocket', data: chartData.dataInvested, borderColor: isDark ? '#475569' : '#9ca3af', borderDash: [5, 5], borderWidth: 2, fill: false, tension: 0.1, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false, 
            interaction: { mode: 'index', intersect: false }, 
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatPHP(context.parsed.y);
                        }
                    }
                }
            },
            scales: { 
                x: { grid: { display: false }, ticks: { color: isDark ? '#94a3b8' : '#64748b' } }, 
                y: { 
                    grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }, 
                    ticks: { 
                        color: isDark ? '#94a3b8' : '#64748b', 
                        callback: function(value) { return '₱' + formatLargeNum(value); } 
                    } 
                } 
            }
        }
    });
}

// Initialize
calculateMath();