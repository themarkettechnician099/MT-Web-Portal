import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 0. FIREBASE INTEGRATION (V1.8 MODULAR)
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
            
            // FIX 1: Look for the correct Trading Sandbox key
            if (data.tradingSandboxState) {
                state = data.tradingSandboxState;
                
                // FIX 2: Check if the ledger actually has entries (meaning you initialized it)
                if (state.ledger && state.ledger.length > 0) {
                    document.getElementById('init-modal').classList.add('hidden');
                    runEngine();
                    populateStrategyDropdowns();
                    renderWlTabs();
                    if(state.watchlist.length > 0) {
                        loadWlTab(state.activeWlId);
                    }
                    switchView('dashboard');
                } else {
                    console.log("Poisoned save found (empty ledger). Forcing Welcome Screen.");
                    document.getElementById('init-modal').classList.remove('hidden', 'opacity-0', 'pointer-events-none');
                }
                
            } else {
                console.log("No Trading Sandbox data yet. Leaving Welcome Screen open.");
                document.getElementById('init-modal').classList.remove('hidden', 'opacity-0', 'pointer-events-none');
            }
        } else {
            console.log("No cloud profile found. Ready for initialization.");
            document.getElementById('init-modal').classList.remove('hidden', 'opacity-0', 'pointer-events-none');
        }
    } catch (error) {
        console.error("Error loading cloud data:", error);
    }
}

// ==========================================
// 1. ENGINE CONFIG & STATE
// ==========================================
const FEES = { buy: 0.00295, sell: 0.00395 }; 
const themeHexColors = ['#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e', '#14b8a6', '#f97316', '#6366f1', '#3E8E35'];
const sectorsList = ['Financial', 'Utilities', 'Energy', 'Property', 'Holdings', 'Consumer', 'Telco', 'Mining', 'Others'];

Chart.defaults.color = '#64748b';
Chart.defaults.font.family = 'JetBrains Mono';

let state = {
    startingCapital: 0,
    realizedPnl: 0,
    sets: [],
    activeSetId: null
};

let undoStack = [];

function formatNumberInput(input) {
    let cursor = input.selectionStart;
    let val = input.value.replace(/[^0-9.]/g, '');
    let parts = val.split('.');
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
    if (val) {
        let splitVal = val.split('.');
        let formatted = parseInt(splitVal[0] || 0, 10).toLocaleString('en-US') + (splitVal.length > 1 ? '.' + splitVal[1] : '');
        let diff = formatted.length - input.value.length;
        input.value = formatted;
        try { input.setSelectionRange(cursor + diff, cursor + diff); } catch(e) {}
    } else { input.value = ''; }
}

function getRawValue(str) { return parseFloat(str.replace(/,/g, '')) || 0; }

const fmtPHP = (n) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n || 0);

const fmtPHPDash = (n) => {
    const absN = Math.abs(n);
    if (absN >= 1e9) return (n < 0 ? '-' : '') + '₱' + (absN / 1e9).toFixed(2) + 'B';
    if (absN >= 1e6) return (n < 0 ? '-' : '') + '₱' + (absN / 1e6).toFixed(2) + 'M';
    return fmtPHP(n);
};

function saveSnapshot() {
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > 10) undoStack.shift();
    document.getElementById('btn-undo').disabled = false;
    document.getElementById('mob-btn-undo').disabled = false;
}

function undoAction() {
    if (undoStack.length === 0) return;
    state = JSON.parse(undoStack.pop());
    if (undoStack.length === 0) {
        document.getElementById('btn-undo').disabled = true;
        document.getElementById('mob-btn-undo').disabled = true;
    }
    if(!state.sets.find(s => s.id === state.activeSetId) && state.sets.length > 0) {
        state.activeSetId = state.sets[0].id;
    }
    runEngine();
    renderTabs();
    if(state.sets.length > 0) buildSetForm();
}

// ==========================================
// 2. INITIALIZATION & RESET MODALS
// ==========================================
function createEmptySet(id, num) {
    return { 
        id, num, ticker: '', sector: 'Others',
        varPct: 1.0, maxPosPct: 25.0, 
        trancheType: '100', entries: [0,0,0], computedAEP: 0,
        stopType: '100', stopEntries: [0,0], computedStop: 0,
        targetType: '100', targetEntries: [0,0], computedTarget: 0,
        shares: 0, currentPrice: 0, totalCost: 0, netValue: 0,
        image: null
    };
}

function startApp() {
    const rawCap = getRawValue(document.getElementById('init-capital').value);
    if(rawCap <= 0) return alert('Enter valid starting capital.');
    
    saveSnapshot();
    state.startingCapital = rawCap;
    state.realizedPnl = 0;
    state.sets = [
        createEmptySet(Date.now(), 1),
        createEmptySet(Date.now()+1, 2),
        createEmptySet(Date.now()+2, 3)
    ];
    state.activeSetId = state.sets[0].id;
    
    document.getElementById('init-modal').classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => document.getElementById('init-modal').classList.add('hidden'), 300);
    
    runEngine();
    renderTabs();
    buildSetForm();
    switchView('dashboard');
}

