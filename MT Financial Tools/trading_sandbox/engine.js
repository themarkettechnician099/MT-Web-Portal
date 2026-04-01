import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 0. FIREBASE INTEGRATION
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
let currentUser = null;

// Firebase Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadCloudProfile();
    } else {
        // Redirect to master login if unauthenticated
        window.location.href = '../index.html';
    }
});

async function loadCloudProfile() {
    try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Inject cloud data directly into main state variable
            if (data.tradingSandboxState) { state =             data.tradingSandboxState; 
            } else if (data.state) {
                state = data.state; // Fallback for legacy format
            }
            exploreSandbox();
        } else {
            console.log("No cloud profile found. Ready for initialization.");
        }
    } catch (error) {
        console.error("Error loading cloud data:", error);
    }
}

// ==========================================
// 1. CONFIGURATION & UTILITIES
// ==========================================
const FEES = { buy: 0.00295, sell: 0.00395 }; 
const themeHexColors = ['#3E8E35', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e', '#14b8a6', '#f97316', '#6366f1'];
const barColors = ['#3E8E35', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e', '#14b8a6', '#f97316', '#6366f1'];

Chart.defaults.color = '#64748b';
Chart.defaults.font.family = 'JetBrains Mono';

function formatNumberInput(input) {
    let cursor = input.selectionStart;
    let val = input.value.replace(/[^0-9.]/g, '');
    let parts = val.split('.');
    
    if (parts.length > 2) {
        val = parts[0] + '.' + parts.slice(1).join('');
    }
    
    if (val) {
        let splitVal = val.split('.');
        let formatted = parseInt(splitVal[0] || 0, 10).toLocaleString('en-US') + (splitVal.length > 1 ? '.' + splitVal[1] : '');
        let diff = formatted.length - input.value.length;
        input.value = formatted;
        try { 
            input.setSelectionRange(cursor + diff, cursor + diff); 
        } catch(e) {}
    } else { 
        input.value = ''; 
    }
}

function getRawValue(str) { 
    return parseFloat(str.replace(/,/g, '')) || 0; 
}

const fmtPHP = (n) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n || 0);
const fmtDec = (n) => n ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '';

function limitPosSize(input) {
    if (parseFloat(input.value) > 100) {
        input.value = 100;
    }
}

// ==========================================
// 2. MASTER STATE MANAGEMENT
// ==========================================
let state = {
    ledger: [
        { id: 1, date: new Date().toISOString(), type: 'DEPOSIT', amount: 200000, remarks: 'Initial Funding' }
    ],
    strategies: ['Breakout', 'Bounce Play', 'Swing'],
    activeHoldings: [], 
    watchlist: [], 
    activeWlId: null,
    journal: [
        { id: 201, date: '2023-10-01', ticker: 'ALI', strat: 'Breakout', sector: 'Property', entry: 25.00, exit: 27.00, shares: 1600, cost: 40000, netPnl: 3200.00, posSizePct: 0.20 },
        { id: 202, date: '2023-10-05', ticker: 'DITO', strat: 'Bounce Play', sector: 'Telco', entry: 5.00, exit: 4.75, shares: 8000, cost: 40000, netPnl: -2000.00, posSizePct: 0.20 },
        { id: 203, date: '2023-10-10', ticker: 'BDO', strat: 'Swing', sector: 'Financial', entry: 125.00, exit: 135.93, shares: 320, cost: 40000, netPnl: 3500.00, posSizePct: 0.20 },
        { id: 204, date: '2023-10-15', ticker: 'ICT', strat: 'Breakout', sector: 'Others', entry: 250.00, exit: 237.50, shares: 160, cost: 40000, netPnl: -2000.00, posSizePct: 0.20 },
        { id: 205, date: '2023-10-20', ticker: 'AC', strat: 'Bounce Play', sector: 'Holdings', entry: 500.00, exit: 476.25, shares: 80, cost: 40000, netPnl: -1900.00, posSizePct: 0.20 },
        { id: 206, date: '2023-10-25', ticker: 'SMPH', strat: 'Swing', sector: 'Property', entry: 25.00, exit: 23.75, shares: 1600, cost: 40000, netPnl: -2000.00, posSizePct: 0.20 },
        { id: 207, date: '2023-10-28', ticker: 'JFC', strat: 'Breakout', sector: 'Consumer', entry: 250.00, exit: 268.12, shares: 160, cost: 40000, netPnl: 2900.00, posSizePct: 0.20 },
        { id: 208, date: '2023-11-02', ticker: 'MONDE', strat: 'Bounce Play', sector: 'Consumer', entry: 8.33, exit: 7.91, shares: 4801, cost: 40000, netPnl: -2100.00, posSizePct: 0.20 },
        { id: 209, date: '2023-11-05', ticker: 'URC', strat: 'Swing', sector: 'Consumer', entry: 100.00, exit: 108.00, shares: 400, cost: 40000, netPnl: 3200.00, posSizePct: 0.20 },
        { id: 210, date: '2023-11-10', ticker: 'CNVRG', strat: 'Bounce Play', sector: 'Telco', entry: 8.33, exit: 7.91, shares: 4801, cost: 40000, netPnl: -2000.00, posSizePct: 0.20 }
    ]
};

// V2.14 Fix: Base posSizePct defaults to 0 instead of 0.20 to prevent ghost data after reset
let globalActualStats = { wr: 0.40, avgGainPct: 0.08, avgLossPct: -0.05, posSizePct: 0.20 };
let undoStack = []; 
let isUndoAction = false;

function saveState() {
    if (isUndoAction) return;
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > 10) undoStack.shift();
    document.getElementById('btn-undo').disabled = false;
    // Also enable mobile undo button
    const mobUndo = document.getElementById('mob-btn-undo');
    if (mobUndo) mobUndo.disabled = false;
}

function undo() {
    if (undoStack.length === 0) return;
    isUndoAction = true; 
    state = JSON.parse(undoStack.pop());
    
    if (undoStack.length === 0) {
        document.getElementById('btn-undo').disabled = true;
        const mobUndo = document.getElementById('mob-btn-undo');
        if (mobUndo) mobUndo.disabled = true;
    }
    
    runEngine(); 
    populateStrategyDropdowns(); 
    renderWlTabs();
    
    if(state.watchlist.findIndex(w => w.id === state.activeWlId) === -1 && state.watchlist.length > 0) {
        state.activeWlId = state.watchlist[0].id;
    }
    if(state.watchlist.length > 0) {
        loadWlTab(state.activeWlId);
    }
    
    const activeNav = document.querySelector('.nav-item.active').id.replace('nav-', '');
    switchView(activeNav);
    isUndoAction = false;
}

// ==========================================
// 3. UI ROUTING & INITIALIZATION
// ==========================================
function switchView(view) {
    const views = ['dashboard', 'allocator', 'ledgers', 'projections', 'guidebook'];
    
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
        
        const nDesk = document.getElementById(`nav-${v}`);
        if(nDesk) nDesk.classList.remove('active');
        
        const nMob = document.getElementById(`mob-${v}`);
        if(nMob) { 
            nMob.classList.remove('active'); 
            nMob.classList.remove('border-t-brand', 'text-brand'); 
        }
    });
    
    document.getElementById(`view-${view}`).classList.remove('hidden');
    
    const targetDesk = document.getElementById(`nav-${view}`);
    if(targetDesk) targetDesk.classList.add('active');
    
    const targetMob = document.getElementById(`mob-${view}`);
    if(targetMob) { targetMob.classList.add('active', 'border-t-brand', 'text-brand'); }
    
    if(view === 'guidebook') {
        document.getElementById('command-center').classList.add('hidden');
    } else {
        document.getElementById('command-center').classList.remove('hidden');
    }
    
    setTimeout(() => {
        if(view === 'dashboard') renderDashboardCharts();
        if(view === 'projections') initSimulatorTab();
        if(view === 'ledgers') renderLedgers();
    }, 50);
}

function exploreSandbox() {
    document.getElementById('init-modal').classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => document.getElementById('init-modal').classList.add('hidden'), 300);
    
    if (state.activeHoldings.length === 0 && state.journal.length > 0) {
        state.activeHoldings.push(
            { id: 901, ticker: 'ALI', sector: 'Property', strategy: 'Breakout', shares: 1200, avgCost: 33.33, currentPrice: 34.10, image: null, targetType: '100', stopType: '100', targetEntries: [38.50, 0], stopEntries: [31.50, 0] },
            { id: 902, ticker: 'JFC', sector: 'Consumer', strategy: 'Bounce Play', shares: 165, avgCost: 242.00, currentPrice: 240.50, image: null, targetType: '50-50', stopType: '100', targetEntries: [255.00, 270.00], stopEntries: [230.00, 0] },
            { id: 903, ticker: 'BDO', sector: 'Financial', strategy: 'Swing', shares: 275, avgCost: 145.45, currentPrice: 141.20, image: null, targetType: '100', stopType: '50-50', targetEntries: [160.00, 0], stopEntries: [138.00, 135.00] }
        );
    }
    
    runEngine(); 
    initPlanner(); 
    switchView('dashboard');
}

function showStartFresh() { 
    document.getElementById('welcome-btns').classList.add('hidden'); 
    document.getElementById('fresh-start-div').classList.remove('hidden'); 
}

function hideStartFresh() { 
    document.getElementById('fresh-start-div').classList.add('hidden'); 
    document.getElementById('welcome-btns').classList.remove('hidden'); 
}

function loadData(event) {
    const file = event.target.files[0]; 
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { 
        try { 
            state = JSON.parse(e.target.result); 
            exploreSandbox(); 
        } catch(err) { 
            alert("Invalid save file."); 
        } 
    };
    reader.readAsText(file);
}

function getStratColor(strat) { 
    const idx = state.strategies.indexOf(strat); 
    return idx > -1 ? themeHexColors[idx % themeHexColors.length] : '#94a3b8'; 
}

function getSectorColor(sector) {
    const sectors = ['Financial', 'Utilities', 'Energy', 'Property', 'Holdings', 'Consumer', 'Telco', 'Mining', 'Others'];
    const idx = sectors.indexOf(sector);
    return idx > -1 ? themeHexColors[idx % themeHexColors.length] : '#94a3b8';
}

// ==========================================
// 4. NUCLEAR ALERT
// ==========================================
let currentSecurityCode = "";

function openResetModal() {
    const modal = document.getElementById('reset-modal');
    const content = document.getElementById('reset-content');
    const input = document.getElementById('reset-confirm-input');
    const btn = document.getElementById('btn-confirm-reset');
    
    currentSecurityCode = Math.floor(100 + Math.random() * 900).toString();
    document.getElementById('reset-code-display').innerText = currentSecurityCode;
    
    input.value = '';
    btn.disabled = true;
    
    modal.classList.remove('hidden');
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        content.classList.remove('scale-95'); 
    }, 10);
}

