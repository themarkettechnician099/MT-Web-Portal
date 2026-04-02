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

// Unique Database Key for the Dividend Portfolio Sandbox
const DB_KEY = "dividendSandboxState";
let currentUser = null;

// ==========================================
// 1.5 PSYCHOLOGICAL LOADER INIT
// ==========================================
// Kick off the loading bar immediately to 92%
setTimeout(() => {
    const bar = document.getElementById('loading-progress');
    if (bar) bar.style.width = '92%';
}, 50);

// ==========================================
// 2. AUTH STATE OBSERVER (THE GATEKEEPER)
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadCloudProfile();
    } else {
        // Immediately redirect unauthorized users back to the master login page
        window.location.href = '../index.html';
    }
});

// ==========================================
// 2.5 INDESTRUCTIBLE HEALER
// ==========================================
function healSandboxState(state) {
    const enforceArray = (data, defaultFactory = null) => {
        if (!data) return defaultFactory ? Array.from({ length: 3 }, defaultFactory) : [];
        if (Array.isArray(data)) return data.filter(item => item !== null && item !== undefined);
        if (typeof data === 'object') return Object.values(data).filter(item => item !== null && item !== undefined);
        return defaultFactory ? Array.from({ length: 3 }, defaultFactory) : [];
    };

    const defaultTrade = () => ({ ticker: '', sector: 'Property', dps: 0, schedule: [], curShares: 0, curCost: 0, mktPrice: 0, action: 'HOLD', actShares: 0, actPrice: 0 });

    AppState.brokerCash = state.brokerCash || 0;
    AppState.isDrip = state.isDrip !== undefined ? state.isDrip : true;
    
    // Heal sparse arrays and apply fallbacks
    let healedTrades = enforceArray(state.trades);
    if (healedTrades.length === 0) healedTrades = Array.from({ length: 3 }, defaultTrade);
    
    AppState.trades = healedTrades;
    AppState.tradeLog = enforceArray(state.tradeLog);
    AppState.fundingLog = enforceArray(state.fundingLog);
    
    AppState.undoStack = [];
}

// ==========================================
// 3. CLOUD DATA HANDLING
// ==========================================
async function loadCloudProfile() {
    try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        let isReturningUser = false;

        if (docSnap.exists()) {
            const cloudData = docSnap.data();
            
            // Check if this specific app has saved data
            if (cloudData && cloudData[DB_KEY]) {
                healSandboxState(cloudData[DB_KEY]);
                
                // If they have funding history or existing cash, they are an active user
                if (AppState.fundingLog.length > 0 || AppState.brokerCash > 0) {
                    isReturningUser = true;
                }
            }
        }
        
        if (isReturningUser) {
            document.getElementById('btn-undo-desk').classList.add('hidden'); 
            document.getElementById('btn-undo-desk').classList.remove('flex');
            document.getElementById('btn-undo-mob').classList.add('hidden'); 
            document.getElementById('btn-undo-mob').classList.remove('flex');
            
            // Render the UI with loaded data
            renderTabs(); 
            switchTab(0); 
            window.switchMainView('dashboard'); 
            masterSync();

            // Ensure modal is hidden
            const modal = document.getElementById('welcome-modal');
            if(modal && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        } else {
            // New User: Leave the modal open and active for Initial Capital input
            console.log("No active ledger found. Awaiting Initial Funding.");
            const modal = document.getElementById('welcome-modal');
            if(modal) {
                modal.classList.remove('hidden', 'pointer-events-none');
                setTimeout(() => modal.classList.remove('opacity-0'), 10);
            }
        }

    } catch (error) {
        console.error("Error loading cloud profile:", error);
    } finally {
        // Resolve Psychological Loading Screen
        const loadBar = document.getElementById('loading-progress');
        const loadScreen = document.getElementById('loading-screen');
        
        if (loadBar) loadBar.style.width = '100%';
        
        setTimeout(() => {
            if (loadScreen) {
                loadScreen.classList.add('opacity-0');
                setTimeout(() => loadScreen.classList.add('hidden'), 300);
            }
        }, 500);
    }
}

async function saveData() {
    if (!currentUser) return;
    
    // Bundle the current app state
    const appState = {
        brokerCash: AppState.brokerCash,
        trades: AppState.trades,
        tradeLog: AppState.tradeLog,
        fundingLog: AppState.fundingLog,
        isDrip: AppState.isDrip
    };
    
    try {
        // Silently push to Firestore using merge: true to protect other SaaS modules
        await setDoc(doc(db, "users", currentUser.uid), {
            [DB_KEY]: appState
        }, { merge: true });
    } catch (error) {
        console.error("Error silently saving data:", error);
    }
}

// Auto-save debounce logic to prevent spamming Firestore writes
let saveTimeout;
function triggerAutoSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveData();
    }, 1500); // Waits 1.5s after the last action before firing the save
}


/**
 * MT DIVIDEND PORTFOLIO SANDBOX - V2.4 LOGIC ENGINE
 * Architecture: Model-View-Controller (MVC) Prepared for Backend
 */

// ==========================================
// 0. GLOBAL STATE & CONSTANTS
// ==========================================
const BUY_FEE = 0.00295;
const SELL_FEE = 0.00395;
const DIV_TAX = 0.10;

const themeColorsHex = ['#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#6366f1'];
const sectorColors = { 'Financial': '#3b82f6', 'Utilities': '#06b6d4', 'Energy': '#64748b', 'Property': '#8b5cf6', 'Properties': '#8b5cf6', 'Holdings': '#f59e0b', 'Consumer': '#f43f5e', 'Telco': '#10b981', 'Mining': '#ec4899', 'Others': '#ef4444' };
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let AppState = {
    activeTab: 0,
    brokerCash: 0,
    tradeLog: [],
    fundingLog: [],
    undoStack: [],
    isCalendarFuture: false,
    isDrip: true, 
    trades: Array.from({ length: 3 }, () => ({
        ticker: '', sector: 'Property', dps: 0, schedule: [],
        curShares: 0, curCost: 0, mktPrice: 0,
        action: 'HOLD', actShares: 0, actPrice: 0
    }))
};

let latestEngineResult = null;
let latestProjectionResult = null;
let myChart = null;