function openResetModal() {
    const modal = document.getElementById('reset-modal');
    const content = document.getElementById('reset-content');
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

function executeNuclearReset() {
    hideResetModal();
    state = {
        startingCapital: 0,
        realizedPnl: 0,
        sets: [],
        activeSetId: null
    };
    undoStack = [];
    document.getElementById('init-capital').value = '100,000';
    document.getElementById('init-modal').classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    
    if(capChartObj) capChartObj.destroy();
    if(secChartObj) secChartObj.destroy();
}

// ==========================================
// 3. UI & ROUTING
// ==========================================
function switchView(view) {
    ['dashboard', 'allocator'].forEach(v => {
        document.getElementById(`view-${v}`).classList.add('hidden');
        document.getElementById(`nav-${v}`).classList.remove('active');
        document.getElementById(`mob-${v}`).classList.remove('active', 'border-t-brand', 'text-brand');
    });
    document.getElementById(`view-${view}`).classList.remove('hidden');
    document.getElementById(`nav-${view}`).classList.add('active');
    document.getElementById(`mob-${view}`).classList.add('active', 'border-t-brand', 'text-brand');
    
    if(view === 'dashboard') runEngine();
}

function renderTabs() {
    const cont = document.getElementById('set-tabs');
    cont.innerHTML = '';
    state.sets.forEach(s => {
        const btn = document.createElement('button');
        btn.className = `px-4 py-2 font-mono text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${s.id === state.activeSetId ? 'border-brand text-brand bg-brand/5' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`;
        const label = s.ticker || `Set ${s.num}`;
        btn.innerHTML = s.shares > 0 ? `<span class="w-2 h-2 inline-block rounded-full bg-brand mr-1"></span>${label}` : label;
        btn.onclick = () => { state.activeSetId = s.id; renderTabs(); buildSetForm(); };
        cont.appendChild(btn);
    });
    if(state.sets.length < 20) {
        const addBtn = document.createElement('button');
        addBtn.className = `px-3 py-2 font-bold text-slate-400 border-b-2 border-transparent hover:text-brand transition-colors`;
        addBtn.innerHTML = '+';
        addBtn.onclick = () => {
            saveSnapshot();
            const n = createEmptySet(Date.now(), state.sets.length + 1);
            state.sets.push(n);
            state.activeSetId = n.id;
            renderTabs();
            buildSetForm();
        };
        cont.appendChild(addBtn);
    }
}

// ==========================================
// 4. LIVE ALLOCATION ENGINE
// ==========================================
let capChartObj = null;
let secChartObj = null;

function runEngine() {
    let deployedCost = 0;
    let currentNetValue = 0;
    let sectorMap = {};
    let tickerMap = {};

    state.sets.forEach(s => {
        if(s.shares > 0 && s.computedAEP > 0) {
            const cost = s.shares * s.computedAEP * (1 + FEES.buy);
            const rawMkt = s.currentPrice || s.computedAEP;
            const netVal = (s.shares * rawMkt) * (1 - FEES.sell);
            
            s.totalCost = cost;
            s.netValue = netVal;
            
            deployedCost += cost;
            currentNetValue += netVal;

            if(!sectorMap[s.sector]) sectorMap[s.sector] = 0;
            sectorMap[s.sector] += netVal;
            
            const tName = s.ticker || `Set ${s.num}`;
            if(!tickerMap[tName]) tickerMap[tName] = 0;
            tickerMap[tName] += netVal;
        } else {
            s.totalCost = 0; s.netValue = 0;
        }
    });

    const unrealizedPnl = currentNetValue - deployedCost;
    const buyingPower = state.startingCapital + state.realizedPnl - deployedCost;
    const totalEquity = buyingPower + currentNetValue;

    document.getElementById('dash-equity').innerText = fmtPHPDash(totalEquity);
    document.getElementById('dash-bp').innerText = fmtPHPDash(buyingPower);
    document.getElementById('dash-bp').className = `text-2xl lg:text-3xl font-mono font-black leading-none truncate ${buyingPower < 0 ? 'text-red-500' : 'text-brand'}`;
    
    document.getElementById('dash-unrealized').innerText = `${unrealizedPnl >= 0 ? '+' : ''}${fmtPHPDash(unrealizedPnl)}`;
    document.getElementById('dash-unrealized').className = `text-2xl lg:text-3xl font-mono font-black leading-none truncate ${unrealizedPnl >= 0 ? 'text-brand' : 'text-red-500'}`;
    
    document.getElementById('dash-realized').innerText = `${state.realizedPnl >= 0 ? '+' : ''}${fmtPHPDash(state.realizedPnl)}`;
    document.getElementById('dash-realized').className = `text-2xl lg:text-3xl font-mono font-black leading-none truncate ${state.realizedPnl >= 0 ? 'text-brand' : 'text-red-500'}`;

    updateCharts(buyingPower, tickerMap, sectorMap, currentNetValue, totalEquity);
    renderHoldingsSummary();
    return { buyingPower, totalEquity }; 
}

function updateCharts(bp, tickerMap, sectorMap, deployedNetVal, totalEquity) {
    const isDark = document.documentElement.classList.contains('dark');
    
    const deployedPct = totalEquity > 0 ? ((totalEquity - Math.max(0, bp)) / totalEquity) * 100 : 0;
    document.getElementById('center-deployed-pct').innerText = `${deployedPct.toFixed(1)}%`;

    let capLabels = ['Cash'];
    let capData = [Math.max(0, bp)];
    let capColors = [isDark ? '#334155' : '#cbd5e1'];
    
    const bpPct = totalEquity > 0 ? (Math.max(0, bp) / totalEquity) * 100 : 0;
    let capLegendHTML = `
        <div class="flex justify-between items-center text-xs font-mono w-full">
            <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background-color: ${capColors[0]}"></div><span class="text-slate-700 dark:text-slate-300 font-bold">Cash</span></div>
            <span class="text-slate-500">${bpPct.toFixed(1)}% (${fmtPHP(capData[0])})</span>
        </div>`;

    let colorIdx = 0;
    Object.keys(tickerMap).forEach(t => {
        if(tickerMap[t] > 0) {
            capLabels.push(t); capData.push(tickerMap[t]);
            const c = themeHexColors[colorIdx % themeHexColors.length];
            capColors.push(c); colorIdx++;
            const tPct = totalEquity > 0 ? (tickerMap[t] / totalEquity) * 100 : 0;
            capLegendHTML += `
                <div class="flex justify-between items-center text-xs font-mono w-full mt-1.5">
                    <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background-color: ${c}"></div><span class="text-slate-700 dark:text-slate-300 font-bold truncate max-w-[80px]">${t}</span></div>
                    <span class="text-slate-500">${tPct.toFixed(1)}% (${fmtPHP(tickerMap[t])})</span>
                </div>`;
        }
    });
    document.getElementById('capital-legend').innerHTML = capLegendHTML;

    const ctxCap = document.getElementById('capitalChart');
    if(capChartObj) capChartObj.destroy();
    capChartObj = new Chart(ctxCap.getContext('2d'), {
        type: 'doughnut',
        data: { labels: capLabels, datasets: [{ data: capData, backgroundColor: capColors, borderWidth: 0, hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ₱${ctx.raw.toLocaleString()}` } } } }
    });

    let secLabels = []; let secData = []; let secColors = [];
    let secLegendHTML = '';
    colorIdx = 0;
    Object.keys(sectorMap).forEach(s => {
        if(sectorMap[s] > 0) {
            secLabels.push(s); secData.push(sectorMap[s]);
            const c = themeHexColors[colorIdx % themeHexColors.length];
            secColors.push(c); colorIdx++;
            const sPct = totalEquity > 0 ? (sectorMap[s] / totalEquity) * 100 : 0;
            secLegendHTML += `
                <div class="flex justify-between items-center text-xs font-mono w-full mt-1.5">
                    <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background-color: ${c}"></div><span class="text-slate-700 dark:text-slate-300 font-bold">${s}</span></div>
                    <span class="text-slate-500">${sPct.toFixed(1)}% (${fmtPHP(sectorMap[s])})</span>
                </div>`;
        }
    });
    
    if(secData.length === 0) {
        secLabels = ['No Data']; secData = [1]; secColors = [isDark ? '#1e293b' : '#f1f5f9'];
        secLegendHTML = '<span class="text-xs text-slate-500">No capital deployed.</span>';
    }
    
    document.getElementById('sector-legend').innerHTML = secLegendHTML;
    const ctxSec = document.getElementById('sectorChart');
    if(secChartObj) secChartObj.destroy();
    secChartObj = new Chart(ctxSec.getContext('2d'), {
        type: 'doughnut',
        data: { labels: secLabels, datasets: [{ data: secData, backgroundColor: secColors, borderWidth: 0, hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ctx.label === 'No Data' ? '' : ` ₱${ctx.raw.toLocaleString()}` } } } }
    });
}

function renderHoldingsSummary() {
    const tbody = document.getElementById('holdings-summary-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const activeHoldings = state.sets.filter(s => s.shares > 0);
    
    if(activeHoldings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500 text-xs font-sans uppercase tracking-widest">No Active Holdings</td></tr>`;
        return;
    }
    
    activeHoldings.forEach(s => {
        const cost = s.totalCost;
        const pnl = s.netValue - cost;
        const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
        const color = pnl >= 0 ? 'text-brand' : 'text-red-500';
        const sign = pnl >= 0 ? '+' : '';
        
        tbody.innerHTML += `
            <tr class="hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors">
                <td class="p-3">
                    <span class="font-bold text-slate-900 dark:text-white block">${s.ticker || `Set ${s.num}`}</span>
                    <span class="text-[9px] uppercase text-slate-500">${s.sector}</span>
                </td>
                <td class="p-3 text-right font-bold text-slate-700 dark:text-slate-300">${s.shares.toLocaleString()}</td>
                <td class="p-3 text-right text-slate-700 dark:text-slate-300">₱${s.computedAEP.toFixed(4)}</td>
                <td class="p-3 text-right font-bold ${color}">${sign}${pnlPct.toFixed(2)}%</td>
                <td class="p-3 text-right font-bold ${color}">${sign}${fmtPHP(pnl)}</td>
            </tr>
        `;
    });
}

// ==========================================
// 5. SET FORM BUILDER & LIVE LOGIC 
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

function buildSetForm() {
    const s = state.sets.find(x => x.id === state.activeSetId);
    if(!s) return;
    
    let secOptions = sectorsList.map(sec => `<option value="${sec}" ${s.sector === sec ? 'selected' : ''}>${sec}</option>`).join('');
    
    const tranchesHTML = (type, arr, label, color) => {
        let cfgs = type === '100' ? [{l:'100%', i:0}] : (type === '50-50' ? [{l:'50%', i:0},{l:'50%', i:1}] : [{l:'50%', i:0},{l:'30%', i:1},{l:'20%', i:2}]);
        return `<div class="grid gap-3 grid-cols-${cfgs.length}">
            ${cfgs.map(c => `
                <div>
                    <label class="block text-[9px] ${color} uppercase font-bold tracking-widest mb-1">${label} ${c.l}</label>
                    <div class="relative">
                        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs">₱</span>
                        <input type="number" step="any" class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-2 pl-6 font-mono text-sm text-slate-900 dark:text-white focus:ring-2 outline-none input-sync" data-key="${label.toLowerCase()}" data-idx="${c.i}" value="${arr[c.i] || ''}">
                    </div>
                </div>
            `).join('')}
        </div>`;
    };

    const imgBlockHTML = `
        <div class="w-full mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
            <label class="block text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">Technical Chart</label>
            <div id="paste-area" class="w-full aspect-video bg-white dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-brand transition-colors flex items-center justify-center relative overflow-hidden group shadow-inner">
                <div class="text-center placeholder-text pointer-events-none ${s.image ? 'hidden' : ''}" id="img-placeholder">
                    <svg class="w-10 h-10 text-slate-400 mx-auto mb-3 group-hover:text-brand transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <p class="text-base text-slate-500 font-bold">Paste <kbd class="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono text-sm">Ctrl+V</kbd> Image</p>
                </div>
                <img id="img-preview" class="${s.image ? '' : 'hidden'} absolute inset-0 w-full h-full object-contain p-1 cursor-zoom-in" alt="Chart" onclick="viewImage(this.src)" src="${s.image || ''}" />
                <button id="clear-img" onclick="clearImage(event)" class="${s.image ? '' : 'hidden'} absolute top-4 right-4 bg-red-600 hover:bg-red-500 text-white w-8 h-8 rounded text-sm font-bold z-10 shadow-lg">✕</button>
            </div>
        </div>`;

    const ticketHTML = `
        <div id="setup-warning" class="hidden w-full bg-red-600/90 text-white text-[10px] font-bold text-center py-1.5 uppercase tracking-widest rounded-lg mt-4 shadow-lg"></div>

        <div class="glass-panel p-4 lg:p-6 rounded-2xl flex flex-col gap-4 border-t-4 relative mt-2" id="ticket-box">
            <div class="flex justify-between items-end border-b border-slate-200 dark:border-slate-700/50 pb-3">
                <div class="flex flex-col">
                    <span class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Live PnL</span>
                    <span class="text-xl lg:text-2xl font-mono font-black text-slate-800 dark:text-white" id="t-pnl">₱0.00</span>
                </div>
                <div class="text-right flex flex-col">
                    <span class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Reward/Risk</span>
                    <span class="text-xl lg:text-2xl font-mono font-black text-slate-800 dark:text-white" id="t-rr">0.00 R</span>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div class="bg-slate-100 dark:bg-slate-900/60 p-4 rounded-lg border border-slate-200 dark:border-slate-700/50 flex flex-col justify-center">
                    <span class="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Est. Cost</span>
                    <span class="text-lg font-mono font-bold text-slate-800 dark:text-white truncate" id="t-cost">₱0.00</span>
                    <span class="text-[9px] text-slate-500 font-bold mt-1" id="t-pos-size">0.00% Pos Size</span>
                </div>
                <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-900/40 flex flex-col justify-center">
                    <span class="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Proj. Profit</span>
                    <span class="text-lg font-mono font-bold text-brand truncate" id="t-proj-profit">₱0.00</span>
                    <div class="flex justify-between w-full mt-1">
                        <span class="text-[9px] text-brand font-bold" id="t-proj-yield">+0.00% Yield</span>
                        <span class="text-[9px] text-brand font-bold" id="t-impact-win">+0.00% Acct</span>
                    </div>
                </div>
                <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-900/40 flex flex-col justify-center">
                    <span class="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Max Risk</span>
                    <span class="text-lg font-mono font-bold text-red-500 truncate" id="t-risk">₱0.00</span>
                    <div class="flex justify-between w-full mt-1">
                        <span class="text-[9px] text-red-500 font-bold" id="t-risk-yield">-0.00% Yield</span>
                        <span class="text-[9px] text-red-500 font-bold" id="t-impact-loss">-0.00% Acct</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    const html = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
                <label class="block text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Ticker</label>
                <input type="text" id="s-ticker" class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 font-mono uppercase text-lg font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand outline-none" value="${s.ticker}" oninput="updateSetData('ticker', this.value.toUpperCase(), true)">
            </div>
            <div>
                <label class="block text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Sector</label>
                <select id="s-sector" class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand outline-none" onchange="updateSetData('sector', this.value, true)">
                    ${secOptions}
                </select>
            </div>
            <div>
                <label class="block text-xs text-brand uppercase font-bold tracking-widest mb-1">VaR (Risk %)</label>
                <div class="relative">
                    <input type="number" step="0.1" class="w-full bg-white dark:bg-slate-900 border border-brand/50 rounded-lg p-2.5 pr-7 font-mono text-lg text-brand focus:ring-2 focus:ring-brand outline-none transition-all" value="${s.varPct}" oninput="updateSetData('varPct', this.value, true)">
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-sm">%</span>
                </div>
            </div>
            <div>
                <label class="block text-xs text-amber-500 uppercase font-bold tracking-widest mb-1">Max Pos %</label>
                <div class="relative">
                    <input type="number" step="1" max="100" class="w-full bg-white dark:bg-slate-900 border border-amber-500/50 rounded-lg p-2.5 pr-7 font-mono text-lg text-amber-500 focus:ring-2 focus:ring-amber-500 outline-none transition-all" value="${s.maxPosPct}" oninput="updateSetData('maxPosPct', this.value, true)">
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-sm">%</span>
                </div>
            </div>
        </div>

        <div class="h-px bg-slate-200 dark:bg-slate-700/50"></div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-slate-100/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-center mb-3">
                        <label class="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Entry</label>
                        <select class="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-[9px] font-bold text-slate-700 dark:text-slate-300 p-0.5 outline-none" onchange="updateSetData('trancheType', this.value, true); buildSetForm();">
                            <option value="100" ${s.trancheType==='100'?'selected':''}>100%</option><option value="50-50" ${s.trancheType==='50-50'?'selected':''}>50/50</option><option value="50-30-20" ${s.trancheType==='50-30-20'?'selected':''}>50/30/20</option>
                        </select>
                    </div>
                    ${tranchesHTML(s.trancheType, s.entries, 'Entry', 'text-slate-500')}
                </div>
                <div class="flex justify-between items-end mt-3 border-t border-slate-200 dark:border-slate-700/50 pt-2">
                    <span class="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Avg</span>
                    <div class="text-right">
                        <span class="block text-base font-mono font-black text-brand leading-none" id="s-aep">₱0.00</span>
                        <span class="block text-[9px] font-mono font-bold text-slate-400 mt-1">Lot: <span id="s-boardlot">0</span></span>
                    </div>
                </div>
            </div>

            <div class="bg-red-50/50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30 flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-center mb-3">
                        <label class="text-[10px] text-red-500 uppercase font-bold tracking-widest">Stop</label>
                        <select class="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded text-[9px] font-bold text-red-600 dark:text-red-400 p-0.5 outline-none" onchange="updateSetData('stopType', this.value, true); buildSetForm();">
                            <option value="100" ${s.stopType==='100'?'selected':''}>100%</option><option value="50-50" ${s.stopType==='50-50'?'selected':''}>50/50</option>
                        </select>
                    </div>
                    ${tranchesHTML(s.stopType, s.stopEntries, 'Stop', 'text-red-500/70')}
                </div>
                <div class="flex justify-between items-end mt-3 border-t border-red-200/50 dark:border-red-900/30 pt-2">
                    <span class="text-[9px] text-red-500/70 uppercase font-bold tracking-widest">Avg</span>
                    <div class="text-right">
                        <span class="block text-base font-mono font-black text-red-500 leading-none" id="s-astop">₱0.00</span>
                        <span class="block text-[9px] font-mono font-bold text-red-500/70 mt-1" id="s-stop-pct">0.00%</span>
                    </div>
                </div>
            </div>

            <div class="bg-green-50/50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30 flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-center mb-3">
                        <label class="text-[10px] text-brand uppercase font-bold tracking-widest">Target</label>
                        <select class="bg-white dark:bg-slate-900 border border-green-200 dark:border-green-900/50 rounded text-[9px] font-bold text-brand p-0.5 outline-none" onchange="updateSetData('targetType', this.value, false); buildSetForm();">
                            <option value="100" ${s.targetType==='100'?'selected':''}>100%</option><option value="50-50" ${s.targetType==='50-50'?'selected':''}>50/50</option>
                        </select>
                    </div>
                    ${tranchesHTML(s.targetType, s.targetEntries, 'Target', 'text-green-600/70')}
                </div>
                <div class="flex justify-between items-end mt-3 border-t border-green-200/50 dark:border-green-900/30 pt-2">
                    <span class="text-[9px] text-green-600/70 uppercase font-bold tracking-widest">Avg</span>
                    <div class="text-right">
                        <span class="block text-base font-mono font-black text-brand leading-none" id="s-atarget">₱0.00</span>
                        <span class="block text-[9px] font-mono font-bold text-brand/70 mt-1" id="s-target-pct">0.00%</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mt-2">
            <div class="relative">
                <label class="block text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Shares</label>
                <input type="text" id="s-shares" class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-xl font-mono font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-brand outline-none transition-all" value="${s.shares || ''}" oninput="manualShareInput(this)">
                <p id="s-bl-warning" class="absolute -bottom-4 left-0 text-[9px] text-amber-500 font-bold hidden">Invalid Board Lot!</p>
                <p id="s-bp-warning" class="absolute -bottom-4 left-0 text-[9px] text-red-500 font-bold hidden uppercase">🚨 Margin Deficit</p>
            </div>
            <div>
                <label class="block text-xs text-blue-500 uppercase font-bold tracking-widest mb-1">Current Mkt Price</label>
                <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/50 font-mono font-bold">₱</span>
                    <input type="number" step="any" id="s-current" class="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 rounded-lg p-3 pl-8 text-xl font-mono font-black text-blue-600 dark:text-blue-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all" value="${s.currentPrice || ''}" oninput="updateSetData('currentPrice', this.value, false)">
                </div>
            </div>
        </div>

        ${ticketHTML}

        <div class="flex gap-3 mt-2">
            <button onclick="copyTicket()" class="w-1/3 py-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl font-bold uppercase tracking-widest text-xs transition flex items-center justify-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> Copy</button>
            <button onclick="openSellModal()" id="btn-sell" class="w-2/3 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-lg transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">⚡ Tactical Exit</button>
        </div>

        ${imgBlockHTML}
    `;
    document.getElementById('set-container').innerHTML = html;
    
    document.querySelectorAll('.input-sync').forEach(el => {
        el.addEventListener('input', (e) => {
            const key = e.target.getAttribute('data-key');
            const idx = parseInt(e.target.getAttribute('data-idx'));
            const val = parseFloat(e.target.value) || 0;
            const s = state.sets.find(x => x.id === state.activeSetId);
            
            if(key === 'entry') s.entries[idx] = val;
            if(key === 'stop') s.stopEntries[idx] = val;
            if(key === 'target') s.targetEntries[idx] = val;
            
            const shouldAutoSize = (key === 'entry' || key === 'stop');
            calcSet(shouldAutoSize);
        });
    });
    
    calcSet(false);
}

window.addEventListener('paste', e => {
    if(document.getElementById('view-allocator').classList.contains('hidden')) return;
    if(e.clipboardData.files.length > 0 && e.clipboardData.files[0].type.startsWith('image/')) { 
        const reader = new FileReader(); 
        reader.onload = (ev) => { 
            const s = state.sets.find(w => w.id === state.activeSetId);
            if(s) { s.image = ev.target.result; buildSetForm(); }
        }; 
        reader.readAsDataURL(e.clipboardData.files[0]); 
    }
});

function clearImage(e) { 
    e.stopPropagation(); 
    const s = state.sets.find(w => w.id === state.activeSetId);
    if(s) { s.image = null; buildSetForm(); }
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

function updateSetData(key, val, shouldAutoSize) {
    const s = state.sets.find(x => x.id === state.activeSetId);
    s[key] = (key === 'ticker' || key === 'sector' || key === 'trancheType' || key === 'stopType' || key === 'targetType') ? val : (parseFloat(val) || 0);
    if (key === 'ticker') renderTabs();
    if (key === 'varPct' && s.varPct < 0) s.varPct = 0;
    if (key === 'maxPosPct' && s.maxPosPct > 100) s.maxPosPct = 100;
    calcSet(shouldAutoSize);
}

function manualShareInput(el) {
    let val = el.value.replace(/,/g, '').replace(/\D/g, ''); 
    const num = parseInt(val) || 0;
    const s = state.sets.find(x => x.id === state.activeSetId);
    
    if(num > 0 && s.shares === 0 && s.computedAEP > 0 && s.currentPrice === 0) {
        s.currentPrice = s.computedAEP;
        const cpEl = document.getElementById('s-current');
        if(cpEl) cpEl.value = s.computedAEP;
    }
    
    s.shares = num;
    el.value = num ? num.toLocaleString() : '';
    calcSet(false);
}

function calcSet(attemptAutoSize = false) {
    const s = state.sets.find(x => x.id === state.activeSetId);
    
    const avg = (type, arr) => {
        let v = 0;
        if(type==='100') v = arr[0];
        else if(type==='50-50') v = (arr[0]*0.5)+(arr[1]*0.5);
        else if(type==='50-30-20') v = (arr[0]*0.5)+(arr[1]*0.3)+(arr[2]*0.2);
        return v || 0;
    };
    
    s.computedAEP = avg(s.trancheType, s.entries);
    s.computedStop = avg(s.stopType, s.stopEntries);
    s.computedTarget = avg(s.targetType, s.targetEntries);
    
    document.getElementById('s-aep').innerText = `₱${s.computedAEP.toFixed(2)}`;
    document.getElementById('s-astop').innerText = `₱${s.computedStop.toFixed(2)}`;
    document.getElementById('s-atarget').innerText = `₱${s.computedTarget.toFixed(2)}`;

    if (s.computedAEP > 0) {
        const costPS = s.computedAEP * (1 + FEES.buy);
        if (s.computedStop > 0) {
            const stopPS = s.computedStop * (1 - FEES.sell);
            const stopPct = ((stopPS - costPS) / costPS) * 100;
            document.getElementById('s-stop-pct').innerText = `${stopPct.toFixed(2)}%`;
        } else { document.getElementById('s-stop-pct').innerText = `0.00%`; }
        
        if (s.computedTarget > 0) {
            const targetPS = s.computedTarget * (1 - FEES.sell);
            const targetPct = ((targetPS - costPS) / costPS) * 100;
            document.getElementById('s-target-pct').innerText = `+${targetPct.toFixed(2)}%`;
        } else { document.getElementById('s-target-pct').innerText = `0.00%`; }
    } else {
        document.getElementById('s-stop-pct').innerText = `0.00%`;
        document.getElementById('s-target-pct').innerText = `0.00%`;
    }
    
    const bl = getBoardLot(s.computedAEP || 0);
    document.getElementById('s-boardlot').innerText = bl.toLocaleString();

    const warnBanner = document.getElementById('setup-warning');
    let isValidSetup = true;

    if (s.computedAEP > 0) {
        if (s.computedStop > 0 && s.computedStop >= s.computedAEP) {
            warnBanner.innerText = "🚨 INVALID SETUP: Stop Loss must be below Entry.";
            warnBanner.classList.remove('hidden');
            isValidSetup = false;
        } else if (s.computedTarget > 0 && s.computedTarget <= s.computedAEP) {
            warnBanner.innerText = "🚨 INVALID SETUP: Target must be above Entry.";
            warnBanner.classList.remove('hidden');
            isValidSetup = false;
        } else {
            warnBanner.classList.add('hidden');
        }
    } else {
        warnBanner.classList.add('hidden');
    }

    const { buyingPower, totalEquity } = runEngine();
    const blWarnEl = document.getElementById('s-bl-warning');
    const bpWarnEl = document.getElementById('s-bp-warning');
    
    blWarnEl.classList.add('hidden');
    bpWarnEl.classList.add('hidden');

    if (attemptAutoSize && isValidSetup && s.computedAEP > 0 && s.computedStop > 0 && s.ticker) {
        const localBuyingPower = buyingPower + (s.shares * s.computedAEP * (1 + FEES.buy));
        const riskBudget = totalEquity * ((s.varPct || 0) / 100);
        const capBudget = totalEquity * ((s.maxPosPct || 100) / 100);
        const costPerShare = s.computedAEP * (1 + FEES.buy);
        const netStopPerShare = s.computedStop * (1 - FEES.sell);
        const trueRiskPerShare = costPerShare - netStopPerShare;

        const idealSharesVaR = trueRiskPerShare > 0 ? Math.floor(riskBudget / trueRiskPerShare) : 0;
        const idealSharesCap = costPerShare > 0 ? Math.floor(capBudget / costPerShare) : 0;
        const maxSharesBP = costPerShare > 0 ? Math.floor(Math.max(0, localBuyingPower) / costPerShare) : 0;

        let rawShares = Math.min(idealSharesVaR, idealSharesCap, maxSharesBP);
        rawShares = Math.max(0, rawShares);
        s.shares = Math.floor(rawShares / bl) * bl;
        
        document.getElementById('s-shares').value = s.shares ? s.shares.toLocaleString() : '';
        
        if(s.shares > 0 && s.currentPrice === 0) {
            s.currentPrice = s.computedAEP;
            document.getElementById('s-current').value = s.computedAEP;
        }
        runEngine();
    } else if (!isValidSetup && attemptAutoSize) {
        s.shares = 0;
        document.getElementById('s-shares').value = '';
        runEngine();
    }

    if (s.shares > 0) {
        if (s.shares % bl !== 0) blWarnEl.classList.remove('hidden');
        if (runEngine().buyingPower < 0) bpWarnEl.classList.remove('hidden');
    }

    const costPerShare = s.computedAEP * (1 + FEES.buy);
    const stopNetPerShare = s.computedStop * (1 - FEES.sell);
    const targetNetPerShare = s.computedTarget * (1 - FEES.sell);
    
    const cost = isValidSetup ? s.shares * costPerShare : 0;
    const rawMkt = s.currentPrice || s.computedAEP;
    const netVal = (s.shares * rawMkt) * (1 - FEES.sell);
    const pnl = isValidSetup && s.shares > 0 ? netVal - cost : 0;
    
    const trueRiskPerShare = costPerShare > 0 && stopNetPerShare > 0 ? costPerShare - stopNetPerShare : 0;
    const maxRisk = isValidSetup ? s.shares * trueRiskPerShare : 0;
    const impactLoss = totalEquity > 0 ? (maxRisk / totalEquity) * 100 : 0;
    const riskYield = costPerShare > 0 ? (trueRiskPerShare / costPerShare) * 100 : 0;

    const trueProfitPerShare = targetNetPerShare > 0 ? targetNetPerShare - costPerShare : 0;
    const projProfit = isValidSetup ? s.shares * trueProfitPerShare : 0;
    const impactWin = totalEquity > 0 ? (projProfit / totalEquity) * 100 : 0;
    const profitYield = costPerShare > 0 ? (trueProfitPerShare / costPerShare) * 100 : 0;

    const rr = isValidSetup && trueRiskPerShare > 0 && trueProfitPerShare > 0 ? trueProfitPerShare / trueRiskPerShare : 0;
    const actualPosPct = isValidSetup && totalEquity > 0 ? (cost / totalEquity) * 100 : 0;

    if(isValidSetup) {
        document.getElementById('t-cost').innerText = fmtPHP(cost);
        document.getElementById('t-pos-size').innerText = `${actualPosPct.toFixed(2)}% Pos Size`;
        document.getElementById('t-proj-profit').innerText = fmtPHP(projProfit);
        document.getElementById('t-proj-yield').innerText = `+${profitYield.toFixed(2)}% Yield`;
        document.getElementById('t-impact-win').innerText = `+${impactWin.toFixed(2)}% Acct Impact`;
        document.getElementById('t-risk').innerText = fmtPHP(maxRisk);
        document.getElementById('t-risk-yield').innerText = `-${riskYield.toFixed(2)}% Yield`;
        document.getElementById('t-impact-loss').innerText = `-${impactLoss.toFixed(2)}% Acct Impact`;
        document.getElementById('t-rr').innerText = `${rr.toFixed(2)} R`;
        document.getElementById('t-pnl').innerText = `${pnl >= 0 ? '+' : ''}${fmtPHP(pnl)}`;
        document.getElementById('t-pnl').className = `text-xl lg:text-2xl font-mono font-black ${pnl >= 0 ? 'text-brand' : 'text-red-500'}`;
    } else {
        document.getElementById('t-cost').innerText = '₱0.00';
        document.getElementById('t-pos-size').innerText = `0.00% Pos Size`;
        document.getElementById('t-proj-profit').innerText = '₱0.00';
        document.getElementById('t-proj-yield').innerText = `+0.00% Yield`;
        document.getElementById('t-impact-win').innerText = `+0.00% Acct Impact`;
        document.getElementById('t-risk').innerText = '₱0.00';
        document.getElementById('t-risk-yield').innerText = `-0.00% Yield`;
        document.getElementById('t-impact-loss').innerText = `-0.00% Acct Impact`;
        document.getElementById('t-rr').innerText = `0.00 R`;
        document.getElementById('t-pnl').innerText = `₱0.00`;
        document.getElementById('t-pnl').className = `text-xl lg:text-2xl font-mono font-black text-slate-800 dark:text-white`;
    }
    
    document.getElementById('btn-sell').disabled = s.shares <= 0 || !isValidSetup;
    
    const box = document.getElementById('ticket-box');
    if(!isValidSetup) {
        box.className = `glass-panel p-4 lg:p-6 rounded-2xl flex flex-col gap-4 border-t-4 relative mt-2 border-t-red-500 opacity-50`;
    } else {
        box.className = `glass-panel p-4 lg:p-6 rounded-2xl flex flex-col gap-4 border-t-4 relative mt-2 ${pnl >= 0 ? (s.shares>0 ? 'border-t-brand bg-green-50/10 dark:bg-green-900/10' : 'border-t-slate-400') : 'border-t-red-500 bg-red-50/10 dark:bg-red-900/10'}`;
    }
}

function openSellModal() { 
    const s = state.sets.find(x => x.id === state.activeSetId); 
    if(!s || s.shares <= 0) return;

    document.getElementById('sell-ticker-badge').innerText = s.ticker || `Set ${s.num}`;
    document.getElementById('sell-total-shares').innerText = `Active Shares: ${s.shares.toLocaleString()}`;
    document.getElementById('sell-shares').value = s.shares;
    document.getElementById('sell-price').value = s.currentPrice || s.computedAEP; 
    
    calcSellPreview();

    const modal = document.getElementById('sell-modal'); 
    const content = document.getElementById('sell-content'); 
    modal.classList.remove('hidden'); 
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        content.classList.remove('scale-95'); 
    }, 10); 
}

function setSellShares(pct) {
    const s = state.sets.find(x => x.id === state.activeSetId);
    if(!s) return;
    if(pct === 1.0) {
        document.getElementById('sell-shares').value = s.shares;
    } else {
        const currentPrice = parseFloat(document.getElementById('sell-price').value) || s.currentPrice || s.computedAEP;
        const bl = getBoardLot(currentPrice);
        let shares = Math.floor((s.shares * pct) / bl) * bl;
        if(shares <= 0 && s.shares > 0) shares = s.shares; 
        document.getElementById('sell-shares').value = shares;
    }
    calcSellPreview();
}

function calcSellPreview() {
    const s = state.sets.find(x => x.id === state.activeSetId);
    if(!s) return;
    const shares = parseInt(document.getElementById('sell-shares').value) || 0;
    const price = parseFloat(document.getElementById('sell-price').value) || 0;
    
    if(shares > 0 && price > 0) {
        const cost = shares * s.computedAEP * (1 + FEES.buy);
        const netVal = shares * price * (1 - FEES.sell);
        const pnl = netVal - cost;
        const pnlEl = document.getElementById('sell-preview-pnl');
        pnlEl.innerText = `${pnl >= 0 ? '+' : ''}${fmtPHP(pnl)}`;
        pnlEl.className = `text-xl font-mono font-black ${pnl >= 0 ? 'text-brand' : 'text-red-500'}`;
    } else {
        document.getElementById('sell-preview-pnl').innerText = `₱0.00`;
        document.getElementById('sell-preview-pnl').className = `text-xl font-mono font-black text-slate-800 dark:text-white`;
    }
}

function closeSellModal() { 
    const modal = document.getElementById('sell-modal'); 
    const content = document.getElementById('sell-content'); 
    modal.classList.add('opacity-0'); 
    content.classList.add('scale-95'); 
    setTimeout(() => modal.classList.add('hidden'), 300); 
}

function confirmSell() {
    saveSnapshot();
    const s = state.sets.find(x => x.id === state.activeSetId);
    if(!s) return;
    
    const sharesToSell = parseInt(document.getElementById('sell-shares').value) || 0;
    const execPrice = parseFloat(document.getElementById('sell-price').value) || 0;
    
    if(sharesToSell <= 0 || sharesToSell > s.shares) return alert(`Invalid shares. Must be between 1 and ${s.shares}.`);
    if(execPrice <= 0) return alert("Invalid execution price.");

    const cost = sharesToSell * s.computedAEP * (1 + FEES.buy);
    const netVal = sharesToSell * execPrice * (1 - FEES.sell);
    const pnl = netVal - cost;
    
    state.realizedPnl += pnl;
    
    if(sharesToSell >= s.shares) {
        s.ticker = ''; s.shares = 0; s.currentPrice = 0;
        s.entries = [0,0,0]; s.stopEntries = [0,0]; s.targetEntries = [0,0];
        s.image = null; 
    } else {
        s.shares -= sharesToSell;
        s.currentPrice = execPrice;
    }
    
    closeSellModal();
    runEngine();
    renderTabs();
    buildSetForm();
    
    const btn = document.getElementById('btn-sell');
    if(btn) {
        const orig = btn.innerText;
        btn.innerText = "✓ REALIZED";
        btn.classList.add('bg-brand'); btn.classList.remove('bg-red-600', 'hover:bg-red-500');
        setTimeout(() => { 
            btn.innerText = orig; 
            btn.classList.remove('bg-brand'); btn.classList.add('bg-red-600', 'hover:bg-red-500');
        }, 1000);
    }
}

function copyTicket() {
    const s = state.sets.find(x => x.id === state.activeSetId);
    if(!s || !s.ticker) return alert("Enter a ticker to copy.");
    if(s.computedStop >= s.computedAEP || s.computedTarget <= s.computedAEP) return alert("Cannot copy an invalid setup.");
    
    const costPerShare = s.computedAEP * (1 + FEES.buy);
    const stopNetPerShare = s.computedStop * (1 - FEES.sell);
    const targetNetPerShare = s.computedTarget * (1 - FEES.sell);
    const cost = s.shares * costPerShare;
    
    const trueRiskPerShare = costPerShare > 0 && stopNetPerShare > 0 ? costPerShare - stopNetPerShare : 0;
    const maxRisk = s.shares > 0 ? s.shares * trueRiskPerShare : 0;
    const trueProfitPerShare = targetNetPerShare > 0 ? targetNetPerShare - costPerShare : 0;
    const projProfit = s.shares > 0 ? s.shares * trueProfitPerShare : 0;
    
    const { totalEquity } = runEngine();
    const impactLoss = totalEquity > 0 ? (maxRisk / totalEquity) * 100 : 0;
    const impactWin = totalEquity > 0 ? (projProfit / totalEquity) * 100 : 0;
    const rr = trueRiskPerShare > 0 && trueProfitPerShare > 0 ? trueProfitPerShare / trueRiskPerShare : 0;

    const text = `[${s.ticker}] Sector: ${s.sector}
Entry: ₱${s.computedAEP.toFixed(2)} | Stop: ₱${s.computedStop.toFixed(2)} | Target: ₱${s.computedTarget.toFixed(2)}
Size: ${s.shares.toLocaleString()} Shares (₱${cost.toLocaleString('en-US', {maximumFractionDigits:0})} Cost)
Max Risk: ₱${maxRisk.toLocaleString('en-US', {maximumFractionDigits:0})} (-${impactLoss.toFixed(2)}% Acct)
Proj. Reward: ₱${projProfit.toLocaleString('en-US', {maximumFractionDigits:0})} (+${impactWin.toFixed(2)}% Acct)
R:R: ${rr.toFixed(2)}`;

    navigator.clipboard.writeText(text).then(() => alert("Ticket Copied!"));
}

window.onload = () => {
    if(state.startingCapital === 0) {
        document.getElementById('init-modal').classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    } else {
        runEngine();
        renderTabs();
        if(state.sets.length>0) buildSetForm();
    }
};

function loadData(event) {
    const file = event.target.files[0]; 
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { 
        try { 
            state = JSON.parse(e.target.result); 
            document.getElementById('init-modal').classList.add('hidden');
            runEngine(); renderTabs(); buildSetForm(); switchView('dashboard');
        } catch(err) { alert("Invalid save file."); } 
    };
    reader.readAsText(file);
}

// V1.8 Modification: Replaced file download with Firebase push
async function saveData() { 
    if (!currentUser) return;
    try {
        await setDoc(doc(db, 'users', currentUser.uid), { strikePlannerState: state }, { merge: true });
        console.log("State silently pushed to Firestore.");
    } catch(e) {
        console.error("Error saving data:", e);
    }
}

// Since this is a module, expose needed functions to window so HTML inline handlers (onclick) still work
window.startApp = startApp;
window.executeNuclearReset = executeNuclearReset;
window.hideResetModal = hideResetModal;
window.closeImage = closeImage;
window.setSellShares = setSellShares;
window.calcSellPreview = calcSellPreview;
window.closeSellModal = closeSellModal;
window.confirmSell = confirmSell;
window.switchView = switchView;
window.undoAction = undoAction;
window.saveData = saveData;
window.loadData = loadData;
window.formatNumberInput = formatNumberInput;
window.openResetModal = openResetModal;
window.handleImageUpload = handleImageUpload;
window.clearImage = clearImage;
window.viewImage = viewImage;
window.updateSetData = updateSetData;
window.manualShareInput = manualShareInput;
window.copyTicket = copyTicket;
window.openSellModal = openSellModal;