function hideResetModal() {
    const modal = document.getElementById('reset-modal');
    const content = document.getElementById('reset-content');
    modal.classList.add('opacity-0'); 
    content.classList.add('scale-95'); 
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function checkResetCode(val) {
    const btn = document.getElementById('btn-confirm-reset');
    if (val.trim() === currentSecurityCode) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
}

function executeNuclearReset() {
    const rawCap = getRawValue(document.getElementById('init-capital').value) || 200000;
    
    saveState(); 
    state.ledger = [{ id: Date.now(), date: new Date().toISOString(), type: 'DEPOSIT', amount: rawCap, remarks: 'Initial Funding' }];
    state.activeHoldings = []; 
    state.journal = []; 
    state.watchlist = []; 
    state.activeWlId = null;
    
    hideResetModal();
    showStartFresh(); 
    document.getElementById('init-modal').classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    
    if (distChart) distChart.destroy();
    if (stratChart) stratChart.destroy();
    
    runEngine(); // This will enforce the new 0.0% posSizePct
}

function confirmReset() {
    const rawCap = getRawValue(document.getElementById('init-capital').value);
    if(rawCap <= 0) return alert('Enter a valid starting capital amount.');
    
    saveState(); 
    state.ledger = [{ id: Date.now(), date: new Date().toISOString(), type: 'DEPOSIT', amount: rawCap, remarks: 'Initial Funding' }];
    state.activeHoldings = []; 
    state.journal = []; 
    state.watchlist = []; 
    state.activeWlId = null;
    exploreSandbox();
}

// ==========================================
// 5. CORE MATHEMATICAL ENGINE
// ==========================================
function runEngine(skipGallery = false) {
    let masterCapital = 0;
    let realizedPnl = 0;
    let totalDeployedCost = 0;
    let totalNetValue = 0;
    let unrealizedPnl = 0;
    
    let moneyIn = 0;
    let moneyOut = 0;

    state.ledger.forEach(tx => { 
        if (tx.type === 'DEPOSIT') {
            masterCapital += tx.amount; 
            moneyIn += tx.amount;
        } else {
            masterCapital -= tx.amount; 
            moneyOut += tx.amount;
        }
    });
    
    let netPrincipal = moneyIn - moneyOut;
    
    state.journal.forEach(t => { 
        masterCapital += t.netPnl; 
        realizedPnl += t.netPnl; 
    });

    state.activeHoldings.forEach(pos => {
        pos.totalCost = pos.shares * pos.avgCost * (1 + FEES.buy);
        const rawMktPrice = pos.currentPrice || pos.avgCost;
        const grossValue = pos.shares * rawMktPrice;
        pos.netValue = grossValue > 0 ? grossValue * (1 - FEES.sell) : 0;
        pos.unrealizedPnl = pos.netValue - pos.totalCost;
        pos.pnlPct = pos.totalCost > 0 ? (pos.unrealizedPnl / pos.totalCost) * 100 : 0;
        
        totalDeployedCost += pos.totalCost; 
        totalNetValue += pos.netValue;
        unrealizedPnl += pos.unrealizedPnl;
    });

    let buyingPower = masterCapital - totalDeployedCost;
    
    let totalProfit = masterCapital - netPrincipal;
    let allTimeGrowth = moneyIn > 0 ? (totalProfit / moneyIn) * 100 : 0;

    document.getElementById('out-equity').innerText = fmtPHP(masterCapital);
    document.getElementById('dash-net-principal').innerText = fmtPHP(netPrincipal);
    
    const growthColor = allTimeGrowth >= 0 ? 'text-brand' : 'text-red-500';
    const growthSign = allTimeGrowth >= 0 ? '+' : '';
    document.getElementById('dash-all-time-growth').innerText = `${growthSign}${allTimeGrowth.toFixed(2)}%`;
    document.getElementById('dash-all-time-growth').className = `font-bold ${growthColor}`;

    document.getElementById('out-cash').innerText = fmtPHP(buyingPower);
    
    const pnlColor = unrealizedPnl >= 0 ? 'text-brand' : 'text-red-500';
    const rpnlColor = realizedPnl >= 0 ? 'text-brand' : 'text-red-500';
    const unrPct = totalDeployedCost > 0 ? (unrealizedPnl / totalDeployedCost) * 100 : 0;
    
    document.getElementById('dash-unrealized-pnl').innerText = `${unrealizedPnl >= 0 ? '+' : ''}${fmtPHP(unrealizedPnl)}`;
    document.getElementById('dash-unrealized-pnl').className = `text-2xl lg:text-3xl font-mono font-black leading-none truncate ${pnlColor}`;
    
    document.getElementById('dash-unrealized-pct').innerText = `${unrealizedPnl >= 0 ? '+' : ''}${unrPct.toFixed(2)}%`;
    document.getElementById('dash-unrealized-pct').className = `text-xs font-mono font-bold mt-1 ${pnlColor}`;
    
    document.getElementById('dash-realized-pnl').innerText = `${realizedPnl >= 0 ? '+' : ''}${fmtPHP(realizedPnl)}`;
    document.getElementById('dash-realized-pnl').className = `text-2xl lg:text-3xl font-mono font-black leading-none truncate ${rpnlColor}`;

    const currentPct = masterCapital > 0 ? (totalDeployedCost / masterCapital) * 100 : 0;
    const barContainer = document.getElementById('hdr-bar-container'); 
    barContainer.innerHTML = '';
    
    state.activeHoldings.forEach((pos, idx) => {
        const posPct = masterCapital > 0 ? (pos.totalCost / masterCapital) * 100 : 0;
        if(posPct > 0) {
            const color = barColors[idx % barColors.length];
            barContainer.innerHTML += `<div style="width: ${posPct}%; background-color: ${color};" class="h-full transition-all border-r border-slate-900/20" title="${pos.ticker}"></div>`;
        }
    });
    
    document.getElementById('hdr-dep-lbl').innerText = `${currentPct.toFixed(1)}% DEPLOYED`;
    document.getElementById('hdr-avail-lbl').innerText = `${Math.max(0, 100 - currentPct).toFixed(1)}% AVAILABLE`;

    const total = state.journal.length;
    if(total > 0) {
        const wins = state.journal.filter(t => t.netPnl > 0);
        const losses = state.journal.filter(t => t.netPnl <= 0);
        
        globalActualStats.wr = wins.length / total;
        globalActualStats.avgGainPct = wins.length ? wins.reduce((s,t) => s + (t.netPnl/t.cost), 0) / wins.length : 0;
        globalActualStats.avgLossPct = losses.length ? losses.reduce((s,t) => s + (t.netPnl/t.cost), 0) / losses.length : 0;
        
        // Average the immutable posSizePct, defaulting to 0 if undefined
        globalActualStats.posSizePct = state.journal.reduce((s,t) => s + (t.posSizePct !== undefined ? t.posSizePct : 0), 0) / total;
    } else {
        // V2.14 Fix: Pos Size now cleanly defaults to 0%
        globalActualStats = { wr: 0, avgGainPct: 0, avgLossPct: 0, posSizePct: 0 };
    }

    updateDials();
    
    if (!skipGallery) {
        renderHoldingsGallery(masterCapital);
    }
    
    if(!document.getElementById('view-dashboard').classList.contains('hidden')) {
        renderDashboardCharts();
    }

    return { masterCapital, buyingPower };
}

// ==========================================
// 6. DASHBOARD CHARTS
// ==========================================
let distChart = null; 
let stratChart = null;
let sectorDoughnut = null;
let strategyDoughnut = null;

function updateDials() {
    const wr = globalActualStats.wr * 100;
    const ag = globalActualStats.avgGainPct * 100;
    const al = globalActualStats.avgLossPct * 100;

    document.getElementById('gauge-wr-text').innerText = `${wr.toFixed(1)}%`;
    document.getElementById('gauge-ag-text').innerText = `+${ag.toFixed(1)}%`;
    document.getElementById('gauge-al-text').innerText = `${al.toFixed(1)}%`;
    
    document.getElementById('gauge-wr-text').className = `text-2xl font-mono font-black ${wr >= 50 ? 'text-brand' : 'text-amber-500'}`;
    document.getElementById('gauge-wr-path').className = wr >= 50 ? 'text-brand' : 'text-amber-500';

    const setGauge = (id, pct) => {
        const path = document.getElementById(id);
        const val = Math.min(100, Math.max(0, Math.abs(pct) * 5));
        path.setAttribute('stroke-dasharray', `${val}, 100`);
    };
    
    setGauge('gauge-ag-path', ag); 
    setGauge('gauge-al-path', Math.abs(al));
    document.getElementById('gauge-wr-path').setAttribute('stroke-dasharray', `${Math.min(100, Math.max(0, wr))}, 100`);
}

function calculateDistributionData() {
    const returns = state.journal.map(t => t.netPnl / t.cost);
    if(returns.length === 0) return null;

    const N = returns.length;
    const mean = returns.reduce((a,b) => a + b, 0) / N;
    const variance = returns.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / N;
    const stdDev = Math.sqrt(variance) || 0.01;

    const bins = []; 
    const labels = [];
    
    for(let i = -20; i <= 20; i += 2) {
        if(i === -20) labels.push('<-20%');
        else if(i === 20) labels.push('>20%');
        else labels.push(`${i}%`);
        bins.push(0);
    }

    returns.forEach(r => {
        let pct = r * 100;
        let idx = Math.floor((pct + 20) / 2);
        if(idx < 0) idx = 0;
        if(idx >= bins.length) idx = bins.length - 1;
        bins[idx]++;
    });

    const lineData = [];
    for(let i = 0; i < bins.length; i++) {
        let x = (-20 + (i*2)) / 100;
        let pdf = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
        lineData.push(pdf * N * 0.02); 
    }

    return { labels, barData: bins, lineData };
}

function calculateStrategyStatsData() {
    const stats = {};
    state.journal.forEach(t => {
        if(!stats[t.strat]) stats[t.strat] = { count: 0, wins: 0 };
        stats[t.strat].count++;
        if(t.netPnl > 0) stats[t.strat].wins++;
    });
    
    const labels = []; const barData = []; const lineData = []; const colors = [];
    Object.keys(stats).forEach(s => {
        labels.push(s);
        barData.push(stats[s].count); // Executions
        lineData.push((stats[s].wins / stats[s].count) * 100); // Win %
        colors.push(getStratColor(s));
    });
    return { labels, barData, lineData, colors };
}

function renderDashboardCharts() {
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const distEmpty = document.getElementById('dist-empty');
    const stratEmpty = document.getElementById('strat-empty');

    if(state.journal.length === 0) {
        if(distEmpty) distEmpty.classList.remove('hidden');
        if(stratEmpty) stratEmpty.classList.remove('hidden');
        if(distChart) distChart.destroy();
        if(stratChart) stratChart.destroy();
    } else {
        if(distEmpty) distEmpty.classList.add('hidden');
        if(stratEmpty) stratEmpty.classList.add('hidden');

        const dData = calculateDistributionData();
        if(dData) {
            const ctxD = document.getElementById('distChart');
            if(ctxD && distChart) distChart.destroy();
            distChart = new Chart(ctxD.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: dData.labels,
                    datasets: [
                        { type: 'line', label: 'Normal Dist.', data: dData.lineData, borderColor: '#3E8E35', borderWidth: 2, tension: 0.4, pointRadius: 0, yAxisID: 'y' },
                        { type: 'bar', label: 'Trade Count', data: dData.barData, backgroundColor: '#3b82f6', borderRadius: 4, yAxisID: 'y' }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: textColor, maxRotation: 45, minRotation: 45 } }, y: { grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1 } } } }
            });
        }

        const sData = calculateStrategyStatsData();
        if(sData.labels.length > 0) {
            const ctxS = document.getElementById('stratChart');
            
            const minWidthPerBar = 50; 
            const chartWrapper = ctxS.parentElement;
            chartWrapper.style.width = Math.max(100, sData.labels.length * minWidthPerBar) + 'px';

            if(ctxS && stratChart) stratChart.destroy();
            stratChart = new Chart(ctxS.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: sData.labels,
                    datasets: [
                        { type: 'line', label: 'Executions', data: sData.barData, borderColor: '#f59e0b', borderWidth: 2, pointBackgroundColor: '#f59e0b', yAxisID: 'y1' },
                        { type: 'bar', label: 'Win %', data: sData.lineData, backgroundColor: sData.colors, borderRadius: 4, yAxisID: 'y' }
                    ]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { legend: { display: false } }, 
                    scales: { 
                        x: { grid: { display: false }, ticks: { color: textColor } }, 
                        y: { position: 'left', grid: { color: gridColor }, min: 0, max: 100, ticks: { color: textColor, callback: v => v+'%' } }, 
                        y1: { position: 'right', grid: { display: false }, ticks: { color: '#f59e0b', stepSize: 1 } } 
                    } 
                }
            });
        }
    }

    let totalActiveValue = 0;
    let sectorMap = {};
    let strategyMap = {};
    
    state.activeHoldings.forEach(pos => {
        totalActiveValue += pos.netValue;
        if(!sectorMap[pos.sector]) sectorMap[pos.sector] = 0;
        sectorMap[pos.sector] += pos.netValue;
        
        if(!strategyMap[pos.strategy]) strategyMap[pos.strategy] = 0;
        strategyMap[pos.strategy] += pos.netValue;
    });

    const secLabels = []; const secData = []; const secColors = [];
    document.getElementById('sector-legend').innerHTML = '';
    Object.keys(sectorMap).forEach(s => {
        if(sectorMap[s] > 0) {
            secLabels.push(s); secData.push(sectorMap[s]);
            const col = getSectorColor(s); secColors.push(col);
            const pct = (sectorMap[s] / totalActiveValue) * 100;
            document.getElementById('sector-legend').innerHTML += `
                <div class="flex justify-between items-center text-xs font-mono w-full">
                    <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background-color: ${col}"></div><span class="text-slate-700 dark:text-slate-300 font-bold">${s}</span></div>
                    <span class="text-slate-500">${pct.toFixed(1)}%</span>
                </div>`;
        }
    });

    const ctxSector = document.getElementById('sectorChart');
    if(ctxSector && sectorDoughnut) sectorDoughnut.destroy();
    if(secData.length > 0) {
        sectorDoughnut = new Chart(ctxSector.getContext('2d'), {
            type: 'doughnut',
            data: { labels: secLabels, datasets: [{ data: secData, backgroundColor: secColors, borderWidth: 0, hoverOffset: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ₱${ctx.raw.toLocaleString()}` } } } }
        });
    } else {
        document.getElementById('sector-legend').innerHTML = '<span class="text-xs text-slate-500">No active capital.</span>';
    }

    const stratLabels = []; const stratData = []; const stratColors = [];
    document.getElementById('strategy-legend').innerHTML = '';
    Object.keys(strategyMap).forEach(s => {
        if(strategyMap[s] > 0) {
            stratLabels.push(s); stratData.push(strategyMap[s]);
            const col = getStratColor(s); stratColors.push(col);
            const pct = (strategyMap[s] / totalActiveValue) * 100;
            document.getElementById('strategy-legend').innerHTML += `
                <div class="flex justify-between items-center text-xs font-mono w-full">
                    <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background-color: ${col}"></div><span class="text-slate-700 dark:text-slate-300 font-bold">${s}</span></div>
                    <span class="text-slate-500">${pct.toFixed(1)}%</span>
                </div>`;
        }
    });

    const ctxStrategy = document.getElementById('strategyChart');
    if(ctxStrategy && strategyDoughnut) strategyDoughnut.destroy();
    if(stratData.length > 0) {
        strategyDoughnut = new Chart(ctxStrategy.getContext('2d'), {
            type: 'doughnut',
            data: { labels: stratLabels, datasets: [{ data: stratData, backgroundColor: stratColors, borderWidth: 0, hoverOffset: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ₱${ctx.raw.toLocaleString()}` } } } }
        });
    } else {
        document.getElementById('strategy-legend').innerHTML = '<span class="text-xs text-slate-500">No active capital.</span>';
    }
}