// ==========================================
// 1. THE MATHEMATICIAN (PURE MATH BACKEND)
// ==========================================
const MathEngine = {
    analyzePortfolio: function(cash, tradesList, tradeLog) {
        let projCash = cash;
        let globalAssetsCost = 0, globalNetAssets = 0, globalAnnDiv = 0, totalUnrealizedPnL = 0, totalGrossDivs = 0;
        const sectorTotals = {}; const portTotals = []; 

        const processedTrades = tradesList.map((t, index) => {
            let processed = { ...t, locked: null, actionFlow: 0 };
            let netShares = t.curShares; let netAvgCost = t.curCost;

            if (t.action === 'BUY' && t.actShares > 0 && t.actPrice > 0) {
                const totalBuyCost = t.actShares * t.actPrice * (1 + BUY_FEE);
                if (totalBuyCost > projCash) { processed.locked = 'FUNDS'; netShares = t.curShares; netAvgCost = t.curCost; } 
                else {
                    processed.actionFlow = -totalBuyCost; projCash -= totalBuyCost;
                    const existingValue = t.curShares * t.curCost;
                    netShares = t.curShares + t.actShares;
                    netAvgCost = (existingValue + totalBuyCost) / netShares; 
                }
            } 
            else if (t.action === 'SELL' && t.actShares > 0 && t.actPrice > 0) {
                if (t.actShares > t.curShares) { processed.locked = 'SHARES'; netShares = t.curShares; netAvgCost = t.curCost; } 
                else {
                    const proceeds = t.actShares * t.actPrice * (1 - SELL_FEE);
                    processed.actionFlow = proceeds; projCash += proceeds;
                    netShares = t.curShares - t.actShares;
                    if (netShares === 0) netAvgCost = 0; 
                }
            }

            processed.projShares = netShares; 
            processed.projAvgCost = netAvgCost; 
            processed.totalDeployed = processed.projShares * processed.projAvgCost; 
            processed.grossYOC = processed.projAvgCost > 0 ? (t.dps / processed.projAvgCost) * 100 : 0;
            processed.annNetDiv = (processed.projShares * t.dps) * (1 - DIV_TAX); 

            const holdCost = t.curShares * t.curCost;
            const rawMktPrice = t.mktPrice > 0 ? t.mktPrice : t.curCost;
            const grossHoldMkt = t.curShares * rawMktPrice;
            const netHoldMkt = grossHoldMkt > 0 ? grossHoldMkt * (1 - SELL_FEE) : 0; 
            
            let unPnL = 0; if (t.curShares > 0) unPnL = netHoldMkt - holdCost;
            
            processed.netHoldMkt = netHoldMkt;
            processed.unPnL = unPnL;
            processed.holdCost = holdCost;
            
            globalAssetsCost += holdCost; globalNetAssets += netHoldMkt; 
            totalUnrealizedPnL += unPnL; globalAnnDiv += processed.annNetDiv; 
            totalGrossDivs += (t.curShares * t.dps);
            
            if (netHoldMkt > 0) {
                if (sectorTotals[t.sector] === undefined) sectorTotals[t.sector] = 0;
                sectorTotals[t.sector] += netHoldMkt;
                const colorIdx = index % themeColorsHex.length;
                portTotals.push({ ticker: t.ticker || `Set ${index+1}`, val: netHoldMkt, hexColor: themeColorsHex[colorIdx] });
            }
            return processed;
        });

        const avgGrossYield = globalAssetsCost > 0 ? (totalGrossDivs / globalAssetsCost) : 0.0;
        const totalRealizedGain = tradeLog.reduce((sum, log) => sum + (log.realizedPnL || 0), 0);

        return {
            processedTrades, sectorTotals, portTotals,
            globalMetrics: {
                totalEquity: cash + globalNetAssets,
                deployedCap: globalNetAssets,
                cash: cash,
                totalUnrealizedPnL,
                totalRealizedGain,
                globalAssetsCost,
                annDiv: globalAnnDiv,
                avgGrossYield,
                avgNetYield: avgGrossYield * (1 - DIV_TAX)
            }
        };
    },

    projectWealth: function(inputs, portfolioMetrics) {
        const { a1, a2, a3, plannedPmt, freq, g, desiredInc, isDrip } = inputs;
        const v_deployed = portfolioMetrics.deployedCap || 0;
        const v_cash = portfolioMetrics.cash || 0;
        const v0 = v_deployed + v_cash;
        const netYield = portfolioMetrics.avgNetYield || 0;

        const targetFund = netYield > 0 ? (desiredInc * 12) / netYield : 0;
        const yearsTopup = a2 - a1; const yearsCoast = a3 - a2; const yearsTotal = a3 - a1;
        
        const totalRate = isDrip ? (netYield + g) : g; 
        const moRate = Math.pow(1 + totalRate, 1/12) - 1;
        const annualContrib = plannedPmt * freq;

        let reqPmt = 0; let isCoastFire = false; let shortfall = 0;

        if (yearsTotal > 0 && totalRate > 0) {
            const fvDeployedBase = v_deployed * Math.pow(1 + totalRate, yearsTotal);
            shortfall = targetFund - fvDeployedBase;
            if (shortfall <= 0) {
                isCoastFire = true; reqPmt = 0;
            } else if (yearsTopup > 0) {
                reqPmt = ((shortfall / Math.pow(1 + totalRate, yearsCoast)) * moRate) / (Math.pow(1 + moRate, yearsTopup * 12) - 1);
            } else {
                reqPmt = Infinity; 
            }
        }

        let labels = [], dataValue = [], dataInvested = [];
        let shares = v_deployed / 1.0; let price = 1.0; let totalInvested = v0;
        let accumulatedCash = v_cash;

        for (let t = 0; t <= yearsTotal; t++) {
            labels.push('Age ' + (a1 + t));
            if (t === 0) { 
                dataValue.push(v0); dataInvested.push(totalInvested); 
            } else {
                price *= (1 + g);
                if (t <= yearsTopup) { 
                    shares += (annualContrib / price); totalInvested += annualContrib; 
                }
                
                let dividend = (shares * price) * netYield; 
                if (isDrip) {
                    shares += (dividend / price);
                } else {
                    accumulatedCash += dividend;
                }
                
                dataValue.push(accumulatedCash + (shares * price)); 
                dataInvested.push(totalInvested);
            }
        }

        const projectedFinalDeployed = shares * price;
        const projectedFinalTotal = accumulatedCash + projectedFinalDeployed;
        const projectedIncome = (projectedFinalDeployed * netYield) / 12;

        return { targetFund, reqPmt, isCoastFire, shortfall, projectedFinalTotal, projectedFinalDeployed, projectedIncome, totalInvested, chartData: { labels, dataValue, dataInvested } };
    },

    generateCalendar: function(tradesList, isFuture, targetAnnTotal) {
        let monthlyData = Array.from({length: 12}, () => ({ total: 0, sources: [] }));
        let hasUnscheduled = false; let currentAnnDiv = 0;

        tradesList.forEach(t => {
            if(t.curShares <= 0 || t.dps <= 0) return;
            const annDiv = (t.curShares * t.dps) * (1 - DIV_TAX);
            currentAnnDiv += annDiv;
            
            let monthsArray = t.schedule || [];
            if(monthsArray.length === 0) { hasUnscheduled = true; return; }
            
            const divPerPayout = annDiv / monthsArray.length;
            monthsArray.forEach(m => {
                monthlyData[m - 1].total += divPerPayout;
                monthlyData[m - 1].sources.push({ ticker: t.ticker, val: divPerPayout });
            });
        });

        if (isFuture) {
            monthlyData.forEach(m => {
                const weight = currentAnnDiv > 0 ? (m.total / currentAnnDiv) : (1/12);
                m.total = targetAnnTotal * weight;
                if (m.total > 0) m.sources = [{ ticker: 'Projected Portfolio', val: m.total }];
                else m.sources = [];
            });
            hasUnscheduled = false;
        }

        return { monthlyData, hasUnscheduled };
    }
};

// ==========================================
// 2. THE DUMB PAINTER (UI UPDATERS)
// ==========================================
const Utils = {
    parseNum: (str) => parseFloat(String(str).replace(/,/g, '')) || 0,
    formatPHP: (num) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0),
    formatDec: (num) => num ? num.toLocaleString('en-US', {maximumFractionDigits: 4}) : '',
    executeWithLoader: (action, isOrderExecution = false) => {
        const loader = document.getElementById('global-loader');
        loader.classList.remove('hidden');
        setTimeout(() => loader.classList.remove('opacity-0'), 10);
        setTimeout(() => { 
            action(); 
            loader.classList.add('opacity-0'); 
            setTimeout(() => loader.classList.add('hidden'), 300); 

            if (isOrderExecution) {
                const actFlow = document.getElementById('out-act-flow');
                if(actFlow) {
                    actFlow.innerText = "EXECUTED ✅"; 
                    actFlow.classList.add("text-green-500");
                    setTimeout(() => {
                        actFlow.classList.remove("text-green-500");
                        masterSync(); 
                    }, 2000);
                }
            }
        }, 400);
    }
};