// ==========================================
// 7. ACTIVE HOLDINGS GALLERY
// ==========================================
// V2.14 Fix: Dynamic "Add Chart" upload button for active holdings missing an image
function renderHoldingsGallery(masterCapital) {
    const container = document.getElementById('holdings-gallery'); 
    if(!container) return;
    
    container.innerHTML = '';
    
    if (state.activeHoldings.length === 0) { 
        container.innerHTML = `
            <div class="col-span-full glass-panel p-12 rounded-2xl flex flex-col items-center justify-center text-center">
                <svg class="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                <p class="text-slate-500 dark:text-slate-400 font-mono text-sm tracking-widest uppercase">No Active Holdings</p>
                <p class="text-slate-400 dark:text-slate-500 text-xs mt-2">Execute a trade in the Trading Plan to populate your gallery.</p>
            </div>`; 
        return; 
    }
    
    state.activeHoldings.slice().reverse().forEach(pos => {
        const pnlColor = pos.unrealizedPnl >= 0 ? 'text-brand' : 'text-red-500';
        const pnlSign = pos.unrealizedPnl >= 0 ? '+' : '';
        const stratColor = getStratColor(pos.strategy);
        const posSizePct = masterCapital > 0 ? (pos.totalCost / masterCapital) * 100 : 0;
        
        const imgBlock = pos.image 
            ? `<img src="${pos.image}" class="w-full h-40 object-cover rounded-t-xl cursor-zoom-in" onclick="viewImage('${pos.image}')">`
            : `<div class="w-full h-40 bg-slate-100 dark:bg-slate-900 rounded-t-xl flex flex-col items-center justify-center group cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors" onclick="document.getElementById('gal-up-${pos.id}').click()">
                   <svg class="w-8 h-8 text-slate-400 group-hover:text-brand transition-colors mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                   <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-brand transition-colors">Add Chart</span>
                   <input type="file" id="gal-up-${pos.id}" class="hidden" accept="image/*" onchange="handleGalleryUpload(event, ${pos.id})">
               </div>`;

        container.innerHTML += `
            <div class="glass-panel rounded-2xl flex flex-col shadow-lg border-t-0 hover:shadow-xl transition-shadow group">
                ${imgBlock}
                <div class="p-5 flex flex-col flex-1 border-t border-slate-200 dark:border-slate-700/50">
                    <div class="flex justify-between items-start mb-4">
                        <span class="font-black text-xl text-slate-900 dark:text-white leading-none">${pos.ticker}</span>
                        <span class="text-[9px] font-sans font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border" style="color: ${stratColor}; border-color: ${stratColor}40">${pos.strategy}</span>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-y-3 gap-x-2 text-xs font-mono mb-4 flex-1 items-center">
                        <div class="text-slate-500">Position Size:</div>
                        <div class="text-right text-blue-500 dark:text-blue-400 font-bold">${posSizePct.toFixed(1)}%</div>
                        
                        <div class="text-slate-500">Shares:</div>
                        <div class="text-right text-slate-900 dark:text-white font-bold">${pos.shares.toLocaleString()}</div>
                        
                        <div class="text-slate-500">Avg Cost:</div>
                        <div class="text-right text-slate-900 dark:text-white font-bold">₱${fmtDec(pos.avgCost)}</div>
                        
                        <div class="text-slate-500 border-b border-slate-200 dark:border-slate-700/50 pb-2">Mkt Price:</div>
                        <div class="text-right border-b border-slate-200 dark:border-slate-700/50 pb-2">
                            <input type="number" value="${pos.currentPrice}" oninput="handleMktPriceInput(${pos.id}, this.value)" class="w-20 bg-transparent text-right text-blue-500 font-bold focus:outline-none focus:bg-blue-500/10 rounded px-1 transition-all border border-dashed border-blue-500/50">
                        </div>
                        
                        <div class="text-slate-500 pt-1">Net Value:</div>
                        <div class="text-right text-slate-900 dark:text-white font-black pt-1" id="g-netval-${pos.id}">${fmtPHP(pos.netValue)}</div>
                    </div>
                    
                    <div class="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 flex justify-between items-center border border-slate-200 dark:border-slate-800">
                        <button onclick="openCloseModal(${pos.id})" class="px-5 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white rounded font-black tracking-wider text-[10px] transition-all shadow-sm">CLOSE</button>
                        <div class="text-right">
                            <span class="block font-black ${pnlColor}" id="g-pnl-${pos.id}">${pnlSign}${fmtPHP(pos.unrealizedPnl)}</span>
                            <span class="block text-[10px] font-bold ${pnlColor}" id="g-pnlpct-${pos.id}">${pnlSign}${pos.pnlPct.toFixed(2)}%</span>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

// V2.14 Helper: Processes the file input from the Gallery card
function handleGalleryUpload(e, id) {
    if(e.target.files.length > 0) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const pos = state.activeHoldings.find(p => p.id === id);
            if (pos) {
                pos.image = ev.target.result;
                saveState();
                runEngine(false); // Update gallery with the new image
            }
        };
        reader.readAsDataURL(e.target.files[0]);
    }
}

function handleMktPriceInput(id, newPrice) {
    const price = parseFloat(newPrice); 
    if(isNaN(price)) return;
    
    const idx = state.activeHoldings.findIndex(p => p.id === id);
    if(idx > -1) { 
        const pos = state.activeHoldings[idx]; 
        pos.currentPrice = price; 
        
        runEngine(true); 
        
        const isWin = pos.unrealizedPnl >= 0; 
        const pnlColor = isWin ? 'text-brand' : 'text-red-500'; 
        const pnlSign = isWin ? '+' : '';
        
        const netValEl = document.getElementById(`g-netval-${id}`); 
        if(netValEl) netValEl.innerText = fmtPHP(pos.netValue);
        
        const pnlEl = document.getElementById(`g-pnl-${id}`); 
        if(pnlEl) { 
            pnlEl.innerText = `${pnlSign}${fmtPHP(pos.unrealizedPnl)}`; 
            pnlEl.className = `block font-black ${pnlColor}`; 
        }
        
        const pnlPctEl = document.getElementById(`g-pnlpct-${id}`); 
        if(pnlPctEl) { 
            pnlPctEl.innerText = `${pnlSign}${pos.pnlPct.toFixed(2)}%`; 
            pnlPctEl.className = `block text-[10px] font-bold ${pnlColor}`; 
        }
    }
}

// ==========================================
// 8. TRADING PLAN (THE ALLOCATOR)
// ==========================================
const getBoardLot = (price) => { 
    if (price < 0.01) return 1000000; 
    if (price < 0.05) return 100000; 
    if (price < 0.50) return 10000; 
    if (price < 5.00) return 1000; 
    if (price < 50.00) return 100; 
    if (price < 1000.00) return 10; 
    return 5; 
};

const createEmptyWl = (id) => ({ 
    id, ticker: '', sector: 'Others', varPct: 1.0, maxPosPct: 25, 
    setup: state.strategies[0], 
    trancheType: '100', entries: [0, 0, 0], computedAEP: 0,
    stopType: '100', stopEntries: [0, 0], computedStop: 0,
    targetType: '100', targetEntries: [0, 0], computedTarget: 0,
    shares: 0, cost: 0, valid: false, isTrancheValid: false 
});

function populateStrategyDropdowns() {
    const select = document.getElementById('w-setup'); 
    const currentVal = select.value; 
    select.innerHTML = '';
    state.strategies.forEach(s => { 
        select.innerHTML += `<option value="${s}">${s}</option>`; 
    });
    if (state.strategies.includes(currentVal)) select.value = currentVal; 
    else if (state.strategies.length > 0) select.value = state.strategies[0];
}

function initPlanner() {
    populateStrategyDropdowns();
    if (state.watchlist.length === 0) { 
        state.watchlist.push(createEmptyWl(Date.now())); 
        state.activeWlId = state.watchlist[0].id; 
    }
    renderWlTabs(); 
    loadWlTab(state.activeWlId);
}

function renderWlTabs() {
    const container = document.getElementById('wl-tabs'); 
    container.innerHTML = '';
    
    state.watchlist.forEach((wl, i) => {
        const btn = document.createElement('button');
        btn.className = `wl-tab px-4 py-2 rounded-t-lg font-mono text-sm font-bold border-2 border-b-0 transition-colors z-10 -mb-[2px] ${wl.id === state.activeWlId ? 'active' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`;
        btn.innerText = wl.ticker || `Set ${i+1}`; 
        btn.onclick = () => loadWlTab(wl.id);
        container.appendChild(btn);
    });
    
    if (state.watchlist.length < 10) {
        const addBtn = document.createElement('button'); 
        addBtn.className = `wl-tab px-3 py-2 rounded-t-lg font-bold border-2 border-b-0 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 z-10 -mb-[2px] text-slate-400`; 
        addBtn.innerHTML = `+`;
        addBtn.onclick = () => { 
            const n = createEmptyWl(Date.now()); 
            state.watchlist.push(n); 
            loadWlTab(n.id); 
            renderWlTabs(); 
        }; 
        container.appendChild(addBtn);
    }
}

function loadWlTab(id) {
    state.activeWlId = id; 
    const wl = state.watchlist.find(w => w.id === id);
    
    document.getElementById('w-ticker').value = wl.ticker; 
    document.getElementById('w-sector').value = wl.sector || 'Others';
    document.getElementById('w-var').value = wl.varPct; 
    document.getElementById('w-maxpos').value = wl.maxPosPct || 25; 
    document.getElementById('w-setup').value = wl.setup || state.strategies[0]; 
    
    document.getElementById('w-tranche').value = wl.trancheType || '100'; 
    document.getElementById('w-stop-type').value = wl.stopType || '100'; 
    document.getElementById('w-target-type').value = wl.targetType || '100'; 
    
    changeTrancheType(wl.trancheType, false);
    changeStopType(wl.stopType, false);
    changeTargetType(wl.targetType, false);
    
    const prev = document.getElementById('img-preview');
    if(wl.image) { 
        prev.src = wl.image; 
        prev.classList.remove('hidden'); 
        document.getElementById('clear-img').classList.remove('hidden'); 
        document.getElementById('img-placeholder').classList.add('hidden'); 
    } else { 
        prev.classList.add('hidden'); 
        document.getElementById('clear-img').classList.add('hidden'); 
        document.getElementById('img-placeholder').classList.remove('hidden'); 
    }
    
    renderWlTabs(); 
    calcPlanner();
}

function updateWl(key, val) { 
    const wl = state.watchlist.find(w => w.id === state.activeWlId); 
    wl[key] = (key === 'ticker' || key === 'setup' || key === 'sector') ? val : (parseFloat(val) || 0); 
    if (key === 'ticker') renderWlTabs(); 
    calcPlanner(); 
}

function changeTrancheType(type, clear = true) {
    const wl = state.watchlist.find(w => w.id === state.activeWlId); 
    wl.trancheType = type; 
    if (clear) wl.entries = [0, 0, 0];
    
    const cont = document.getElementById('tranche-inputs'); 
    cont.innerHTML = ''; 
    let cfgs = [];
    
    if (type === '100') cfgs = [{l:'Entry Price (100%)', i:0}]; 
    else if (type === '50-50') cfgs = [{l:'E1 (50%)', i:0}, {l:'E2 (50%)', i:1}]; 
    else if (type === '50-30-20') cfgs = [{l:'E1 (50%)', i:0}, {l:'E2 (30%)', i:1}, {l:'E3 (20%)', i:2}];
    
    cont.className = `grid gap-4 grid-cols-${cfgs.length}`;
    cfgs.forEach(c => { 
        cont.innerHTML += `
            <div>
                <label class="block text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">${c.l}</label>
                <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">₱</span>
                    <input type="number" step="any" class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 pl-7 font-mono text-base text-slate-900 dark:text-white focus:ring-2 focus:ring-brand outline-none" value="${wl.entries[c.i] || ''}" oninput="updateTranche(${c.i}, this.value)">
                </div>
            </div>`; 
    });
    if (clear) calcPlanner();
}

function updateTranche(idx, val) { 
    state.watchlist.find(w => w.id === state.activeWlId).entries[idx] = parseFloat(val) || 0; 
    calcPlanner(); 
}

function changeStopType(type, clear = true) {
    const wl = state.watchlist.find(w => w.id === state.activeWlId); 
    wl.stopType = type; 
    if (clear) wl.stopEntries = [0, 0];
    
    const cont = document.getElementById('stop-inputs'); 
    cont.innerHTML = ''; 
    let cfgs = [];
    
    if (type === '100') cfgs = [{l:'Stop Price (100%)', i:0}]; 
    else if (type === '50-50') cfgs = [{l:'Stop 1 (50%)', i:0}, {l:'Stop 2 (50%)', i:1}]; 
    
    cont.className = `grid gap-3 grid-cols-${cfgs.length}`;
    cfgs.forEach(c => { 
        cont.innerHTML += `
            <div>
                <label class="block text-[9px] text-red-500/70 uppercase font-bold tracking-widest mb-1">${c.l}</label>
                <div class="relative">
                    <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs">₱</span>
                    <input type="number" step="any" class="w-full bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded p-1.5 pl-6 font-mono text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none" value="${wl.stopEntries[c.i] || ''}" oninput="updateStop(${c.i}, this.value)">
                </div>
            </div>`; 
    });
    if (clear) calcPlanner();
}

function updateStop(idx, val) { 
    state.watchlist.find(w => w.id === state.activeWlId).stopEntries[idx] = parseFloat(val) || 0; 
    calcPlanner(); 
}

function changeTargetType(type, clear = true) {
    const wl = state.watchlist.find(w => w.id === state.activeWlId); 
    wl.targetType = type; 
    if (clear) wl.targetEntries = [0, 0];
    
    const cont = document.getElementById('target-inputs'); 
    cont.innerHTML = ''; 
    let cfgs = [];
    
    if (type === '100') cfgs = [{l:'Target Price (100%)', i:0}]; 
    else if (type === '50-50') cfgs = [{l:'Target 1 (50%)', i:0}, {l:'Target 2 (50%)', i:1}]; 
    
    cont.className = `grid gap-3 grid-cols-${cfgs.length}`;
    cfgs.forEach(c => { 
        cont.innerHTML += `
            <div>
                <label class="block text-[9px] text-green-600/70 uppercase font-bold tracking-widest mb-1">${c.l}</label>
                <div class="relative">
                    <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs">₱</span>
                    <input type="number" step="any" class="w-full bg-white dark:bg-slate-900 border border-green-200 dark:border-green-900/50 rounded p-1.5 pl-6 font-mono text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand outline-none" value="${wl.targetEntries[c.i] || ''}" oninput="updateTarget(${c.i}, this.value)">
                </div>
            </div>`; 
    });
    if (clear) calcPlanner();
}

function updateTarget(idx, val) { 
    state.watchlist.find(w => w.id === state.activeWlId).targetEntries[idx] = parseFloat(val) || 0; 
    calcPlanner(); 
}

function calcPlanner() {
    const wl = state.watchlist.find(w => w.id === state.activeWlId); 
    const { buyingPower, masterCapital } = runEngine(false);

    const capBudget = masterCapital * ((wl.maxPosPct || 25) / 100); 
    document.getElementById('w-maxpos-peso').innerText = `Limit: ${fmtPHP(capBudget)}`;

    let aep = 0, valid = true; 
    const [e1, e2, e3] = wl.entries;
    if (wl.trancheType === '100') { 
        if (!e1) valid = false; else aep = e1; 
    } else if (wl.trancheType === '50-50') { 
        if (!e1 || !e2) valid = false; else aep = (e1*0.5) + (e2*0.5); 
    } else if (wl.trancheType === '50-30-20') { 
        if (!e1 || !e2 || !e3) valid = false; else aep = (e1*0.5) + (e2*0.3) + (e3*0.2); 
    }
    wl.computedAEP = valid ? aep : 0; 
    wl.isTrancheValid = valid;
    
    document.getElementById('w-aep').innerText = wl.computedAEP ? `₱${wl.computedAEP.toFixed(4)}` : "₱0.00"; 
    const bl = getBoardLot(wl.computedAEP || 0); 
    document.getElementById('w-boardlot').innerText = bl.toLocaleString();

    let computedStop = 0;
    const [s1, s2] = wl.stopEntries;
    if (wl.stopType === '100' && s1) computedStop = s1;
    else if (wl.stopType === '50-50' && s1 && s2) computedStop = (s1*0.5) + (s2*0.5);
    wl.computedStop = computedStop;
    
    document.getElementById('w-blended-stop').innerText = wl.computedStop ? `₱${wl.computedStop.toFixed(4)}` : "₱0.00";

    let computedTarget = 0;
    const [t1, t2] = wl.targetEntries;
    if (wl.targetType === '100' && t1) computedTarget = t1;
    else if (wl.targetType === '50-50' && t1 && t2) computedTarget = (t1*0.5) + (t2*0.5);
    wl.computedTarget = computedTarget;
    
    document.getElementById('w-blended-target').innerText = wl.computedTarget ? `₱${wl.computedTarget.toFixed(4)}` : "₱0.00";

    if (wl.computedAEP > 0) {
        const costPerShare = wl.computedAEP * (1 + FEES.buy);
        
        if (wl.computedStop > 0) { 
            const stopNetPerShare = wl.computedStop * (1 - FEES.sell); 
            const stopPct = ((stopNetPerShare - costPerShare) / costPerShare) * 100; 
            document.getElementById('w-stop-pct').innerText = `${stopPct.toFixed(2)}%`; 
        } else { 
            document.getElementById('w-stop-pct').innerText = ``; 
        }
        
        if (wl.computedTarget > 0) { 
            const targetNetPerShare = wl.computedTarget * (1 - FEES.sell); 
            const targetPct = ((targetNetPerShare - costPerShare) / costPerShare) * 100; 
            document.getElementById('w-target-pct').innerText = `+${targetPct.toFixed(2)}%`; 
        } else { 
            document.getElementById('w-target-pct').innerText = ``; 
        }
    } else { 
        document.getElementById('w-stop-pct').innerText = ``; 
        document.getElementById('w-target-pct').innerText = ``; 
    }

    if (!wl.computedAEP || !wl.computedStop || !wl.ticker || wl.computedStop >= wl.computedAEP || !wl.isTrancheValid) { 
        document.getElementById('o-shares').value = ''; 
        calcTicketFromShares(); 
        return; 
    }

    const costPerShare = wl.computedAEP * (1 + FEES.buy); 
    const netStopPerShare = wl.computedStop * (1 - FEES.sell); 
    const trueRiskPerShare = costPerShare - netStopPerShare;
    
    const riskBudget = masterCapital * (wl.varPct / 100);
    
    let idealSharesVaR = trueRiskPerShare > 0 ? Math.floor(riskBudget / trueRiskPerShare) : 0; 
    let idealSharesCap = costPerShare > 0 ? Math.floor(capBudget / costPerShare) : 0;
    let rawShares = Math.min(idealSharesVaR, idealSharesCap, Math.floor(Math.max(0, buyingPower) / costPerShare));
    
    let finalShares = Math.floor(rawShares / bl) * bl; 
    document.getElementById('o-shares').value = finalShares.toLocaleString();
    
    calcTicketFromShares();
}

function userEditedShares(el) { 
    let val = el.value.replace(/,/g, '').replace(/\D/g, ''); 
    el.value = val ? parseInt(val).toLocaleString() : ''; 
    calcTicketFromShares(); 
}

function calcTicketFromShares() {
    const wl = state.watchlist.find(w => w.id === state.activeWlId); 
    const sharesStr = document.getElementById('o-shares').value; 
    const sharesInput = parseInt(sharesStr.replace(/,/g, '')) || 0; 
    wl.shares = sharesInput;
    
    const { buyingPower, masterCapital } = runEngine(true); 
    const btnExec = document.getElementById('btn-execute'); 
    const warnBox = document.getElementById('exec-warning'); 
    const blWarning = document.getElementById('boardlot-warning'); 
    const actualPosPctEl = document.getElementById('w-actual-pos-pct');
    
    const costPerShareCheck = wl.computedAEP ? wl.computedAEP * (1 + FEES.buy) : 0;
    const netStopPerShareCheck = wl.computedStop ? wl.computedStop * (1 - FEES.sell) : 0;
    const trueRiskPerShareCheck = costPerShareCheck - netStopPerShareCheck;
    const riskBudgetCheck = masterCapital * (wl.varPct / 100);
    const capBudgetCheck = masterCapital * ((wl.maxPosPct || 25) / 100);
    const idealSharesVaR = trueRiskPerShareCheck > 0 ? Math.floor(riskBudgetCheck / trueRiskPerShareCheck) : 0; 
    const idealSharesCap = costPerShareCheck > 0 ? Math.floor(capBudgetCheck / costPerShareCheck) : 0;

    let expectedDD = 0;
    const lossImpactPct = masterCapital > 0 ? ((wl.shares * trueRiskPerShareCheck) / masterCapital) * 100 : 0;
    const lossProb = 1 - (globalActualStats.wr > 0 ? globalActualStats.wr : 0.4); 
    if(lossProb > 0 && lossProb < 1) { 
        const expectedStreak = Math.log(100) / Math.log(1/lossProb); 
        expectedDD = 1 - Math.pow(1 - (lossImpactPct/100), expectedStreak); 
    }

    btnExec.disabled = true; 
    warnBox.classList.remove('bg-red-700/95', 'bg-red-600/90', 'bg-brand', 'bg-amber-500/90');
    warnBox.classList.add('hidden'); 
    blWarning.classList.add('hidden'); 
    document.getElementById('ind-cost').className = "absolute top-0 left-0 w-full h-0.5 bg-transparent"; 
    document.getElementById('ind-risk').className = "absolute top-0 left-0 w-full h-0.5 bg-transparent";

    if (buyingPower < 0) { 
        warnBox.innerHTML = `🚨 <b>MARGIN DEFICIT:</b> Negative Buying Power.`; 
        warnBox.className = "absolute top-0 left-0 w-full bg-red-700/95 text-white text-[10px] font-bold text-center py-0.5 uppercase tracking-widest z-10 rounded-tr-xl rounded-tl-xl transition-all duration-300";
        warnBox.classList.remove('hidden'); 
        actualPosPctEl.innerText = `Actual Pos Size: 0.00%`; 
        wl.valid = false; 
        return; 
    }

    if (!wl.isTrancheValid) { 
        warnBox.innerText = "Incomplete Tranche Prices!"; 
        warnBox.className = "absolute top-0 left-0 w-full bg-amber-500/90 text-white text-[10px] font-bold text-center py-0.5 uppercase tracking-widest z-10 rounded-tr-xl rounded-tl-xl transition-all duration-300";
        warnBox.classList.remove('hidden'); 
        actualPosPctEl.innerText = `Actual Pos Size: 0.00%`; 
        wl.valid = false; 
        return; 
    }
    
    if (!wl.computedAEP || !wl.computedStop || !wl.ticker) { 
        actualPosPctEl.innerText = `Actual Pos Size: 0.00%`; 
        return; 
    }
    
    if (wl.computedStop >= wl.computedAEP) { 
        warnBox.innerText = "Stop Loss must be below Entry!"; 
        warnBox.className = "absolute top-0 left-0 w-full bg-red-600/90 text-white text-[10px] font-bold text-center py-0.5 uppercase tracking-widest z-10 rounded-tr-xl rounded-tl-xl transition-all duration-300";
        warnBox.classList.remove('hidden'); 
        return; 
    }
    
    if (wl.computedTarget > 0 && wl.computedTarget <= wl.computedAEP) { 
        warnBox.innerText = "Target must be > Entry."; 
        warnBox.className = "absolute top-0 left-0 w-full bg-amber-500/90 text-white text-[10px] font-bold text-center py-0.5 uppercase tracking-widest z-10 rounded-tr-xl rounded-tl-xl transition-all duration-300";
        warnBox.classList.remove('hidden'); 
        actualPosPctEl.innerText = `Actual Pos Size: 0.00%`; 
        return; 
    }

    const costPerShare = wl.computedAEP * (1 + FEES.buy); 
    const netStopPerShare = wl.computedStop * (1 - FEES.sell); 
    const trueRiskPerShare = costPerShare - netStopPerShare;
    
    wl.cost = wl.shares * costPerShare; 
    const actualRisk = wl.shares * trueRiskPerShare; 
    const allocPct = masterCapital > 0 ? (wl.cost / masterCapital) * 100 : 0; 
    
    actualPosPctEl.innerText = `Actual Pos Size: ${allocPct.toFixed(2)}%`;

    let rr = 0; let projProfit = 0; let winImpactPct = 0;
    if (wl.computedTarget > wl.computedAEP) { 
        const targetNetPerShare = wl.computedTarget * (1 - FEES.sell); 
        rr = (targetNetPerShare - costPerShare) / trueRiskPerShare; 
        projProfit = wl.shares * (targetNetPerShare - costPerShare); 
        winImpactPct = masterCapital > 0 ? (projProfit / masterCapital) * 100 : 0; 
    }

    document.getElementById('o-cost').innerText = fmtPHP(wl.cost); 
    document.getElementById('o-risk').innerText = fmtPHP(actualRisk); 
    document.getElementById('o-impact-loss').innerText = `-${lossImpactPct.toFixed(2)}% Acct Impact`;
    document.getElementById('o-profit').innerText = fmtPHP(projProfit); 
    document.getElementById('o-impact-win').innerText = `+${winImpactPct.toFixed(2)}% Acct Impact`; 
    document.getElementById('o-rr').innerText = `${rr.toFixed(2)} R`;
    
    if (wl.shares > 0) {
        const bl = getBoardLot(wl.computedAEP); 
        
        if(idealSharesVaR <= idealSharesCap) {
            document.getElementById('ind-risk').className = "absolute top-0 left-0 w-full h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"; 
        } else {
            document.getElementById('ind-cost').className = "absolute top-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]";
        }

        if (wl.shares % bl !== 0) { 
            blWarning.innerText = `Invalid Board Lot. Multiple of ${bl.toLocaleString()} req.`; 
            blWarning.classList.remove('hidden'); 
            wl.valid = false; 
        } else if (wl.cost > buyingPower) { 
            warnBox.innerText = "Insufficient Buying Power"; 
            warnBox.className = "absolute top-0 left-0 w-full bg-red-600/90 text-white text-[10px] font-bold text-center py-0.5 uppercase tracking-widest z-10 rounded-tr-xl rounded-tl-xl transition-all duration-300";
            warnBox.classList.remove('hidden'); 
            wl.valid = false; 
        } else if (wl.shares > idealSharesVaR || wl.shares > idealSharesCap) { 
            warnBox.innerHTML = `⚠️ <b>LIMIT EXCEEDED:</b> Allocating above pre-determined VaR or Max Pos. Proceed with caution.`; 
            warnBox.className = "absolute top-0 left-0 w-full bg-amber-500/90 text-white text-[10px] font-bold text-center py-0.5 uppercase tracking-widest z-10 rounded-tr-xl rounded-tl-xl transition-all duration-300";
            warnBox.classList.remove('hidden'); 
            wl.valid = true; 
            btnExec.disabled = false; 
        } else if (expectedDD > 0.40) { 
            warnBox.innerHTML = `💀 <b>KELLY CRITERION BREACH:</b> Size is lethal. Limit size!`; 
            warnBox.className = "absolute top-0 left-0 w-full bg-red-700/95 text-white text-[10px] font-bold text-center py-0.5 uppercase tracking-widest z-10 rounded-tr-xl rounded-tl-xl transition-all duration-300";
            warnBox.classList.remove('hidden'); 
            wl.valid = true; 
            btnExec.disabled = false; 
        } else if (expectedDD > 0.25) { 
            warnBox.innerHTML = `⚠️ <b>AI Warning:</b> High expected drawdown.`; 
            warnBox.className = "absolute top-0 left-0 w-full bg-red-600/90 text-white text-[10px] font-bold text-center py-0.5 uppercase tracking-widest z-10 rounded-tr-xl rounded-tl-xl transition-all duration-300";
            warnBox.classList.remove('hidden'); 
            wl.valid = true; 
            btnExec.disabled = false; 
        } else { 
            warnBox.classList.add('hidden'); 
            wl.valid = true; 
            btnExec.disabled = false; 
        }
    }
}

function executeTrade() { 
    saveState(); 
    const wl = state.watchlist.find(w => w.id === state.activeWlId); 
    if (!wl.valid) return; 
    
    state.activeHoldings.push({ 
        id: Date.now(), 
        ticker: wl.ticker, 
        sector: wl.sector || 'Others',
        strategy: wl.setup, 
        shares: wl.shares, 
        avgCost: wl.computedAEP, 
        currentPrice: wl.computedAEP, 
        image: wl.image,
        targetType: wl.targetType,
        targetEntries: [...wl.targetEntries],
        stopType: wl.stopType,
        stopEntries: [...wl.stopEntries]
    }); 
    
    const freshWl = createEmptyWl(wl.id); 
    state.watchlist[state.watchlist.findIndex(w => w.id === wl.id)] = freshWl; 
    
    runEngine(); 
    loadWlTab(freshWl.id); 
    switchView('dashboard'); 
}

// ==========================================
// 9. LEDGERS & CLOSE MODAL
// ==========================================
function renderLedgers() {
    const fBody = document.getElementById('funding-body'); 
    fBody.innerHTML = '';
    
    if (state.ledger.length === 0) { 
        fBody.innerHTML = `
            <tr><td colspan="4">
                <div class="glass-panel m-4 p-8 rounded-2xl flex flex-col items-center justify-center text-center">
                    <svg class="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <p class="text-slate-500 dark:text-slate-400 font-mono text-sm tracking-widest uppercase">No Funding Records</p>
                </div>
            </td></tr>`; 
    } else {
        state.ledger.slice().reverse().forEach(tx => {
            const isDep = tx.type === 'DEPOSIT'; 
            const sign = isDep ? '+' : '-'; 
            const color = isDep ? 'text-brand' : 'text-red-500';
            const typeBadge = isDep ? '<span class="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[9px] font-bold">Deposit</span>' : '<span class="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[9px] font-bold">Withdrawal</span>';
            const dateObj = new Date(tx.date); 
            const dateStr = !isNaN(dateObj) ? dateObj.toLocaleDateString() : tx.date;
            
            fBody.innerHTML += `
                <tr class="hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors">
                    <td class="p-3 text-slate-500 text-[10px]">${dateStr}</td>
                    <td class="p-3 font-mono font-bold ${color}">${sign}${fmtPHP(tx.amount)}</td>
                    <td class="p-3">${typeBadge}</td>
                    <td class="p-3 text-slate-500 text-xs">${tx.remarks}</td>
                </tr>`;
        });
    }

    const jBody = document.getElementById('journal-body'); 
    jBody.innerHTML = '';
    
    if (state.journal.length === 0) {
        jBody.innerHTML = `
            <tr><td colspan="6">
                <div class="glass-panel m-4 p-8 rounded-2xl flex flex-col items-center justify-center text-center">
                    <svg class="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                    <p class="text-slate-500 dark:text-slate-400 font-mono text-sm tracking-widest uppercase">Journal Empty</p>
                </div>
            </td></tr>`;
    } else {
        state.journal.slice().reverse().forEach(t => {
            const pnlC = t.netPnl >= 0 ? 'text-brand' : 'text-red-500'; 
            const pnlSign = t.netPnl >= 0 ? '+' : ''; 
            const pnlPct = (t.netPnl / t.cost) * 100;
            jBody.innerHTML += `
                <tr class="hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors relative group">
                    <td class="p-4 text-slate-500 text-[10px]">${t.date}</td>
                    <td class="p-4"><span class="font-bold text-slate-900 dark:text-white block">${t.ticker}</span><span class="text-[9px] uppercase" style="color: ${getStratColor(t.strat)}">${t.strat}</span></td>
                    <td class="p-4 text-right text-slate-700 dark:text-slate-300">₱${t.entry.toFixed(2)}</td>
                    <td class="p-4 text-right text-slate-700 dark:text-slate-300">₱${t.exit.toFixed(2)}</td>
                    <td class="p-4 text-right font-bold ${pnlC}">${pnlSign}${pnlPct.toFixed(2)}%</td>
                    <td class="p-4 text-right font-bold ${pnlC}">
                        ${pnlSign}${fmtPHP(t.netPnl)}
                        <div class="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-white dark:from-slate-900 via-white/90 dark:via-slate-900/90 to-transparent flex items-center justify-end pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="deleteJournalEntry(${t.id})" class="bg-red-600/80 hover:bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold shadow-lg backdrop-blur-sm transition-transform hover:scale-110" title="Delete Trade">✕</button>
                        </div>
                    </td>
                </tr>`;
        });
    }
}

function openCloseModal(id) { 
    const pos = state.activeHoldings.find(p => p.id === id); 
    if(!pos) return;

    document.getElementById('close-id').value = id; 
    document.getElementById('close-ticker-label').innerText = pos.ticker; 
    document.getElementById('close-shares-label').innerText = `Total Shares: ${pos.shares.toLocaleString()}`;
    document.getElementById('close-shares').value = pos.shares;
    document.getElementById('close-price').value = pos.currentPrice || pos.avgCost; 
    
    const planContainer = document.getElementById('close-plan-buttons');
    planContainer.innerHTML = '';
    
    if(pos.targetType === '100' && pos.targetEntries && pos.targetEntries[0]) {
         planContainer.innerHTML += `<button onclick="document.getElementById('close-price').value = ${pos.targetEntries[0]}" class="px-2 py-1 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-800/50 text-green-700 dark:text-green-400 text-[10px] font-bold rounded border border-green-200 dark:border-green-800 transition">🎯 T1: ₱${pos.targetEntries[0]}</button>`;
    } else if (pos.targetType === '50-50' && pos.targetEntries) {
         if(pos.targetEntries[0]) planContainer.innerHTML += `<button onclick="document.getElementById('close-price').value = ${pos.targetEntries[0]}" class="px-2 py-1 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-800/50 text-green-700 dark:text-green-400 text-[10px] font-bold rounded border border-green-200 dark:border-green-800 transition">🎯 T1: ₱${pos.targetEntries[0]}</button>`;
         if(pos.targetEntries[1]) planContainer.innerHTML += `<button onclick="document.getElementById('close-price').value = ${pos.targetEntries[1]}" class="px-2 py-1 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-800/50 text-green-700 dark:text-green-400 text-[10px] font-bold rounded border border-green-200 dark:border-green-800 transition">🎯 T2: ₱${pos.targetEntries[1]}</button>`;
    }
    
    if(pos.stopType === '100' && pos.stopEntries && pos.stopEntries[0]) {
         planContainer.innerHTML += `<button onclick="document.getElementById('close-price').value = ${pos.stopEntries[0]}" class="px-2 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-700 dark:text-red-400 text-[10px] font-bold rounded border border-red-200 dark:border-red-800 transition">🛑 S1: ₱${pos.stopEntries[0]}</button>`;
    } else if (pos.stopType === '50-50' && pos.stopEntries) {
         if(pos.stopEntries[0]) planContainer.innerHTML += `<button onclick="document.getElementById('close-price').value = ${pos.stopEntries[0]}" class="px-2 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-700 dark:text-red-400 text-[10px] font-bold rounded border border-red-200 dark:border-red-800 transition">🛑 S1: ₱${pos.stopEntries[0]}</button>`;
         if(pos.stopEntries[1]) planContainer.innerHTML += `<button onclick="document.getElementById('close-price').value = ${pos.stopEntries[1]}" class="px-2 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-700 dark:text-red-400 text-[10px] font-bold rounded border border-red-200 dark:border-red-800 transition">🛑 S2: ₱${pos.stopEntries[1]}</button>`;
    }

    const modal = document.getElementById('close-modal'); 
    const content = document.getElementById('close-content'); 
    modal.classList.remove('hidden'); 
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        content.classList.remove('scale-95'); 
    }, 10); 
}

function setCloseShares(pct) {
    const id = parseInt(document.getElementById('close-id').value);
    const pos = state.activeHoldings.find(p => p.id === id);
    if(pos) {
        if(pct === 1.0) {
            document.getElementById('close-shares').value = pos.shares;
        } else {
            const bl = getBoardLot(pos.currentPrice || pos.avgCost);
            let shares = Math.floor((pos.shares * pct) / bl) * bl;
            if(shares <= 0 && pos.shares > 0) shares = pos.shares; 
            document.getElementById('close-shares').value = shares;
        }
    }
}

function hideCloseModal() { 
    const modal = document.getElementById('close-modal'); 
    const content = document.getElementById('close-content'); 
    modal.classList.add('opacity-0'); 
    content.classList.add('scale-95'); 
    setTimeout(() => modal.classList.add('hidden'), 300); 
}

function confirmCloseTrade() { 
    saveState(); 
    const id = parseInt(document.getElementById('close-id').value); 
    const exit = parseFloat(document.getElementById('close-price').value); 
    const sharesToClose = parseInt(document.getElementById('close-shares').value);
    
    if(isNaN(exit) || exit <= 0) return alert("Invalid execution price."); 
    
    const idx = state.activeHoldings.findIndex(p => p.id === id); 
    if(idx > -1) { 
        const pos = state.activeHoldings[idx]; 
        
        if(isNaN(sharesToClose) || sharesToClose <= 0 || sharesToClose > pos.shares) {
            return alert(`Invalid shares. Enter between 1 and ${pos.shares}.`);
        }

        const grossVal = sharesToClose * exit; 
        const netVal = grossVal * (1 - FEES.sell); 
        const proportionalCost = sharesToClose * pos.avgCost * (1 + FEES.buy);
        const pnl = netVal - proportionalCost; 
        
        const { masterCapital } = runEngine(true);
        const recordedPosPct = masterCapital > 0 ? (proportionalCost / masterCapital) : 0;
        
        state.journal.push({ 
            id: Date.now(), 
            date: new Date().toISOString().split('T')[0], 
            ticker: pos.ticker, 
            sector: pos.sector || 'Others',
            strat: pos.strategy, 
            shares: sharesToClose, 
            entry: pos.avgCost, 
            exit: exit, 
            cost: proportionalCost, 
            netPnl: pnl,
            posSizePct: recordedPosPct 
        }); 
        
        if (sharesToClose >= pos.shares) {
            state.activeHoldings.splice(idx, 1); 
        } else {
            pos.shares -= sharesToClose;
        }

        hideCloseModal(); 
        runEngine(); 
    } 
}

function deleteJournalEntry(id) { 
    saveState(); 
    const idx = state.journal.findIndex(t => t.id === id); 
    if(idx > -1) { 
        state.journal.splice(idx, 1); 
        runEngine(); 
        renderLedgers(); 
    } 
}

function submitLedger() { 
    const rawAmt = getRawValue(document.getElementById('modal-amt').value); 
    if (rawAmt <= 0) return alert('Enter a valid amount.'); 
    
    const type = document.getElementById('modal-type').value;
    
    if (type === 'WITHDRAWAL') {
        const { masterCapital } = runEngine(true);
        if (rawAmt > masterCapital) {
            return alert("Insufficient equity. You cannot withdraw more than your Current Total Equity.");
        }
    }

    const dateInput = document.getElementById('modal-date').value;
    const finalDate = dateInput ? new Date(dateInput).toISOString() : new Date().toISOString();

    saveState(); 
    
    state.ledger.push({ 
        id: Date.now(), 
        date: finalDate, 
        type: type, 
        amount: rawAmt, 
        remarks: document.getElementById('modal-rem').value || 'Manual Adjustment' 
    }); 
    
    closeLedger(); 
    runEngine(); 
    calcPlanner(); 
    renderLedgers(); 
}

// ==========================================
// 10. PROJECTIONS (EXPECTANCY FORECASTER)
// ==========================================
function updateHorizonLbl(val) {
    document.getElementById('horizon-lbl').innerText = val + (val == 1 ? " Year" : " Years");
}

function initSimulatorTab() { 
    if (document.getElementById('rbaf-port').value === "") resetSimulatorToActuals(); 
    else runSimulatorCore(); 
}

function resetSimulatorToActuals() {
    const rawCap = runEngine(false).masterCapital;
    document.getElementById('rbaf-port').value = rawCap.toLocaleString('en-US'); 
    document.getElementById('rbaf-pos').value = (globalActualStats.posSizePct * 100).toFixed(1); 
    document.getElementById('rbaf-target').value = 50; 
    document.getElementById('rbaf-wr').value = (globalActualStats.wr * 100).toFixed(1); 
    document.getElementById('rbaf-gain').value = (globalActualStats.avgGainPct * 100).toFixed(1); 
    document.getElementById('rbaf-loss').value = (Math.abs(globalActualStats.avgLossPct) * 100).toFixed(1); 
    document.getElementById('rbaf-freq-num').value = 5; 
    document.getElementById('rbaf-freq-unit').value = 'week';
    document.getElementById('rbaf-horizon').value = 5; 
    updateHorizonLbl(5);
    
    runSimulatorCore();
}

function runSimulatorCore() {
    document.getElementById('base-wr').innerText = `${(globalActualStats.wr * 100).toFixed(1)}%`; 
    document.getElementById('base-gain').innerText = `+${(globalActualStats.avgGainPct * 100).toFixed(1)}%`; 
    document.getElementById('base-loss').innerText = `-${(Math.abs(globalActualStats.avgLossPct) * 100).toFixed(1)}%`; 
    document.getElementById('base-pos').innerText = `${(globalActualStats.posSizePct * 100).toFixed(1)}%`;

    const portSize = getRawValue(document.getElementById('rbaf-port').value) || 0; 
    const posSizePct = parseFloat(document.getElementById('rbaf-pos').value) / 100 || 0; 
    const desiredRet = parseFloat(document.getElementById('rbaf-target').value) / 100 || 0; 
    const winRate = parseFloat(document.getElementById('rbaf-wr').value) / 100 || 0; 
    const avgGain = parseFloat(document.getElementById('rbaf-gain').value) / 100 || 0; 
    const avgLoss = -Math.abs(parseFloat(document.getElementById('rbaf-loss').value) / 100 || 0); 
    const freqNum = parseFloat(document.getElementById('rbaf-freq-num').value) || 0.001; 
    const freqUnit = document.getElementById('rbaf-freq-unit').value;
    const horizonYears = parseInt(document.getElementById('rbaf-horizon').value) || 5;

    const posSizePeso = portSize * posSizePct; 
    const pesoGoal = portSize * desiredRet; 
    const glRatio = Math.abs(avgLoss) > 0 ? (avgGain / Math.abs(avgLoss)) : 0; 
    const idealVar = (posSizePct * Math.abs(avgLoss)) * 100;
    
    const posEvPct = (winRate * avgGain) + ((1 - winRate) * avgLoss); 
    const portEvPct = posSizePct * posEvPct; 

    let tradesNeeded = 0, winsNeeded = 0, lossesNeeded = 0; 
    let timeStr = "-";
    
    if (portEvPct > 0) { 
        tradesNeeded = Math.log(1 + desiredRet) / Math.log(1 + portEvPct); 
        winsNeeded = tradesNeeded * winRate; 
        lossesNeeded = tradesNeeded * (1 - winRate); 
        
        const totalTime = tradesNeeded / freqNum; 
        if (freqUnit === 'week') { 
            if (totalTime > 52) timeStr = (totalTime / 52).toFixed(1) + " Yrs"; 
            else if (totalTime > 4.33) timeStr = (totalTime / 4.33).toFixed(1) + " Mos"; 
            else timeStr = totalTime.toFixed(1) + " Wks"; 
        } else { 
            if (totalTime > 12) timeStr = (totalTime / 12).toFixed(1) + " Yrs"; 
            else timeStr = totalTime.toFixed(1) + " Mos"; 
        } 
    }

    const tradesPerYear = freqNum * (freqUnit === 'week' ? 52 : 12);
    const totalHorizonTrades = Math.max(10, Math.ceil(tradesPerYear * horizonYears));

    let expectedLosingStreak = 0; 
    let expectedMaxDD = 0; 
    const lossProb = 1 - winRate; 
    
    const tradeHorizon = Math.max(100, tradesNeeded || 100);
    
    if (lossProb > 0 && lossProb < 1) { 
        expectedLosingStreak = Math.log(tradeHorizon) / Math.log(1 / lossProb); 
        const lossPerTrade = posSizePct * Math.abs(avgLoss); 
        expectedMaxDD = 1 - Math.pow(1 - lossPerTrade, expectedLosingStreak); 
    } else if (lossProb === 1) { 
        expectedLosingStreak = tradeHorizon; 
        const lossPerTrade = posSizePct * Math.abs(avgLoss); 
        expectedMaxDD = 1 - Math.pow(1 - lossPerTrade, expectedLosingStreak); 
    }

    document.getElementById('out-rbaf-goal').innerText = fmtPHP(pesoGoal); 
    document.getElementById('out-rbaf-trades').innerText = portEvPct > 0 ? Math.ceil(tradesNeeded).toLocaleString() : "Impossible"; 
    document.getElementById('out-rbaf-time').innerText = timeStr;
    document.getElementById('out-rbaf-pospeso').innerText = fmtPHP(posSizePeso); 
    document.getElementById('out-rbaf-idealvar').innerText = `${idealVar.toFixed(2)}%`; 
    document.getElementById('out-rbaf-enp').innerText = `${(portEvPct * 100).toFixed(2)}%`;
    document.getElementById('out-rbaf-losses').innerText = portEvPct > 0 ? Math.floor(lossesNeeded).toLocaleString() : "-"; 
    document.getElementById('out-rbaf-streak').innerText = Math.round(expectedLosingStreak); 
    document.getElementById('out-rbaf-dd').innerText = `-${(expectedMaxDD * 100).toFixed(1)}%`;

    const ddBox = document.getElementById('out-rbaf-dd-box');
    const ddLbl = document.getElementById('out-rbaf-dd-lbl');
    const ddVal = document.getElementById('out-rbaf-dd');

    ddBox.className = 'p-3 lg:p-4 rounded-lg border shadow-inner relative group hover:z-50 transition-colors duration-300';
    ddLbl.className = 'text-[8px] uppercase font-bold tracking-widest mb-1 flex justify-between items-center transition-colors duration-300';
    ddVal.className = 'text-2xl font-mono font-black truncate mt-1 transition-colors duration-300';

    if (expectedMaxDD >= 0.20) {
        ddBox.classList.add('bg-red-100', 'dark:bg-red-950/80', 'border-red-500', 'shadow-[0_0_15px_rgba(239,68,68,0.2)]');
        ddLbl.classList.add('text-red-700', 'dark:text-red-400');
        ddVal.classList.add('text-red-700', 'dark:text-red-500');
    } else if (expectedMaxDD >= 0.15) {
        ddBox.classList.add('bg-amber-50', 'dark:bg-amber-950/40', 'border-amber-300', 'dark:border-amber-900');
        ddLbl.classList.add('text-amber-600', 'dark:text-amber-500');
        ddVal.classList.add('text-amber-600', 'dark:text-amber-400');
    } else {
        ddBox.classList.add('bg-slate-100', 'dark:bg-slate-800/80', 'border-slate-300', 'dark:border-slate-600/50');
        ddLbl.classList.add('text-slate-600', 'dark:text-slate-400');
        ddVal.classList.add('text-slate-800', 'dark:text-slate-300');
    }

    const narrativeEl = document.getElementById('diag-text'); 
    let dText = ""; 
    const totalJournals = state.journal.length;

    if (totalJournals === 0) { 
        dText = "Waiting for data. Using Sandbox defaults until you log closed trades in your Ledgers tab."; 
    } else if (portEvPct <= 0) { 
        dText = `🚨 <span class='font-bold text-red-600 dark:text-red-400'>Mathematical Drain.</span> Reaching your goal is mathematically impossible right now. Because your Average Loss is too large compared to your Win Rate and Average Gain, your system is actively bleeding capital. To fix this, you must ruthlessly tighten your Stop Loss so your losers are a fraction of the size of your winners.`; 
    } else if (expectedMaxDD >= 0.40) { 
        dText = `💀 <span class='font-bold text-red-600 dark:text-red-500'>Risk of Ruin (Over-Leveraged).</span> Your math is positive, but your Position Size is lethal. A normal, inevitable losing streak will guarantee a portfolio drawdown of <span class='font-mono'>-${(expectedMaxDD*100).toFixed(1)}%</span>. You will go bankrupt before your edge can play out. Drastically reduce your Position Size.`; 
    } else if (expectedMaxDD > 0.20) { 
        dText = `🔥 <span class='font-bold text-amber-600 dark:text-amber-500'>Over-Leveraged.</span> Your mathematical expectancy is positive, but your Position Size is too large. Based on your Win Rate, you will likely hit a ~${Math.round(expectedLosingStreak)}-trade losing streak. This will cause a brutal <span class='font-mono'>-${(expectedMaxDD*100).toFixed(1)}%</span> portfolio drawdown.`; 
    } else if (glRatio < 1.5) { 
        dText = `⚠️ <span class='font-bold text-amber-600 dark:text-amber-400'>Bleeding Edge.</span> Your system is technically profitable, but your Gain/Loss Ratio (${glRatio.toFixed(1)}:1) is dangerously thin. Professional systems typically require a minimum 2:1 ratio. A normal string of consecutive losing trades will rapidly wipe out weeks of profits. Widen your targets or tighten your stops.`; 
    } else { 
        dText = `✅ <span class='font-bold text-brand'>Positive Expectancy Confirmed.</span> Your compounding blueprint is sound. Your expected drawdown is a manageable <span class='font-mono'>-${(expectedMaxDD*100).toFixed(1)}%</span>.`; 
    }

    narrativeEl.innerHTML = dText; 
    
    const narrativeTop = document.getElementById('rbaf-narrative');
    if (portEvPct > 0) { 
        narrativeTop.innerHTML = `To generate <span class="font-bold">${fmtPHP(pesoGoal)}</span> in <span class="font-bold">${timeStr}</span>, your math requires <span class="font-bold">${Math.ceil(tradesNeeded).toLocaleString()} total trades</span>. You must execute <span class="text-brand font-bold">${Math.ceil(winsNeeded).toLocaleString()} winning trades</span> while preparing to absorb <span class="text-red-500 font-bold">${Math.floor(lossesNeeded).toLocaleString()} statistical losses</span>. Your Current Average VaR is <span class="text-blue-500 font-bold">${idealVar.toFixed(2)}%</span>, projecting a maximum expected drawdown of <span class="text-red-500 font-bold">-${(expectedMaxDD * 100).toFixed(1)}%</span>. Your Gain/Loss ratio is <span class="font-bold">${glRatio.toFixed(2)}:1</span>.`; 
    } else { 
        narrativeTop.innerHTML = `<span class="text-red-500 font-bold">Mathematical Drain.</span> Your Expected Growth is negative. Hitting your goal is mathematically impossible.`; 
    }

    const chartData = calculateSimChartData(portSize, portEvPct, tradesNeeded, pesoGoal, totalHorizonTrades, tradesPerYear); 
    drawSimChart(chartData);
}

function calculateSimChartData(startCap, twkPortEvPct, twkTradesNeeded, pesoGoal, totalHorizonTrades, tradesPerYear) {
    let labels = [], actData = [], twkData = [], targetData = []; 
    let cAct = startCap, cTwk = startCap; 
    const targetCap = startCap + pesoGoal;
    
    const actPosEvPct = (globalActualStats.wr * globalActualStats.avgGainPct) + ((1 - globalActualStats.wr) * globalActualStats.avgLossPct); 
    const actPortEvPct = globalActualStats.posSizePct * actPosEvPct;
    
    const maxTrades = totalHorizonTrades; 
    const step = Math.max(1, Math.floor(maxTrades / 100)); 
    
    for(let i = 0; i <= maxTrades; i++) { 
        if(i > 0) { 
            cAct = cAct * (1 + actPortEvPct); 
            cTwk = cTwk * (1 + twkPortEvPct); 
        } 
        if(i % step === 0 || i === maxTrades) { 
            labels.push(i); 
            targetData.push(targetCap); 
            actData.push(cAct > 0 ? cAct : 0); 
            twkData.push(cTwk > 0 ? cTwk : 0); 
        } 
    }
    
    const actColor = actPortEvPct > 0 ? '#3E8E35' : (actPortEvPct < 0 ? '#ef4444' : '#64748b');
    return { labels, actData, twkData, targetData, actColor, tradesPerYear };
}

let simChart = null;
function drawSimChart(data) {
    const canvas = document.getElementById('simChart'); 
    if(!canvas) return; 
    const ctx = canvas.getContext('2d'); 
    if(simChart) simChart.destroy();
    
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; 
    const textColor = isDark ? '#94a3b8' : '#64748b';

    simChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Actual Edge', data: data.actData, borderColor: data.actColor, borderWidth: 3, tension: 0.1, pointRadius: 0, hitRadius: 10, hoverRadius: 5 },
                { label: 'Expectancy Forecast', data: data.twkData, borderColor: '#3b82f6', borderDash: [5, 5], borderWidth: 3, tension: 0.1, pointRadius: 0, hitRadius: 10, hoverRadius: 5 },
                { label: 'Peso Goal', data: data.targetData, borderColor: '#f59e0b', borderDash: [3, 3], borderWidth: 2, tension: 0, pointRadius: 0, hitRadius: 10, hoverRadius: 5 }
            ]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false, 
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                legend: { display: false },
                tooltip: { 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    titleColor: '#cbd5e1', 
                    bodyColor: '#f8fafc', 
                    borderColor: '#334155', 
                    borderWidth: 1, 
                    padding: 12, 
                    callbacks: { 
                        title: (ctx) => `Trade #${ctx[0].label} (Yr ${(ctx[0].label / data.tradesPerYear).toFixed(1)})`, 
                        label: (ctx) => `${ctx.dataset.label}: ₱${ctx.raw.toLocaleString('en-US', {maximumFractionDigits: 0})}` 
                    } 
                }
            },
            scales: { 
                x: { 
                    display: true,
                    title: { display: true, text: 'Number of Trades', color: textColor, font: {size: 10, family: 'JetBrains Mono'} },
                    grid: { display: false }, 
                    ticks: { color: textColor, maxTicksLimit: 10 } 
                }, 
                xYears: {
                    type: 'category',
                    position: 'top',
                    display: true,
                    title: { display: true, text: 'Years Passed', color: textColor, font: {size: 10, family: 'JetBrains Mono'} },
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: textColor,
                        maxTicksLimit: 10,
                        callback: function(value, index) {
                            const tradeNum = data.labels[index];
                            const yr = tradeNum / data.tradesPerYear;
                            return 'Yr ' + yr.toFixed(1);
                        }
                    }
                },
                y: { 
                    grid: { color: gridColor }, 
                    ticks: { 
                        color: textColor, 
                        callback: function(value) { 
                            if (value >= 1e18) return '₱' + (value / 1e18).toFixed(1) + 'Qi'; 
                            if (value >= 1e15) return '₱' + (value / 1e15).toFixed(1) + 'Q'; 
                            if (value >= 1e12) return '₱' + (value / 1e12).toFixed(1) + 'T'; 
                            if (value >= 1e9) return '₱' + (value / 1e9).toFixed(1) + 'B'; 
                            if (value >= 1e6) return '₱' + (value / 1e6).toFixed(1) + 'M'; 
                            if (value >= 1e3) return '₱' + (value / 1e3).toFixed(1) + 'k'; 
                            return '₱' + value; 
                        } 
                    } 
                } 
            }
        }
    });
}