const Painter = {
    updateDashboard: function(metrics, portTotals, sectorTotals, processedTrades) {
        document.getElementById('g-equity').innerText = Utils.formatPHP(metrics.totalEquity);
        document.getElementById('g-cash').innerText = Utils.formatPHP(metrics.cash);
        document.getElementById('g-annual-div').innerText = Utils.formatPHP(metrics.annDiv);

        const pPeso = document.getElementById('g-pnl-peso');
        const pPct = document.getElementById('g-pnl-pct');

        if(metrics.globalAssetsCost > 0) {
            const pnlPct = (metrics.totalUnrealizedPnL / metrics.globalAssetsCost) * 100;
            pPeso.innerText = (metrics.totalUnrealizedPnL > 0 ? '+' : '') + Utils.formatPHP(metrics.totalUnrealizedPnL);
            pPct.innerText = (metrics.totalUnrealizedPnL > 0 ? '+' : '') + pnlPct.toFixed(2) + '%';
            if(metrics.totalUnrealizedPnL >= 0) {
                pPeso.className = "text-xl font-mono font-bold text-green-600 dark:text-green-400 truncate";
                pPct.className = "text-xs font-mono font-bold text-green-600 dark:text-green-500 truncate";
            } else {
                pPeso.className = "text-xl font-mono font-bold text-red-600 dark:text-red-400 truncate";
                pPct.className = "text-xs font-mono font-bold text-red-600 dark:text-red-500 truncate";
            }
        } else {
            pPeso.innerText = "₱0.00"; pPct.innerText = "0.00%";
            pPeso.className = "text-xl font-mono font-bold text-slate-500 dark:text-slate-400 truncate";
            pPct.className = "text-xs font-mono font-bold text-slate-400 dark:text-slate-500 truncate";
        }

        const realBox = document.getElementById('g-realized-peso');
        if(realBox) {
            realBox.innerText = (metrics.totalRealizedGain > 0 ? '+' : '') + Utils.formatPHP(metrics.totalRealizedGain);
            if(metrics.totalRealizedGain >= 0) {
                realBox.className = "text-xl font-mono font-bold text-green-600 dark:text-green-400 truncate";
            } else {
                realBox.className = "text-xl font-mono font-bold text-red-600 dark:text-red-400 truncate";
            }
        }

        const pctAssets = metrics.totalEquity > 0 ? (metrics.deployedCap / metrics.totalEquity) * 100 : 0;
        const pctCash = metrics.totalEquity > 0 ? (metrics.cash / metrics.totalEquity) * 100 : 100;
        document.getElementById('g-bar-labels').innerHTML = `<span class="font-mono text-brand font-bold text-center sm:text-left truncate">${pctAssets.toFixed(1)}% DEPLOYED <span class="hidden sm:inline">(${Utils.formatPHP(metrics.deployedCap)})</span></span><span class="font-mono text-slate-500 font-bold text-center sm:text-right truncate"><span class="hidden sm:inline">(${Utils.formatPHP(metrics.cash)})</span> ${pctCash.toFixed(1)}% CASH</span>`;
        
        const barContainer = document.getElementById('g-bar-container');
        barContainer.innerHTML = '';
        portTotals.forEach(pt => {
            const pct = (pt.val / metrics.totalEquity) * 100;
            barContainer.innerHTML += `<div class="h-full border-r border-white/10 dark:border-black/10" style="width: ${pct}%; background-color: ${pt.hexColor}"></div>`;
        });

        this.renderPies(metrics.totalEquity, metrics.deployedCap, portTotals, sectorTotals);
        this.renderHoldingsCards(processedTrades, metrics);
    },

    renderPies: function(totalEquity, deployedCap, portTotals, sectorTotals) {
        let portConic = ""; let pCurr = 0; let pLegend = '';
        if (AppState.brokerCash > 0 && totalEquity > 0) {
            const pct = (AppState.brokerCash / totalEquity) * 100;
            const cashColor = !document.documentElement.classList.contains('dark') ? '#94a3b8' : '#64748b'; 
            portConic += `${cashColor} ${pCurr}% ${pCurr + pct}%, `; pCurr += pct;
            pLegend += `<div class="flex items-center gap-2 relative z-10"><div class="w-3 h-3 rounded-full transition-colors flex-shrink-0" style="background-color: ${cashColor}"></div><div class="flex flex-col overflow-hidden"><span class="text-slate-700 dark:text-slate-300 font-bold truncate">Cash</span><span class="text-[10px] text-slate-500">${pct.toFixed(1)}%</span></div></div>`;
        }
        portTotals.forEach(pt => {
            if (pt.val > 0 && totalEquity > 0) {
                const pct = (pt.val / totalEquity) * 100;
                portConic += `${pt.hexColor} ${pCurr}% ${pCurr + pct}%, `; pCurr += pct;
                pLegend += `<div class="flex items-center gap-2 relative z-10"><div class="w-3 h-3 rounded-full transition-colors flex-shrink-0" style="background-color: ${pt.hexColor}"></div><div class="flex flex-col overflow-hidden"><span class="text-slate-700 dark:text-slate-300 font-bold truncate">${pt.ticker}</span><span class="text-[10px] text-slate-500 transition-colors">${pct.toFixed(1)}%</span></div></div>`;
            }
        });
        document.getElementById('port-legend').innerHTML = pLegend;
        document.getElementById('port-pie').style.background = portConic === "" ? "conic-gradient(transparent 0% 100%)" : `conic-gradient(${portConic.slice(0, -2)})`;
        document.getElementById('pie-port-total').innerText = Utils.formatPHP(totalEquity);

        let secConic = ""; let sCurr = 0; let sLegend = '';
        Object.keys(sectorTotals).forEach(sec => {
            if (sectorTotals[sec] > 0 && deployedCap > 0) {
                const pct = (sectorTotals[sec] / deployedCap) * 100;
                const color = sectorColors[sec] || '#94a3b8';
                secConic += `${color} ${sCurr}% ${sCurr + pct}%, `; sCurr += pct;
                sLegend += `<div class="flex items-center gap-2 relative z-10"><div class="w-3 h-3 rounded-full transition-colors flex-shrink-0" style="background-color: ${color}"></div><div class="flex flex-col overflow-hidden"><span class="text-slate-700 dark:text-slate-300 font-bold truncate">${sec}</span><span class="text-[10px] text-slate-500 transition-colors">${pct.toFixed(1)}%</span></div></div>`;
            }
        });
        document.getElementById('sector-legend').innerHTML = sLegend;
        document.getElementById('sector-pie').style.background = secConic === "" ? "conic-gradient(transparent 0% 100%)" : `conic-gradient(${secConic.slice(0, -2)})`;
        document.getElementById('pie-sector-total').innerText = Utils.formatPHP(deployedCap);
    },
    
    renderHoldingsCards: function(processedTrades, metrics) {
        const body = document.getElementById('holdings-body');
        body.innerHTML = ''; let isHoldingEmpty = true;
        
        processedTrades.forEach((t, i) => {
            if (t.curShares > 0) {
                isHoldingEmpty = false;
                const val = t.netHoldMkt; 
                const pnl = t.unPnL;
                const pctPnl = t.holdCost > 0 ? (pnl / t.holdCost) * 100 : 0;
                const alloc = metrics.totalEquity > 0 ? ((val / metrics.totalEquity)*100).toFixed(1) : '0.0';
                const pnlClass = pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
                
                body.innerHTML += `<div class="grid grid-cols-1 lg:grid-cols-9 gap-2 lg:gap-4 p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors items-center">
                    <div class="flex justify-between items-center lg:col-span-2 mb-2 lg:mb-0">
                        <div class="flex items-center gap-2">
                            <div class="w-2 h-2 rounded-full" style="background-color: ${themeColorsHex[i % themeColorsHex.length]}"></div>
                            <div class="flex flex-col">
                                <span class="font-bold text-slate-900 dark:text-white">${t.ticker || `Set ${i+1}`}</span>
                                <span class="text-[10px] text-slate-500 lg:hidden">${t.sector}</span>
                            </div>
                        </div>
                        <div class="lg:hidden text-right">
                            <span class="font-bold text-slate-900 dark:text-white block">${Utils.formatPHP(val)}</span>
                            <span class="text-[10px] font-bold ${pnlClass}">${pnl > 0 ? '+' : ''}${Utils.formatPHP(pnl)} (${pctPnl.toFixed(2)}%)</span>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 lg:contents text-xs font-mono">
                        <div class="flex justify-between lg:block lg:text-right"><span class="text-slate-500 lg:hidden">Alloc</span><span class="text-slate-700 dark:text-slate-300">${alloc}%</span></div>
                        <div class="flex justify-between lg:block lg:text-right"><span class="text-slate-500 lg:hidden">Shares</span><span class="text-slate-900 dark:text-slate-200">${Utils.formatDec(t.curShares)}</span></div>
                        <div class="flex justify-between lg:block lg:text-right"><span class="text-slate-500 lg:hidden">Avg Price</span><span class="text-slate-700 dark:text-slate-300">₱${Utils.formatDec(t.curCost)}</span></div>
                        <div class="flex justify-between lg:block lg:text-right"><span class="text-slate-500 lg:hidden">Mkt Price</span><span class="text-purple-600 dark:text-purple-400">₱${Utils.formatDec(t.mktPrice || t.curCost)}</span></div>
                        <div class="hidden lg:block lg:text-right font-bold text-slate-900 dark:text-white">${Utils.formatPHP(val)}</div>
                        <div class="hidden lg:block lg:text-right font-bold ${pnlClass}">${pnl > 0 ? '+' : ''}${Utils.formatPHP(pnl)}</div>
                        <div class="hidden lg:block lg:text-right font-bold ${pnlClass}">${pctPnl.toFixed(2)}%</div>
                    </div>
                </div>`;
            }
        });

        if (metrics.cash > 0 || isHoldingEmpty) {
            const cashAlloc = metrics.totalEquity > 0 ? (metrics.cash / metrics.totalEquity) * 100 : (metrics.cash === 0 ? 0 : 100);
            body.innerHTML += `<div class="grid grid-cols-1 lg:grid-cols-9 gap-2 lg:gap-4 p-4 bg-slate-100/50 dark:bg-slate-900/40 transition-colors items-center">
                <div class="flex justify-between items-center lg:col-span-2 mb-2 lg:mb-0">
                    <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full bg-slate-400"></div>
                        <div class="flex flex-col">
                            <span class="font-bold text-slate-800 dark:text-slate-300">CASH</span>
                            <span class="text-[10px] text-slate-500 lg:hidden">Liquidity</span>
                        </div>
                    </div>
                    <div class="lg:hidden text-right font-bold text-slate-800 dark:text-white">${Utils.formatPHP(metrics.cash)}</div>
                </div>
                <div class="grid grid-cols-2 gap-2 lg:contents text-xs font-mono">
                    <div class="flex justify-between lg:block lg:text-right"><span class="text-slate-500 lg:hidden">Alloc</span><span class="text-slate-600">${cashAlloc.toFixed(1)}%</span></div>
                    <div class="flex justify-between lg:block lg:text-right"><span class="text-slate-500 lg:hidden">Shares</span><span class="text-slate-500">-</span></div>
                    <div class="flex justify-between lg:block lg:text-right"><span class="text-slate-500 lg:hidden">Avg Price</span><span class="text-slate-500">-</span></div>
                    <div class="flex justify-between lg:block lg:text-right"><span class="text-slate-500 lg:hidden">Mkt Price</span><span class="text-slate-500">-</span></div>
                    <div class="hidden lg:block lg:text-right font-bold text-slate-800 dark:text-white">${Utils.formatPHP(metrics.cash)}</div>
                    <div class="hidden lg:block lg:text-right text-slate-500">-</div>
                    <div class="hidden lg:block lg:text-right text-slate-500">-</div>
                </div>
            </div>`;
        }
    },

    updateAllocatorHUD: function(activeTrade, cash) {
        document.getElementById('out-shares').innerText = Utils.formatDec(activeTrade.projShares) || "0";
        document.getElementById('out-yoc').innerText = `${(activeTrade.grossYOC || 0).toFixed(2)}%`;
        document.getElementById('out-avg-entry').innerText = activeTrade.projAvgCost > 0 ? Utils.formatPHP(activeTrade.projAvgCost) : "₱0.00";
        document.getElementById('out-asset-val').innerText = Utils.formatPHP(activeTrade.totalDeployed);
        document.getElementById('out-ann-div').innerText = Utils.formatPHP(activeTrade.annNetDiv);
        document.getElementById('out-mon-div').innerText = Utils.formatPHP(activeTrade.annNetDiv / 12);

        const btnCommit = document.getElementById('btn-commit');
        const hudPanel = document.getElementById('hud-panel');
        const impactBox = document.getElementById('action-impact-box');
        const textWrapper = document.getElementById('action-text-wrapper');
        const actLabel = document.getElementById('out-act-label');
        const actFlow = document.getElementById('out-act-flow');
        const actFees = document.getElementById('out-act-fees');
        const warningMsg = document.getElementById('warning-msg');

        if(actFlow.innerText === "EXECUTED ✅") return;

        btnCommit.disabled = false; warningMsg.classList.add('hidden');
        hudPanel.className = `glass-panel p-6 sm:p-8 rounded-2xl h-full flex flex-col gap-6 relative transition-all duration-300 z-10`;

        if (activeTrade.locked === 'FUNDS') {
            impactBox.className = "col-span-2 bg-red-50 dark:bg-slate-900/60 p-4 rounded-xl border border-red-200 dark:border-red-900/50 flex flex-col sm:flex-row justify-between items-center shadow-inner h-full";
            textWrapper.className = "flex flex-col text-left opacity-60 w-full";
            actLabel.innerText = "Order Rejected"; actLabel.className = "text-[10px] text-red-600 uppercase font-bold";
            actFlow.innerText = "Check Ledger"; actFlow.className = "text-xl font-mono font-bold text-red-500 truncate";
            actFees.innerText = "Not enough cash."; actFees.classList.remove('hidden');
            btnCommit.innerText = "Insufficient Buying Power"; btnCommit.className = "w-full sm:w-auto px-5 py-3 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold rounded-lg cursor-not-allowed";
            btnCommit.disabled = true; hudPanel.classList.add('glow-yellow', 'border-red-400');
            if(cash === 0) warningMsg.classList.remove('hidden');
        }
        else if (activeTrade.locked === 'SHARES') {
            impactBox.className = "col-span-2 bg-red-50 dark:bg-slate-900/60 p-4 rounded-xl border border-red-200 dark:border-red-900/50 flex flex-col sm:flex-row justify-between items-center shadow-inner h-full";
            textWrapper.className = "flex flex-col text-left opacity-60 w-full";
            actLabel.innerText = "Order Rejected"; actLabel.className = "text-[10px] text-red-600 uppercase font-bold";
            actFlow.innerText = "Check Holdings"; actFlow.className = "text-xl font-mono font-bold text-red-500 truncate";
            actFees.innerText = "Cannot short sell."; actFees.classList.remove('hidden');
            btnCommit.innerText = "Insufficient Shares"; btnCommit.className = "w-full sm:w-auto px-5 py-3 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold rounded-lg cursor-not-allowed";
            btnCommit.disabled = true; hudPanel.classList.add('glow-yellow', 'border-red-400');
        }
        else if (activeTrade.action === 'HOLD') {
            impactBox.className = "col-span-2 bg-white dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center shadow-inner h-full";
            textWrapper.className = "flex flex-col text-left w-full";
            actLabel.innerText = "Corporate Action / Manual Update"; actLabel.className = "text-[10px] text-slate-500 uppercase font-bold";
            actFlow.innerText = "Ready to Sync"; actFlow.className = "text-xl font-mono font-bold text-slate-700 dark:text-slate-400 truncate";
            actFees.classList.add('hidden');
            btnCommit.innerText = "Save Asset Data"; btnCommit.className = "w-full sm:w-auto px-5 py-3 bg-brand text-white font-bold rounded-lg shadow-md";
        } 
        else if (activeTrade.action === 'BUY') {
            impactBox.className = "col-span-2 bg-green-50/70 dark:bg-slate-900/60 p-4 rounded-xl border border-green-200 dark:border-green-900/40 flex flex-col sm:flex-row justify-between items-center shadow-inner h-full";
            textWrapper.className = "flex flex-col text-left w-full";
            actLabel.innerText = "Capital Required"; actLabel.className = "text-[10px] text-green-700 font-bold uppercase";
            actFlow.innerText = Utils.formatPHP(Math.abs(activeTrade.actionFlow)); actFlow.className = "text-xl font-mono font-bold text-green-600 truncate";
            actFees.innerText = "Includes 0.295% Fee"; actFees.classList.remove('hidden');
            btnCommit.innerText = "Process Buy"; btnCommit.className = "w-full sm:w-auto px-5 py-3 bg-green-600 hover:bg-green-500 text-white font-bold tracking-widest uppercase rounded-lg shadow-md scale-[1.02]";
            hudPanel.classList.add('glow-green', 'border-green-400');
        } 
        else if (activeTrade.action === 'SELL') {
            impactBox.className = "col-span-2 bg-red-50 dark:bg-slate-900/60 p-4 rounded-xl border border-red-200 dark:border-red-900/40 flex flex-col sm:flex-row justify-between items-center shadow-inner h-full";
            textWrapper.className = "flex flex-col text-left w-full";
            actLabel.innerText = "Net Proceeds"; actLabel.className = "text-[10px] text-red-600 font-bold uppercase";
            actFlow.innerText = Utils.formatPHP(activeTrade.actionFlow); actFlow.className = "text-xl font-mono font-bold text-red-600 truncate";
            actFees.innerText = "Net of 0.395% Fee"; actFees.classList.remove('hidden');
            btnCommit.innerText = "Process Sell"; btnCommit.className = "w-full sm:w-auto px-5 py-3 bg-red-600 hover:bg-red-500 text-white font-bold tracking-widest uppercase rounded-lg shadow-md scale-[1.02]";
            hudPanel.style.boxShadow = "0 0 20px rgba(220,38,38,0.15)"; hudPanel.style.borderColor = "rgba(220,38,38,0.4)";
        }
    },

    updateProjectionsUI: function(projData, inputs, metrics) {
        document.getElementById('val-topup').innerText = Utils.formatPHP(inputs.plannedPmt);
        document.getElementById('val-grw').innerText = inputs.g * 100 + '%';
        document.getElementById('val-age1').innerText = inputs.a1; 
        document.getElementById('val-age2').innerText = inputs.a2; 
        document.getElementById('val-age3').innerText = inputs.a3;
        document.getElementById('val-inc').innerText = Utils.formatPHP(inputs.desiredInc);
        document.getElementById('card-age').innerText = inputs.a3;

        if (AppState.isCalendarFuture) document.getElementById('cal-subtitle').innerHTML = `Projected monthly dividends by age <span class="font-bold text-brand">${inputs.a3}</span>, based on compounding your current portfolio composition.`;

        const v0 = (metrics.deployedCap || 0) + (metrics.cash || 0);
        if (v0 === 0 && inputs.plannedPmt === 0) {
            document.getElementById('sync-cap').innerText = "Awaiting Inputs...";
            document.getElementById('sync-net-yld').innerText = "0.00%";
            document.getElementById('sync-gross-yld').innerText = "(from 0.00% Gross)";
            document.getElementById('out-target').innerText = "₱0.00";
            document.getElementById('out-projected').innerText = "₱0.00";
            if(myChart) { myChart.destroy(); myChart = null; }
            return; 
        }

        document.getElementById('sync-cap').innerText = Utils.formatPHP(v0);
        document.getElementById('sync-net-yld').innerText = (metrics.avgNetYield * 100).toFixed(2) + '%';
        document.getElementById('sync-gross-yld').innerText = `(from ${(metrics.avgGrossYield * 100).toFixed(2)}% Gross)`;
        document.getElementById('out-target').innerText = Utils.formatPHP(projData.targetFund);

        document.getElementById('out-projected').innerText = Utils.formatPHP(projData.projectedFinalTotal);
        document.getElementById('out-proj-inc').innerText = Utils.formatPHP(projData.projectedIncome) + " / mo";

        const outReqTopup = document.getElementById('out-req-topup');
        const subtext = document.getElementById('out-req-subtext');
        const labelReqTopup = document.getElementById('label-req-topup');

        if (projData.isCoastFire || (projData.targetFund === 0 && v0 > 0)) {
            labelReqTopup.innerText = "Suggested Monthly Top-Up";
            outReqTopup.innerText = "₱0 / mo";
            outReqTopup.className = "text-xl font-mono font-bold text-brand transition-all";
            subtext.innerText = "Goal fully covered by existing capital. Let it coast!";
            subtext.className = "text-[9px] mt-1 leading-tight text-brand font-bold";
        } else if (projData.reqPmt === Infinity) {
            labelReqTopup.innerText = "Suggested Monthly Top-Up";
            outReqTopup.innerText = "Impossibility";
            outReqTopup.className = "text-xl font-mono font-bold text-amber-500 transition-all";
            subtext.innerText = "You must extend your Stop Age or add more Capital.";
            subtext.className = "text-[9px] mt-1 leading-tight text-amber-500 font-bold";
        } else if (inputs.plannedPmt >= projData.reqPmt) {
            labelReqTopup.innerText = "Suggested Monthly Top-Up";
            outReqTopup.innerText = Utils.formatPHP(projData.reqPmt) + " / mo";
            outReqTopup.className = "text-xl font-mono font-bold text-brand transition-all";
            subtext.innerText = `You only need ${Utils.formatPHP(projData.reqPmt)}! Your plan puts you ahead of schedule.`;
            subtext.className = "text-[9px] mt-1 leading-tight text-brand font-bold";
        } else {
            labelReqTopup.innerText = "Suggested Monthly Top-Up";
            outReqTopup.innerText = Utils.formatPHP(projData.reqPmt) + " / mo";
            outReqTopup.className = "text-xl font-mono font-bold text-blue-600 dark:text-blue-400 transition-all";
            subtext.innerText = "You are falling short. Increase top-ups or extend your timeline.";
            subtext.className = "text-[9px] mt-1 leading-tight text-slate-500 dark:text-slate-400";
        }

        const statusCard = document.getElementById('status-card');
        if (projData.projectedFinalDeployed >= projData.targetFund && projData.targetFund > 0) {
            document.getElementById('out-projected').className = "text-3xl sm:text-4xl font-mono font-bold text-brand truncate transition-colors";
            document.getElementById('out-proj-inc').className = "text-lg font-mono font-bold text-brand truncate transition-colors";
            statusCard.className = "glass-panel p-6 rounded-2xl text-center border-t-4 border-t-brand transition-colors relative z-10";
        } else {
            document.getElementById('out-projected').className = "text-3xl sm:text-4xl font-mono font-bold text-amber-500 truncate transition-colors";
            document.getElementById('out-proj-inc').className = "text-lg font-mono font-bold text-amber-500 truncate transition-colors";
            statusCard.className = "glass-panel p-6 rounded-2xl text-center border-t-4 border-t-amber-500 transition-colors relative z-10";
        }

        const freqText = document.getElementById('slide-freq').options[document.getElementById('slide-freq').selectedIndex].text.toLowerCase();
        const strategyLabel = inputs.isDrip ? "Exponential DRIP" : "Linear Cash Hoarding";
        document.getElementById('narrative-box').innerHTML = `
            Starting at age <span class="font-bold border-b border-brand/30 transition-colors">${inputs.a1}</span> with your current portfolio of <span class="font-mono font-bold text-brand transition-colors">${Utils.formatPHP(v0)}</span>, if you top-up <span class="font-mono font-bold text-brand transition-colors">${Utils.formatPHP(inputs.plannedPmt)}</span> ${freqText} until age <span class="font-bold border-b border-brand/30 transition-colors">${inputs.a2}</span>, your total out-of-pocket investment will be <span class="font-mono font-bold transition-colors">${Utils.formatPHP(projData.totalInvested)}</span>.<br><br>
            Letting it coast using an <span class="font-bold italic transition-colors">${strategyLabel}</span> strategy for another <span class="font-bold transition-colors">${inputs.a3 - inputs.a2}</span> years, by age <span class="font-bold border-b border-brand/30 transition-colors">${inputs.a3}</span> your portfolio is projected to reach <span class="font-mono font-bold text-brand text-lg transition-colors">${Utils.formatPHP(projData.projectedFinalTotal)}</span>.<br><br>
            Living off the dividends generates <span class="font-mono font-bold text-brand text-lg transition-colors">${Utils.formatPHP(projData.projectedIncome)}</span> per month (via Est. Net Yield), which is <span class="font-bold underline decoration-brand decoration-2 transition-colors">${projData.projectedFinalDeployed >= projData.targetFund ? 'above' : 'short of'}</span> your original goal!
        `;

        this.drawChart(projData.chartData);
    },

    drawChart: function(chartData) {
        const ctx = document.getElementById('reinvestChart').getContext('2d');
        if (myChart) myChart.destroy();
        const isDark = document.documentElement.classList.contains('dark');
        
        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [
                    { label: 'Total Value', data: chartData.dataValue, borderColor: '#3E8E35', backgroundColor: 'rgba(62, 142, 53, 0.1)', borderWidth: 3, fill: true, tension: 0.3, pointRadius: 0 },
                    { label: 'Total Out-of-Pocket', data: chartData.dataInvested, borderColor: isDark ? '#475569' : '#9ca3af', borderDash: [5, 5], borderWidth: 2, fill: false, tension: 0.1, pointRadius: 0 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false } },
                scales: { x: { grid: { display: false }, ticks: { color: isDark ? '#94a3b8' : '#64748b' } }, y: { grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }, ticks: { color: isDark ? '#94a3b8' : '#64748b', callback: v => v >= 1000000 ? '₱'+(v/1000000).toFixed(1)+'M' : '₱'+(v/1000).toFixed(0)+'k' } } }
            }
        });
    },

    renderCalendarGrid: function(calData) {
        const grid = document.getElementById('cal-grid');
        const unschedBucket = document.getElementById('unscheduled-bucket');
        const unschedList = document.getElementById('unscheduled-list');
        grid.innerHTML = ''; unschedList.innerHTML = '';
        
        if (calData.hasUnscheduled) {
            unschedBucket.classList.remove('hidden'); unschedBucket.classList.add('block');
            AppState.trades.forEach(t => {
                if (t.curShares > 0 && (!t.schedule || t.schedule.length === 0)) {
                    unschedList.innerHTML += `<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 px-2 py-1 rounded text-[10px] font-mono font-bold shadow-sm transition-colors relative z-10">${t.ticker || 'Unnamed Asset'}</span>`;
                }
            });
        } else {
            unschedBucket.classList.add('hidden'); unschedBucket.classList.remove('block');
        }

        const maxVal = Math.max(...calData.monthlyData.map(m => m.total), 1);
        calData.monthlyData.forEach((m, idx) => {
            const card = document.createElement('div');
            card.className = "glass-panel p-4 rounded-xl flex flex-col relative overflow-hidden group z-10 transition-colors";
            let sourcesHtml = m.sources.length === 0 
                ? `<span class="text-[9px] text-slate-400 italic relative z-10 transition-colors">No payouts.</span>` 
                : m.sources.map(s => `<div class="flex justify-between text-[9px] font-mono relative z-10"><span class="text-slate-500 transition-colors truncate pr-2">${s.ticker}</span><span class="text-slate-700 dark:text-slate-300 transition-colors">₱${s.val.toLocaleString('en-US',{maximumFractionDigits:0})}</span></div>`).join('');
            
            card.innerHTML = `
                <div class="absolute bottom-0 left-0 w-full bg-brand/10 transition-all duration-500 z-0" style="height: ${(m.total / maxVal) * 100}%;"></div>
                <div class="relative z-10">
                    <p class="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1 transition-colors">${monthNames[idx]}</p>
                    <p class="text-lg font-mono font-bold text-slate-800 dark:text-slate-100 mb-3 transition-colors">${Utils.formatPHP(m.total)}</p>
                    <div class="flex flex-col gap-1 pt-3 border-t border-slate-200 dark:border-slate-800/50 transition-colors relative z-10">${sourcesHtml}</div>
                </div>`;
            grid.appendChild(card);
        });
    },

    renderLedgerLogs: function() {
        const fBody = document.getElementById('funding-body'); fBody.innerHTML = '';
        if (AppState.fundingLog.length === 0) fBody.innerHTML = `<div class="p-6 text-center text-slate-500 italic text-sm">No funding history.</div>`;
        else AppState.fundingLog.forEach(l => { fBody.innerHTML += `<div class="grid grid-cols-1 lg:grid-cols-5 gap-2 lg:gap-4 p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 group transition-colors items-center"><div class="flex justify-between lg:block text-[10px] text-slate-500"><span class="lg:hidden font-bold">Date</span>${l.date}</div><div class="flex justify-between lg:block font-bold ${l.amount >= 0 ? 'text-green-600' : 'text-red-600'}"><span class="lg:hidden font-bold text-[10px] text-slate-500 uppercase">Amount</span>${l.amount > 0 ? '+' : ''}${Utils.formatPHP(l.amount)}</div><div class="flex justify-between lg:block"><span class="lg:hidden font-bold text-[10px] text-slate-500 uppercase">Type</span><span class="px-2 py-0.5 rounded text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">${l.type || 'Deposit'}</span></div><div class="flex flex-col lg:col-span-2 text-xs text-slate-700 dark:text-slate-300"><span class="lg:hidden font-bold text-[10px] text-slate-500 uppercase mb-1">Remarks</span><div class="flex justify-between items-center"><span class="truncate pr-4">${l.remarks || '-'}</span><button onclick="window.deleteFunding(${l.id})" class="text-red-400 hover:text-red-600 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 lg:opacity-0 group-hover:opacity-100 transition-all">✕</button></div></div></div>`; });

        const tBody = document.getElementById('trade-body'); tBody.innerHTML = '';
        if (AppState.tradeLog.length === 0) tBody.innerHTML = `<div class="p-6 text-center text-slate-500 italic text-sm">No trade history.</div>`;
        else AppState.tradeLog.forEach(l => { let pnlText = l.action === 'SELL' ? `<span class="font-bold ${l.realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}">${l.realizedPnL > 0 ? '+' : ''}${Utils.formatPHP(l.realizedPnL)}</span>` : `<span class="text-slate-400">-</span>`; tBody.innerHTML += `<div class="grid grid-cols-1 lg:grid-cols-6 gap-2 lg:gap-4 p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 group transition-colors items-center"><div class="flex justify-between lg:block text-[10px] text-slate-500"><span class="lg:hidden font-bold">Date</span>${l.date}</div><div class="flex justify-between lg:block font-bold text-slate-900 dark:text-white"><span class="lg:hidden font-bold text-[10px] text-slate-500 uppercase">Ticker</span>${l.ticker}</div><div class="flex justify-between lg:block"><span class="lg:hidden font-bold text-[10px] text-slate-500 uppercase">Action</span><span class="px-2 py-1 rounded text-[10px] font-bold ${l.action === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${l.action}</span></div><div class="flex justify-between lg:block lg:text-right font-bold ${l.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}"><span class="lg:hidden font-bold text-[10px] text-slate-500 uppercase text-left">Net Amount</span>${l.netAmount > 0 ? '+' : ''}${Utils.formatPHP(l.netAmount)}</div><div class="flex justify-between lg:block lg:text-right"><span class="lg:hidden font-bold text-[10px] text-slate-500 uppercase">Realized PnL</span>${pnlText}</div><div class="flex justify-end lg:block lg:text-right mt-2 lg:mt-0"><button onclick="window.deleteTrade(${l.id})" class="text-red-400 hover:text-red-600 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 lg:opacity-0 group-hover:opacity-100 transition-all">✕</button></div></div>`; });
    }
};

// ==========================================
// 3. THE MESSENGERS (CONTROLLERS & EVENTS)
// ==========================================
function masterSync() {
    const analysis = MathEngine.analyzePortfolio(AppState.brokerCash, AppState.trades, AppState.tradeLog);
    latestEngineResult = analysis.globalMetrics;

    if (AppState.brokerCash === 0 && latestEngineResult.deployedCap === 0) {
        document.getElementById('fund-first-banner').classList.remove('hidden'); document.getElementById('fund-first-banner').classList.add('flex');
    } else {
        document.getElementById('fund-first-banner').classList.add('hidden'); document.getElementById('fund-first-banner').classList.remove('flex');
    }

    Painter.updateDashboard(latestEngineResult, analysis.portTotals, analysis.sectorTotals, analysis.processedTrades);
    Painter.updateAllocatorHUD(analysis.processedTrades[AppState.activeTab], AppState.brokerCash);
    Painter.renderLedgerLogs();

    if(!document.getElementById('view-projections').classList.contains('hidden')) syncProjections();
    if(!document.getElementById('view-calendar').classList.contains('hidden')) syncCalendar();

    // NEW: Trigger silent auto-save after calculations and UI updates
    triggerAutoSave();
}

function syncProjections() {
    let a1 = parseInt(document.getElementById('slide-age1').value);
    let a2 = parseInt(document.getElementById('slide-age2').value);
    let a3 = parseInt(document.getElementById('slide-age3').value);

    if (a2 < a1) { document.getElementById('slide-age2').value = a1; a2 = a1; }
    if (a3 < a2) { document.getElementById('slide-age3').value = a2; a3 = a2; }
    if (a3 < a1) { document.getElementById('slide-age3').value = a1; }

    const inputs = {
        a1, a2, a3,
        plannedPmt: parseFloat(document.getElementById('slide-topup').value) || 0,
        freq: parseInt(document.getElementById('slide-freq').value),
        g: parseFloat(document.getElementById('slide-grw').value) / 100 || 0,
        desiredInc: parseFloat(document.getElementById('slide-inc').value) || 0,
        isDrip: AppState.isDrip
    };

    latestProjectionResult = MathEngine.projectWealth(inputs, latestEngineResult);
    Painter.updateProjectionsUI(latestProjectionResult, inputs, latestEngineResult);
}