// ==========================================
// 11. MISC MODALS & EVENT LISTENERS
// ==========================================
function openStrategyModal() { 
    const list = document.getElementById('strategy-list'); 
    list.innerHTML = ''; 
    state.strategies.forEach((s, idx) => { 
        list.innerHTML += `
            <div class="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <span class="text-sm font-bold text-slate-800 dark:text-white" style="color: ${getStratColor(s)}">${s}</span>
                <button onclick="deleteStrategy(${idx})" class="text-slate-400 hover:text-red-500 text-xs px-2">✕</button>
            </div>`; 
    }); 
    
    const m = document.getElementById('strategy-modal'); 
    const c = document.getElementById('strategy-content'); 
    m.classList.remove('hidden'); 
    setTimeout(() => { 
        m.classList.remove('opacity-0'); 
        c.classList.remove('scale-95'); 
    }, 10); 
}

function closeStrategyModal() { 
    const m = document.getElementById('strategy-modal'); 
    const c = document.getElementById('strategy-content'); 
    m.classList.add('opacity-0'); 
    c.classList.add('scale-95'); 
    setTimeout(() => m.classList.add('hidden'), 300); 
}

function addStrategy() { 
    saveState(); 
    const val = document.getElementById('new-strategy-input').value.trim(); 
    if(!val || state.strategies.includes(val)) return; 
    
    state.strategies.push(val); 
    document.getElementById('new-strategy-input').value = ''; 
    openStrategyModal(); 
    populateStrategyDropdowns(); 
    runEngine(); 
}