function syncCalendar() {
    const targetAnnTotal = latestProjectionResult ? (latestProjectionResult.projectedFinalDeployed * latestEngineResult.avgNetYield) : 0;
    const calData = MathEngine.generateCalendar(AppState.trades, AppState.isCalendarFuture, targetAnnTotal);
    Painter.renderCalendarGrid(calData);
}

// --- ALLOCATOR UI BINDINGS ---
function renderTabs() {
    const container = document.getElementById('tabs-container');
    container.innerHTML = '';
    AppState.trades.forEach((t, i) => {
        const btn = document.createElement('button');
        const isLightMode = !document.documentElement.classList.contains('dark');
        const emptyColor = isLightMode ? '#94a3b8' : '#64748b'; 
        const dotColor = t.curShares > 0 ? themeColorsHex[i % themeColorsHex.length] : emptyColor;
        btn.className = `flex items-center gap-2 px-4 py-2 rounded-t-lg font-mono text-sm font-bold border-2 border-b-0 transition-colors z-10 -mb-[2px] ${AppState.activeTab === i ? 'tab-active' : 'tab-inactive hover:bg-slate-100 dark:hover:bg-slate-800'}`;
        btn.innerHTML = `<div class="w-2 h-2 rounded-full shadow-sm" style="background-color: ${dotColor}"></div><span>${t.ticker || `Set ${i + 1}`}</span>`;
        btn.onclick = () => switchTab(i);
        container.appendChild(btn);
    });
    if (AppState.trades.length < 30) { 
        const addBtn = document.createElement('button');
        addBtn.className = `flex items-center justify-center px-4 py-2 rounded-t-lg font-mono text-sm font-bold border-2 border-b-0 transition-colors z-10 -mb-[2px] tab-inactive hover:bg-slate-100 dark:hover:bg-slate-800`;
        addBtn.innerHTML = `<span class="text-lg leading-none mt-[-2px]">+</span>`;
        addBtn.onclick = () => {
            AppState.trades.push({ ticker: '', sector: 'Property', dps: 0, schedule: [], curShares: 0, curCost: 0, mktPrice: 0, action: 'HOLD', actShares: 0, actPrice: 0 });
            switchTab(AppState.trades.length - 1);
        };
        container.appendChild(addBtn);
    }
}