function deleteStrategy(idx) { 
    if(state.strategies.length <= 1) return alert("Must have at least one strategy."); 
    const stratName = state.strategies[idx]; 
    const isUsed = state.activeHoldings.some(h => h.strategy === stratName); 
    
    if(isUsed) return alert("Cannot delete a strategy while it is being used in an Open Trade."); 
    
    // V2.14 Fix: Explicit Confirmation Guardrail
    if(!confirm(`Are you sure you want to permanently delete the "${stratName}" strategy?`)) return;

    saveState(); 
    state.strategies.splice(idx, 1); 
    openStrategyModal(); 
    populateStrategyDropdowns(); 
    runEngine(); 
}

function openLedger() { 
    document.getElementById('modal-amt').value = ''; 
    document.getElementById('modal-rem').value = ''; 
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('modal-date').value = today;

    const modal = document.getElementById('ledger-modal'); 
    const content = document.getElementById('ledger-content'); 
    modal.classList.remove('hidden'); 
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        content.classList.remove('scale-95'); 
    }, 10); 
}

function closeLedger() { 
    const modal = document.getElementById('ledger-modal'); 
    const content = document.getElementById('ledger-content'); 
    modal.classList.add('opacity-0'); 
    content.classList.add('scale-95'); 
    setTimeout(() => modal.classList.add('hidden'), 300); 
}

window.addEventListener('paste', e => {
    if(document.getElementById('view-allocator').classList.contains('hidden')) return;
    
    if(e.clipboardData.files.length > 0 && e.clipboardData.files[0].type.startsWith('image/')) { 
        const reader = new FileReader(); 
        reader.onload = (ev) => { 
            state.watchlist.find(w => w.id === state.activeWlId).image = ev.target.result; 
            loadWlTab(state.activeWlId); 
        }; 
        reader.readAsDataURL(e.clipboardData.files[0]); 
    }
});

function clearImage(e) { 
    e.stopPropagation(); 
    state.watchlist.find(w => w.id === state.activeWlId).image = null; 
    loadWlTab(state.activeWlId); 
}

function viewImage(src) { 
    if(!src) return; 
    document.getElementById('modal-img').src = src; 
    document.getElementById('image-modal').classList.remove('hidden'); 
    setTimeout(() => document.getElementById('image-modal').classList.remove('opacity-0'), 10); 
}

function closeImage() { 
    document.getElementById('image-modal').classList.add('opacity-0'); 
    setTimeout(() => document.getElementById('image-modal').classList.add('hidden'), 200); 
}

async function saveData() { 
    if (!currentUser) return;
    try {
        await setDoc(doc(db, 'users', currentUser.uid), { tradingSandboxState: state }, { merge: true });
        console.log("State silently pushed to Firestore.");
    } catch(e) {
        console.error("Error saving data:", e);
    }
}