function switchTab(index) {
    AppState.activeTab = index;
    const t = AppState.trades[index];
    document.getElementById('t-ticker').value = t.ticker; document.getElementById('ticker-watermark').innerText = t.ticker;
    document.getElementById('t-sector').value = t.sector; document.getElementById('t-dps').value = Utils.formatDec(t.dps);
    document.getElementById('t-mkt-price').value = Utils.formatDec(t.mktPrice); document.getElementById('t-act-shares').value = Utils.formatDec(t.actShares);
    document.getElementById('t-act-price').value = Utils.formatDec(t.actPrice);
    renderTabs(); renderScheduleButtons(); updateToggleUI(); masterSync(); 
}

function renderScheduleButtons() {
    const container = document.getElementById('t-schedule-container');
    container.innerHTML = '';
    const currentSchedule = AppState.trades[AppState.activeTab].schedule || [];
    monthNames.forEach((m, idx) => {
        const btn = document.createElement('button');
        const isActive = currentSchedule.includes(idx + 1);
        btn.className = `px-2 sm:px-3 py-1.5 text-[9px] font-mono font-bold rounded-lg border transition-all ${isActive ? 'bg-brand text-white border-brand shadow-md scale-105' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700 hover:border-brand/50 hover:text-brand'}`;
        btn.innerText = m;
        btn.onclick = () => {
            if (isActive) AppState.trades[AppState.activeTab].schedule = currentSchedule.filter(x => x !== idx + 1);
            else { 
                if (!AppState.trades[AppState.activeTab].schedule) AppState.trades[AppState.activeTab].schedule = [];
                AppState.trades[AppState.activeTab].schedule.push(idx + 1); 
                AppState.trades[AppState.activeTab].schedule.sort((a,b) => a-b); 
            }
            renderScheduleButtons(); masterSync(); 
        };
        container.appendChild(btn);
    });
}

function updateToggleUI() {
    const act = AppState.trades[AppState.activeTab].action;
    const btnBuy = document.getElementById('btn-toggle-buy');
    const btnSell = document.getElementById('btn-toggle-sell');
    const container = document.getElementById('action-inputs-container');
    const buySvg = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>`;
    const sellSvg = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>`;

    btnBuy.className = "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-green-600 hover:border-green-400 font-bold tracking-wider uppercase transition-all shadow-sm";
    btnBuy.innerHTML = `${buySvg} Buy`;
    btnSell.className = "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-red-600 hover:border-red-400 font-bold tracking-wider uppercase transition-all shadow-sm";
    btnSell.innerHTML = `${sellSvg} Sell`;

    if (act === 'BUY') {
        btnBuy.className = "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-green-500 bg-green-600 text-white font-bold tracking-widest uppercase transition-all shadow-md scale-[1.02]";
        container.classList.remove('opacity-0', 'pointer-events-none', 'h-0'); container.classList.add('opacity-100', 'h-auto', 'mt-6');
        document.getElementById('action-label-shares').innerText = "Shares to Buy"; document.getElementById('t-act-price').focus(); 
    } else if (act === 'SELL') {
        btnSell.className = "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-red-500 bg-red-600 text-white font-bold tracking-widest uppercase transition-all shadow-md scale-[1.02]";
        container.classList.remove('opacity-0', 'pointer-events-none', 'h-0'); container.classList.add('opacity-100', 'h-auto', 'mt-6');
        document.getElementById('action-label-shares').innerText = "Shares to Sell"; document.getElementById('t-act-price').focus();
    } else {
        container.classList.remove('opacity-100', 'h-auto', 'mt-6'); container.classList.add('opacity-0', 'pointer-events-none', 'h-0');
    }
}

// --- ACTIONS ---
function saveActiveInput() {
    const t = AppState.trades[AppState.activeTab];
    t.dps = Utils.parseNum(document.getElementById('t-dps').value); t.mktPrice = Utils.parseNum(document.getElementById('t-mkt-price').value);
    t.actShares = Utils.parseNum(document.getElementById('t-act-shares').value); t.actPrice = Utils.parseNum(document.getElementById('t-act-price').value);
    masterSync();
}

document.getElementById('btn-toggle-buy').addEventListener('click', () => { AppState.trades[AppState.activeTab].action = AppState.trades[AppState.activeTab].action === 'BUY' ? 'HOLD' : 'BUY'; updateToggleUI(); masterSync(); });
document.getElementById('btn-toggle-sell').addEventListener('click', () => { AppState.trades[AppState.activeTab].action = AppState.trades[AppState.activeTab].action === 'SELL' ? 'HOLD' : 'SELL'; updateToggleUI(); masterSync(); });
document.getElementById('t-ticker').addEventListener('input', (e) => { AppState.trades[AppState.activeTab].ticker = e.target.value.toUpperCase(); document.getElementById('ticker-watermark').innerText = AppState.trades[AppState.activeTab].ticker; renderTabs(); masterSync(); });
document.getElementById('t-sector').addEventListener('change', (e) => { AppState.trades[AppState.activeTab].sector = e.target.value; renderTabs(); masterSync(); });

['slide-topup', 'slide-grw', 'slide-age1', 'slide-age2', 'slide-age3', 'slide-inc'].forEach(id => { document.getElementById(id)?.addEventListener('input', syncProjections); });
document.getElementById('slide-freq')?.addEventListener('change', syncProjections);

document.getElementById('proj-toggle-drip')?.addEventListener('click', (e) => {
    AppState.isDrip = true;
    e.target.className = "flex-1 px-2 py-1.5 rounded bg-white dark:bg-slate-700 text-brand dark:text-green-400 text-[10px] font-bold shadow-sm transition-all";
    document.getElementById('proj-toggle-cash').className = "flex-1 px-2 py-1.5 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[10px] font-bold transition-all";
    document.getElementById('proj-strategy-desc').innerText = "Dividends buy more shares (Exponential).";
    syncProjections();
    triggerAutoSave();
});

document.getElementById('proj-toggle-cash')?.addEventListener('click', (e) => {
    AppState.isDrip = false;
    e.target.className = "flex-1 px-2 py-1.5 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-[10px] font-bold shadow-sm transition-all";
    document.getElementById('proj-toggle-drip').className = "flex-1 px-2 py-1.5 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[10px] font-bold transition-all";
    document.getElementById('proj-strategy-desc').innerText = "Dividends are hoarded as cash (Linear).";
    syncProjections();
    triggerAutoSave();
});

document.getElementById('cal-toggle-current')?.addEventListener('click', (e) => {
    AppState.isCalendarFuture = false;
    e.target.className = "flex-1 px-4 py-2 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-[10px] sm:text-xs font-bold shadow-sm transition-all";
    document.getElementById('cal-toggle-future').className = "flex-1 px-4 py-2 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[10px] sm:text-xs font-bold transition-all";
    document.getElementById('cal-subtitle').innerText = "Based on your currently deployed capital and exact dividend schedules.";
    syncCalendar();
});

document.getElementById('cal-toggle-future')?.addEventListener('click', (e) => {
    AppState.isCalendarFuture = true;
    e.target.className = "flex-1 px-4 py-2 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-[10px] sm:text-xs font-bold shadow-sm transition-all";
    document.getElementById('cal-toggle-current').className = "flex-1 px-4 py-2 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[10px] sm:text-xs font-bold transition-all";
    let a3 = document.getElementById('slide-age3').value;
    document.getElementById('cal-subtitle').innerHTML = `Projected monthly dividends by age <span class="font-bold text-brand">${a3}</span>, based on compounding your current portfolio composition.`;
    syncCalendar();
});

document.getElementById('btn-commit').addEventListener('click', () => {
    const analysis = MathEngine.analyzePortfolio(AppState.brokerCash, AppState.trades, AppState.tradeLog);
    const t = analysis.processedTrades[AppState.activeTab];
    if(t.locked) return; 

    Utils.executeWithLoader(() => {
        saveStateToUndo();
        if (t.action !== 'HOLD' && t.actShares > 0 && t.actPrice > 0) {
            AppState.brokerCash += t.actionFlow; 
            let rPnL = t.action === 'SELL' ? t.actionFlow - (t.actShares * t.curCost) : 0;
            
            AppState.tradeLog.unshift({ 
                id: Date.now(), tabIndex: AppState.activeTab, date: new Date().toLocaleDateString('en-US'), 
                ticker: t.ticker || `Set ${AppState.activeTab+1}`, action: t.action, shares: t.actShares, 
                price: t.actPrice, netAmount: t.actionFlow, realizedPnL: rPnL, 
                prevAvgCost: AppState.trades[AppState.activeTab].curCost 
            });
            
            AppState.trades[AppState.activeTab].curShares = t.projShares; 
            AppState.trades[AppState.activeTab].curCost = t.projAvgCost;
            if(t.mktPrice === 0 || t.mktPrice === t.curCost) AppState.trades[AppState.activeTab].mktPrice = t.actPrice;
        }

        AppState.trades[AppState.activeTab].action = 'HOLD'; 
        AppState.trades[AppState.activeTab].actShares = 0; 
        AppState.trades[AppState.activeTab].actPrice = 0;
        document.getElementById('t-act-shares').value = ''; 
        document.getElementById('t-act-price').value = '';
        
        updateToggleUI(); 
        document.getElementById('t-mkt-price').value = Utils.formatDec(AppState.trades[AppState.activeTab].mktPrice);
    }, true); 
});

document.getElementById('btn-modal-submit').addEventListener('click', () => {
    const rawAmt = Utils.parseNum(document.getElementById('modal-amount').value);
    const cat = document.getElementById('modal-category').value;
    
    if (isNaN(rawAmt) || rawAmt === 0) { alert("Please enter a valid amount."); return; }
    
    let finalAmt = Math.abs(rawAmt);
    if (cat === 'Withdrawal') {
        finalAmt = -finalAmt;
    }

    if (cat === 'Withdrawal' && Math.abs(finalAmt) > AppState.brokerCash) {
        alert("Insufficient Buying Power for this withdrawal.");
        return;
    }

    Utils.executeWithLoader(() => {
        saveStateToUndo();
        AppState.brokerCash += finalAmt; 
        
        AppState.fundingLog.unshift({ 
            id: Date.now(), 
            date: new Date().toLocaleDateString('en-US'), 
            amount: finalAmt,
            type: cat, 
            remarks: document.getElementById('modal-remarks').value 
        });
        
        document.getElementById('btn-modal-cancel').click(); 
        masterSync();
    });
});

// --- GLOBALLY EXPOSED BINDINGS (For HTML inline clicks in an ES Module) ---
window.switchMainView = function(viewId) {
    ['dashboard', 'allocator', 'ledgers', 'projections', 'calendar', 'guidebook'].forEach(v => {
        document.getElementById(`view-${v}`).classList.add('hidden');
        const deskNav = document.getElementById(`nav-${v}`);
        if(deskNav) { deskNav.classList.remove('nav-active', 'text-slate-900', 'dark:text-white'); deskNav.classList.add('text-slate-500', 'dark:text-slate-400'); }
        const mobNav = document.getElementById(`mob-nav-${v}`);
        if(mobNav) { mobNav.classList.remove('text-brand'); mobNav.classList.add('text-slate-500', 'dark:text-slate-400'); }
    });
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    const activeDesk = document.getElementById(`nav-${viewId}`);
    if(activeDesk) { activeDesk.classList.remove('text-slate-500', 'dark:text-slate-400'); activeDesk.classList.add('nav-active', 'text-slate-900', 'dark:text-white'); }
    const activeMob = document.getElementById(`mob-nav-${viewId}`);
    if(activeMob) { activeMob.classList.remove('text-slate-500', 'dark:text-slate-400'); activeMob.classList.add('text-brand'); }
    
    if(viewId === 'projections') syncProjections();
    if(viewId === 'calendar') syncCalendar();
};

window.openFundModal = function() { document.getElementById('modal-amount').value = ''; document.getElementById('modal-remarks').value = ''; document.getElementById('funding-modal').classList.remove('hidden'); setTimeout(() => document.getElementById('funding-modal').classList.remove('opacity-0'), 10); };
document.getElementById('btn-modal-cancel').addEventListener('click', () => { document.getElementById('funding-modal').classList.add('opacity-0'); setTimeout(() => document.getElementById('funding-modal').classList.add('hidden'), 300); });

window.deleteFunding = function(id) {
    if(!confirm("Delete this funding record? Cash balance will be adjusted.")) return;
    const logIndex = AppState.fundingLog.findIndex(l => l.id === id); if(logIndex === -1) return;
    saveStateToUndo(); AppState.brokerCash -= AppState.fundingLog[logIndex].amount; AppState.fundingLog.splice(logIndex, 1); masterSync();
};

window.deleteTrade = function(id) {
    if(!confirm("Delete this trade? This will mathematically reverse the shares and cash impact.")) return;
    const logIndex = AppState.tradeLog.findIndex(l => l.id === id); if(logIndex === -1) return;
    saveStateToUndo(); const log = AppState.tradeLog[logIndex]; AppState.brokerCash -= log.netAmount;
    
    if (log.tabIndex !== undefined && AppState.trades[log.tabIndex]) {
        let t = AppState.trades[log.tabIndex];
        if (log.action === 'BUY') {
            let existingValue = t.curShares * t.curCost; let revertedValue = log.shares * log.price * (1 + BUY_FEE);
            t.curShares -= log.shares; t.curCost = t.curShares <= 0 ? 0 : Math.max(0, (existingValue - revertedValue) / t.curShares);
        } else if (log.action === 'SELL') { 
            if (t.curShares === 0) t.curCost = log.prevAvgCost !== undefined ? log.prevAvgCost : log.price; 
            t.curShares += log.shares; 
        }
    }
    
    AppState.tradeLog.splice(logIndex, 1); switchTab(AppState.activeTab); 
};

// Undo/Reset
function saveStateToUndo() { AppState.undoStack.push({ cash: AppState.brokerCash, trades: JSON.parse(JSON.stringify(AppState.trades)), tradeLog: JSON.parse(JSON.stringify(AppState.tradeLog)), fundingLog: JSON.parse(JSON.stringify(AppState.fundingLog)) }); document.getElementById('btn-undo-desk').classList.remove('hidden'); document.getElementById('btn-undo-desk').classList.add('flex'); document.getElementById('btn-undo-mob').classList.remove('hidden'); document.getElementById('btn-undo-mob').classList.add('flex'); }
window.executeUndo = function() { if (AppState.undoStack.length === 0) return; const lastState = AppState.undoStack.pop(); AppState.brokerCash = lastState.cash; AppState.trades.splice(0, AppState.trades.length, ...lastState.trades); AppState.tradeLog.splice(0, AppState.tradeLog.length, ...lastState.tradeLog); AppState.fundingLog.splice(0, AppState.fundingLog.length, ...lastState.fundingLog); if (AppState.undoStack.length === 0) { document.getElementById('btn-undo-desk').classList.add('hidden'); document.getElementById('btn-undo-desk').classList.remove('flex'); document.getElementById('btn-undo-mob').classList.add('hidden'); document.getElementById('btn-undo-mob').classList.remove('flex'); } if (AppState.activeTab >= AppState.trades.length) AppState.activeTab = AppState.trades.length - 1; switchTab(AppState.activeTab); masterSync(); };
document.getElementById('btn-undo-desk')?.addEventListener('click', window.executeUndo); document.getElementById('btn-undo-mob')?.addEventListener('click', window.executeUndo);

let targetResetCode = '000';
window.openResetModal = function() { targetResetCode = Math.floor(100 + Math.random() * 900).toString(); document.getElementById('reset-rand-code').innerText = targetResetCode; document.getElementById('reset-input').value = ''; document.getElementById('btn-reset-confirm').disabled = true; document.getElementById('btn-reset-confirm').className = "w-full py-3 bg-red-600 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg cursor-not-allowed opacity-30 transition-all active:scale-95"; document.getElementById('reset-modal').classList.remove('hidden'); setTimeout(() => document.getElementById('reset-modal').classList.remove('opacity-0'), 10); };
document.getElementById('reset-input')?.addEventListener('input', (e) => { if (e.target.value === targetResetCode) { document.getElementById('btn-reset-confirm').disabled = false; document.getElementById('btn-reset-confirm').className = "w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all active:scale-95"; } else { document.getElementById('btn-reset-confirm').disabled = true; document.getElementById('btn-reset-confirm').className = "w-full py-3 bg-red-600 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg cursor-not-allowed opacity-30 transition-all active:scale-95"; } });
document.getElementById('btn-reset-cancel')?.addEventListener('click', () => { document.getElementById('reset-modal').classList.add('opacity-0'); setTimeout(() => document.getElementById('reset-modal').classList.add('hidden'), 300); });
document.getElementById('btn-reset-confirm')?.addEventListener('click', () => { AppState.undoStack = []; document.getElementById('btn-undo-desk').classList.add('hidden'); document.getElementById('btn-undo-desk').classList.remove('flex'); document.getElementById('btn-undo-mob').classList.add('hidden'); document.getElementById('btn-undo-mob').classList.remove('flex'); AppState.brokerCash = 0; AppState.tradeLog = []; AppState.fundingLog = []; AppState.trades = Array.from({ length: 3 }, () => ({ ticker: '', sector: 'Property', dps: 0, schedule: [], curShares: 0, curCost: 0, mktPrice: 0, action: 'HOLD', actShares: 0, actPrice: 0 })); document.getElementById('btn-reset-cancel').click(); renderTabs(); switchTab(0); masterSync(); });

document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        if(!document.getElementById('view-projections').classList.contains('hidden')) syncProjections(); 
    });
});

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
        if(e.target.id.startsWith('t-')) saveActiveInput();
    });
});

// ==========================================
// NEW: SAVE & EXIT GLOBAL FUNCTION
// ==========================================
window.saveAndExit = async function() {
    const loadScreen = document.getElementById('loading-screen');
    const loadBar = document.getElementById('loading-progress');
    
    // Resurrect loading screen
    if (loadScreen) {
        loadScreen.classList.remove('hidden', 'opacity-0');
        if (loadBar) {
            loadBar.style.transition = 'none';
            loadBar.style.width = '0%';
            setTimeout(() => {
                loadBar.style.transition = 'all 1000ms ease-out';
                loadBar.style.width = '70%';
            }, 50);
        }
    }

    await saveData();

    if (loadBar) loadBar.style.width = '100%';
    setTimeout(() => {
        window.location.href = '../index.html';
    }, 400);
};

// ==========================================
// UPGRADED: TACTILE MANUAL SAVE
// ==========================================
const handleManualSave = async (e) => {
    const btn = e.currentTarget;
    const originalHTML = btn.innerHTML;
    const isDesktop = btn.id === 'btn-save-desk';

    // Change to Syncing state
    btn.innerHTML = isDesktop ? "Syncing..." : `<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>`;
    btn.classList.add('opacity-75', 'cursor-not-allowed');
    btn.disabled = true;

    await saveData();

    // Change to Saved state
    btn.innerHTML = isDesktop ? "Saved! ✓" : `<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
    btn.classList.remove('opacity-75', 'cursor-not-allowed');
    
    setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }, 2000);
};
document.getElementById('btn-save-desk')?.addEventListener('click', handleManualSave);
document.getElementById('btn-save-mob')?.addEventListener('click', handleManualSave);

// ==========================================
// IGNITION SWITCH (WELCOME MODAL)
// ==========================================
document.getElementById('btn-welcome-fresh')?.addEventListener('click', () => {
    const rawAmt = Utils.parseNum(document.getElementById('welcome-initial-cap').value);
    
    Utils.executeWithLoader(() => {
        // Seed initial capital if the user provided an amount
        if (rawAmt > 0) {
            AppState.brokerCash = rawAmt;
            AppState.fundingLog.unshift({ 
                id: Date.now(), 
                date: new Date().toLocaleDateString('en-US'), 
                amount: rawAmt,
                type: 'Initial Capital', 
                remarks: 'Starting Sandbox Capital' 
            });
        }

        // Hide the welcome modal smoothly
        const modal = document.getElementById('welcome-modal');
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 300);

        // Initialize UI, trigger engine, and auto-save to cloud
        renderTabs(); 
        switchTab(0); 
        window.switchMainView('dashboard'); 
        masterSync();
    });
});
