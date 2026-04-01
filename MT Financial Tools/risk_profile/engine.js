import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- FIREBASE INITIALIZATION ---
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

/**
 * MT OS: Structural Risk Assessment Sandbox v1.6 (Engine - SaaS Module)
 * Architecture: Strict MVC + Stable Baseline + Copywriting Polish + Firestore Auth
 */

// --- CHART.JS CUSTOM PLUGINS ---

// 1. Center Text Plugin for Doughnuts
const centerTextPlugin = {
    id: 'centerText',
    beforeDraw: function(chart) {
        if (chart.config.options.elements && chart.config.options.elements.center) {
            let ctx = chart.ctx;
            let centerConfig = chart.config.options.elements.center;
            
            let isDark = document.documentElement.classList.contains('dark');
            let color1 = centerConfig.color1 || (isDark ? '#94a3b8' : '#64748b');
            let color2 = centerConfig.color2 || (isDark ? '#ffffff' : '#0f172a');
            
            ctx.save();
            
            // Top Label
            ctx.font = "bold 10px 'Inter', sans-serif";
            ctx.fillStyle = color1;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            let centerX = ((chart.chartArea.left + chart.chartArea.right) / 2);
            let centerY = ((chart.chartArea.top + chart.chartArea.bottom) / 2);
            
            ctx.fillText(centerConfig.text1, centerX, centerY - 12);
            
            // Bottom Value
            ctx.font = "bold 16px 'JetBrains Mono', monospace";
            ctx.fillStyle = color2;
            ctx.fillText(centerConfig.text2, centerX, centerY + 10);
            
            ctx.restore();
        }
    }
};

// 2. Vertical Horizon Line Plugin for Projection Chart
const horizonLinePlugin = {
    id: 'horizonLine',
    afterDraw: function(chart) {
        if (chart.config.options.plugins.horizonLine && chart.config.options.plugins.horizonLine.draw) {
            let ctx = chart.ctx;
            let horizonIndex = chart.config.options.plugins.horizonLine.horizonIndex;
            let meta = chart.getDatasetMeta(0);
            
            // Ensure the index exists in the current viewed data slice
            if (meta && meta.data && meta.data[horizonIndex]) {
                let xPos = meta.data[horizonIndex].x;
                let topY = chart.chartArea.top;
                let bottomY = chart.chartArea.bottom;
                
                ctx.save();
                
                // Draw Line
                ctx.beginPath();
                ctx.moveTo(xPos, topY);
                ctx.lineTo(xPos, bottomY);
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'; // Red-500
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                
                // Draw Background Pill & Text Inside Chart Bounds
                let text = "HORIZON";
                ctx.font = "bold 9px 'Inter', sans-serif";
                let textWidth = ctx.measureText(text).width;
                let bgWidth = textWidth + 12;
                let bgHeight = 16;
                let bgX = xPos - (bgWidth / 2);
                let bgY = topY + 8; 
                
                // Draw Pill Background
                let isDark = document.documentElement.classList.contains('dark');
                ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)';
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(bgX, bgY, bgWidth, bgHeight, 4);
                } else {
                    ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
                }
                ctx.fill();
                
                // Draw Text
                ctx.fillStyle = 'rgba(239, 68, 68, 1)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, xPos, bgY + (bgHeight / 2));
                
                ctx.restore();
            }
        }
    }
};

Chart.register(centerTextPlugin, horizonLinePlugin);

// --- 1. GLOBAL STATE & UTILITIES ---
let currentGlobalData = null; 
let maxCalculatedLevel = 5; 
let userInputsState = null; 

let globalYields = {
    cash: 0.028,
    fixed: 0.065,
    reit: 0.08,
    blue: 0.10,
    second: 0.12,
    third: 0.15,
    crypto: 0.20
};

function formatCurrency(input) {
    let value = input.value.replace(/[^0-9]/g, '');
    if (value !== '') {
        input.value = parseInt(value, 10).toLocaleString('en-US');
    } else {
        input.value = '';
    }
}

function updateTargetAgeSliderMin() {
    const currentAge = parseInt(document.getElementById('f_age').value);
    const targetSlider = document.getElementById('f_targetAge');
    const minTarget = currentAge + 5;
    
    targetSlider.min = minTarget;
    
    if (parseInt(targetSlider.value) < minTarget) {
        targetSlider.value = minTarget;
        document.getElementById('val_targetAge').textContent = minTarget;
    }
}

function formatValueShorthand(value) {
    if (value >= 1e15) return '₱' + (value / 1e15).toFixed(2).replace(/\.00$/, '') + 'Q';
    if (value >= 1e12) return '₱' + (value / 1e12).toFixed(2).replace(/\.00$/, '') + 'T';
    if (value >= 1e9) return '₱' + (value / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
    if (value >= 1e6) return '₱' + (value / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
    if (value >= 1e3) return '₱' + (value / 1e3).toFixed(0) + 'k';
    return '₱' + value.toLocaleString();
}

const UI = {
    form: document.getElementById('architectForm'),
    initLock: document.getElementById('btnInitiateLock'),
    resetBtnConfirm: document.getElementById('btnResetConfirm'),
    exportBtn: document.getElementById('btnExport'),
    thermostat: document.getElementById('riskThermostat'),
    thermostatBox: document.getElementById('thermostatContainer'),
    thermostatLabel: document.getElementById('thermostatLabel'),
    thermostatMaxLabel: document.getElementById('thermostatMaxLabel'),
    navDashboard: document.getElementById('navDashboard')
};

// --- 2. THE MATHEMATICIAN (Strict MVC Engine) ---
const MathEngine = {
    
    parseCurrency: function(val) { 
        return parseInt(val.toString().replace(/,/g, ''), 10) || 0; 
    },
    
    processInputs: function(inputs, overrideLevel, yields, isRealWealth) {
        
        const safeAge = inputs.age || 35;
        const safePrereq = inputs.prereq || 'debt'; 
        const safeIncStab = inputs.incStab || 'none';
        const safeHorizon = inputs.horizon || 10;
        const safeJurisdiction = inputs.jurisdiction || 'local';
        const safeScars = isNaN(inputs.scars) ? 0 : inputs.scars;
        const safePedigree = inputs.pedigree || 'social';
        const safeTolerance = inputs.tolerance || 'C'; 

        let rawScore = 0;
        const capMass = this.parseCurrency(inputs.capital);
        const velocity = this.parseCurrency(inputs.velocity);
        
        let effectiveIncStab = safeIncStab;
        if (safeIncStab === 'pension' && safeAge < 45) {
            effectiveIncStab = 'corp';
        }

        if (safeAge <= 35) rawScore += 20;
        else if (safeAge <= 45) rawScore += 15;
        else if (safeAge <= 55) rawScore += 10;
        else if (safeAge <= 65) rawScore += 5;
        else rawScore += 0;

        if (safeHorizon >= 15) rawScore += 20;
        else if (safeHorizon >= 10) rawScore += 15;
        else if (safeHorizon >= 5) rawScore += 10;
        else rawScore += 5;

        if (effectiveIncStab === 'pension') rawScore += 25;
        else if (effectiveIncStab === 'corp') rawScore += 20;
        else if (effectiveIncStab === 'freelance') rawScore += 10;
        else rawScore += 0;

        if (velocity >= 100000) rawScore += 20;
        else if (velocity >= 50000) rawScore += 18;
        else if (velocity >= 20000) rawScore += 15;
        else if (velocity >= 10000) rawScore += 10;
        else rawScore += 5;

        let scarsScore = 0; 
        let pedScore = 0;
        
        if (safeScars == 5) scarsScore = 10;
        else if (safeScars == 3) scarsScore = 7;
        else if (safeScars == 1) scarsScore = 3;
        
        if (safePedigree === 'pro') pedScore = 10;
        else if (safePedigree === 'student') pedScore = 8;
        else if (safePedigree === 'reader') pedScore = 4;
        
        rawScore += (scarsScore + pedScore);
        const passesMastery = (safeScars >= 3 && (safePedigree === 'student' || safePedigree === 'pro'));

        let isScamAlert = false;
        if (capMass > 0 && velocity >= (capMass * 0.5)) isScamAlert = true; 
        else if (capMass === 0 && velocity >= 100000) isScamAlert = true; 

        let mathLevel = 0;
        if (rawScore <= 30) mathLevel = 1; 
        else if (rawScore <= 50) mathLevel = 2; 
        else if (rawScore <= 70) mathLevel = 3; 
        else mathLevel = 4; 

        if (mathLevel === 4 && passesMastery) mathLevel = 5;

        let isCriticalFailsafe = false;
        let failsafeMsg = "";
        let scenarioNarrative = "";
        let isYieldFlipped = false;
        let isRichYoung = false;
        
        let isZeroInputFailsafe = false;
        if (capMass === 0 && velocity === 0) isZeroInputFailsafe = true;

        if (safeAge >= 55) isYieldFlipped = true;
        if (safeAge < 40 && capMass >= 20000000) isRichYoung = true;

        if (isZeroInputFailsafe) {
            isCriticalFailsafe = true;
            mathLevel = 0;
            failsafeMsg = "Awaiting Capital Allocation";
            scenarioNarrative = `You must input either Starting Capital or a Monthly Contribution to generate a mathematical blueprint.`;
        } else if (safePrereq === 'debt' || safePrereq === 'no_ef') {
            isCriticalFailsafe = true;
            mathLevel = 0; 
            failsafeMsg = "Emergency Foundation Check Failed";
            if (safePrereq === 'debt') {
                scenarioNarrative = `Before we talk about compounding, we have to look at the math of your foundation. You are currently carrying high-interest debt. The stock market averages 8-10% a year, but consumer debt or unexpected emergencies can destroy that progress instantly. Mathematically, you cannot out-invest bad debt. I have restricted this portfolio to pure cash accumulation. Your best 'investment' right now is paying off liabilities and building a 3-month safety net so you are never forced to sell investments at a loss.`;
            } else {
                scenarioNarrative = `Before we talk about compounding, we have to look at the math of your foundation. You are currently lacking a solid cash buffer. The stock market averages 8-10% a year, but unexpected emergencies can destroy that progress instantly if you are forced to sell. I have restricted this portfolio to pure cash accumulation. Your best 'investment' right now is building a 3-month safety net so you are never forced to sell investments at a loss.`;
            }
        } else if (safeHorizon < 3) {
            mathLevel = Math.min(mathLevel, 1);
            scenarioNarrative = `Because you need to withdraw this money in less than 3 years, you mathematically cannot afford a stock market drawdown. Even a temporary crash could destroy your principal right when you need it. I have restricted your portfolio entirely to Capital Preservation (Cash and Fixed Income) to guarantee your capital is intact.`;
        } else if (safeHorizon < 5) {
            mathLevel = Math.min(mathLevel, 2);
            scenarioNarrative = `With a timeline of less than 5 years, we must strictly limit your exposure to market volatility. I have capped your capacity at Conservative Income, ensuring the majority of your funds remain in fixed yield, with equity exposure strictly limited to stable assets.`;
        } else if (isYieldFlipped) {
            if (effectiveIncStab === 'pension') {
                scenarioNarrative = `Typically, at your age, I would severely restrict your stock market exposure. However, your guaranteed pension acts mathematically like a secure bond. This gives us the structural capacity to keep a portion of your portfolio in dividend-paying assets to help you fight long-term inflation without risking your standard of living.`;
            } else {
                mathLevel = Math.min(mathLevel, 2); 
                scenarioNarrative = `Because your timeline is shortening, I have mathematically reduced your exposure to volatile growth stocks. A severe market drop right now would permanently damage your capital. Instead, we have structured your portfolio heavily around dividend-paying assets like REITs and secure fixed income. This provides you with stable cash flow so you don't have to rely on selling stocks to survive.`;
            }
        } else if (isRichYoung) {
            mathLevel = Math.min(mathLevel, 3); 
            scenarioNarrative = `Even though you are young, your starting capital fundamentally changes your risk profile. At this level of wealth, aggressive capital appreciation is no longer mathematically necessary. I have shifted your focus toward wealth preservation and generating passive yield, allowing you to live off the cash flow without taking unnecessary market risks.`;
        }

        let maxCalculatedLevel = mathLevel; 
        let q10Level = 5; 
        
        if (safeTolerance === 'A') q10Level = 1; 
        else if (safeTolerance === 'B') q10Level = 3; 

        let initialLevel = Math.min(maxCalculatedLevel, q10Level); 
        let finalLevel;
        
        if (overrideLevel !== null) {
            finalLevel = Math.min(maxCalculatedLevel, overrideLevel);
        } else {
            finalLevel = initialLevel;
        }

        if (finalLevel < maxCalculatedLevel && !isCriticalFailsafe) {
            let maxProfileName = "";
            if (maxCalculatedLevel === 1) maxProfileName = "Capital Preservation";
            else if (maxCalculatedLevel === 2) maxProfileName = "Conservative Income";
            else if (maxCalculatedLevel === 3) maxProfileName = "Balanced Growth";
            else if (maxCalculatedLevel === 4) maxProfileName = "Aggressive Growth";
            else if (maxCalculatedLevel === 5) maxProfileName = "Speculative Growth";
            
            scenarioNarrative = `Note: Your mathematical capacity allows for **${maxProfileName}**, but we started you at this safer level based on your personal preference. You can use the Risk Thermostat above to safely increase your exposure up to your mathematical limit.`;
        } else if (scenarioNarrative === "" && !isCriticalFailsafe) {
            scenarioNarrative = `Based on your timeline, capital size, and income stability, your mathematical capacity perfectly aligns with your structural reality. Stick to your monthly contributions, let time do the heavy lifting, and expect the normal market drawdowns shown in the red band of your projection chart.`;
        }

        let profileName = ""; 
        let assignedObjective = "";
        let macroPct = { cash: 0, fixed: 0, equity: 0 };
        let microPct = { reit: 0, blue: 0, second: 0, third: 0, crypto: 0 };

        if (finalLevel === 0) {
            profileName = "Liquidity Accumulation"; 
            assignedObjective = "Foundation Repair";
            macroPct = { cash: 100, fixed: 0, equity: 0 };
        } else if (finalLevel === 1) {
            profileName = "Capital Preservation"; 
            assignedObjective = "Total Preservation (Beat Inflation)";
            macroPct = { cash: 20, fixed: 80, equity: 0 }; 
        } else if (finalLevel === 2) {
            profileName = "Conservative Income"; 
            assignedObjective = "Preservation with some growth";
            macroPct = { cash: 20, fixed: 40, equity: 40 }; 
            microPct = { reit: 50, blue: 50, second: 0, third: 0, crypto: 0 };
        } else if (finalLevel === 3) {
            profileName = "Balanced Growth"; 
            assignedObjective = "Income and Growth (50/50)";
            macroPct = { cash: 15, fixed: 25, equity: 60 }; 
            microPct = { reit: 50, blue: 50, second: 0, third: 0, crypto: 0 };
        } else if (finalLevel === 4) {
            profileName = "Aggressive Growth"; 
            assignedObjective = "Growth focused";
            macroPct = { cash: 10, fixed: 10, equity: 80 }; 
            microPct = { reit: 0, blue: 50, second: 50, third: 0, crypto: 0 };
        } else if (finalLevel === 5) {
            profileName = "Speculative Growth"; 
            assignedObjective = "Maximum Growth (Tactical)";
            macroPct = { cash: 5, fixed: 5, equity: 90 }; 
            microPct = { reit: 0, blue: 0, second: 30, third: 70, crypto: 0 }; 
        }

        if (finalLevel > 1) {
            if (isYieldFlipped && effectiveIncStab === 'pension') {
                microPct = { reit: 80, blue: 20, second: 0, third: 0, crypto: 0 };
            } else if (isYieldFlipped) {
                microPct = { reit: 100, blue: 0, second: 0, third: 0, crypto: 0 };
            } else if (isRichYoung) {
                microPct = { reit: 70, blue: 30, second: 0, third: 0, crypto: 0 };
            }
        }

        let blueLabel = "PSEi Blue Chips"; 
        let divLabel = "Dividend Stocks / REITs";
        
        if (safeJurisdiction === 'ofw') { 
            blueLabel = "PSEi Blue Chips & US ETFs"; 
            divLabel = "PSE REITs & US Div ETFs"; 
        } else if (safeJurisdiction === 'local') { 
            blueLabel = "PSEi & PH Feeder Funds"; 
        } else if (safeJurisdiction === 'vpn') { 
            blueLabel = "PSEi & PH Feeder Funds"; 
            scenarioNarrative += ` Note: Using VPNs exposes you to account freezes. Global allocation securely routed to local feeder funds.`; 
        }

        let fixedLabel = "Fixed (Pag-IBIG MP2 / Long Bonds)";
        if (safeHorizon < 5) {
            fixedLabel = "Fixed (Time Deposits / Short RTBs)";
            if (safeHorizon < 3 && !isCriticalFailsafe && finalLevel > 1) { 
                macroPct.cash += macroPct.fixed; 
                macroPct.fixed = 0; 
            }
        }

        let effectiveBase = capMass > 0 ? capMass : (velocity > 0 ? velocity : 0);

        let macroVal = { 
            cash: effectiveBase * (macroPct.cash / 100), 
            fixed: effectiveBase * (macroPct.fixed / 100), 
            equity: effectiveBase * (macroPct.equity / 100) 
        };
        
        let microVal = { 
            reit: macroVal.equity * (microPct.reit / 100), 
            blue: macroVal.equity * (microPct.blue / 100), 
            second: macroVal.equity * (microPct.second / 100), 
            third: macroVal.equity * (microPct.third / 100), 
            crypto: 0 
        };

        if (passesMastery && finalLevel >= 3 && !isCriticalFailsafe && !isYieldFlipped && !isRichYoung) {
            let cryptoLimit = 0;
            if (finalLevel === 3) cryptoLimit = 0.02; 
            else if (finalLevel === 4) cryptoLimit = 0.05; 
            else if (finalLevel === 5) cryptoLimit = 0.10; 
            
            let targetCryptoVal = effectiveBase * cryptoLimit;
            
            if (finalLevel === 5) { 
                microVal.crypto = Math.min(targetCryptoVal, microVal.third); 
                microVal.third -= microVal.crypto; 
            } else if (finalLevel === 4) { 
                microVal.crypto = Math.min(targetCryptoVal, microVal.second); 
                microVal.second -= microVal.crypto; 
            } else if (finalLevel === 3) { 
                microVal.crypto = Math.min(targetCryptoVal, microVal.blue); 
                microVal.blue -= microVal.crypto; 
            }
        }

        let displayPct = {
            reit: macroVal.equity > 0 ? (microVal.reit / macroVal.equity) * 100 : 0,
            blue: macroVal.equity > 0 ? (microVal.blue / macroVal.equity) * 100 : 0,
            second: macroVal.equity > 0 ? (microVal.second / macroVal.equity) * 100 : 0,
            third: macroVal.equity > 0 ? (microVal.third / macroVal.equity) * 100 : 0,
            crypto: macroVal.equity > 0 ? (microVal.crypto / macroVal.equity) * 100 : 0
        };

        let yieldCash = yields.cash;
        let yieldFixed = yields.fixed;
        let yieldReit = yields.reit * 0.85; 
        let yieldBlue = yields.blue * 0.25; 
        
        let actualMacroVal = { 
            cash: capMass * (macroPct.cash / 100), 
            fixed: capMass * (macroPct.fixed / 100), 
            equity: capMass * (macroPct.equity / 100) 
        };
        let actualMicroVal = { 
            reit: actualMacroVal.equity * (microPct.reit / 100), 
            blue: actualMacroVal.equity * (microPct.blue / 100)
        };
        
        let projectedCashFlow = (actualMacroVal.cash * yieldCash) + (actualMacroVal.fixed * yieldFixed) + (actualMicroVal.reit * yieldReit) + (actualMicroVal.blue * yieldBlue);
        
        let totalExpectedCAGR = yields.cash;
        if (effectiveBase > 0) {
            let totalReturnPHP = (macroVal.cash * yields.cash) + (macroVal.fixed * yields.fixed) + (microVal.reit * yields.reit) + (microVal.blue * yields.blue) + (microVal.second * yields.second) + (microVal.third * yields.third) + (microVal.crypto * yields.crypto);
            totalExpectedCAGR = totalReturnPHP / effectiveBase;
        }

        let focus, selective, avoid;
        if (isZeroInputFailsafe) {
            focus = "N/A"; selective = "N/A"; avoid = "N/A"; 
        } else if (isCriticalFailsafe) {
            focus = "High-Yield Digital Banks, paying off high-interest debt."; 
            selective = "Building a 3 to 6-month cash emergency fund."; 
            avoid = "ALL Stock Market Assets & Crypto."; 
        } else if (finalLevel === 1) {
            focus = "Fundamental Analysis. Focus entirely on guaranteed yields and capital preservation vehicles."; 
            selective = "Re-investing dividends directly back into the principal."; 
            avoid = "All Equities. You cannot afford a stock market drawdown at this level.";
        } else if (finalLevel <= 3) {
            focus = "Fundamental Analysis. Analyze Earnings Reports, Cash Flows, and Dividend Yield histories."; 
            selective = "Peso Cost Averaging into Blue Chips, accumulating heavily when dividend yields rise above bank interest rates."; 
            avoid = "Day trading, Technical Analysis reliance, and all speculative/momentum plays."; 
        } else {
            focus = "Technical Analysis. Focus on volume, breakouts, structural chart patterns, and momentum."; 
            selective = "Position Trading and Swing Trading Second & Third Liners with strict Risk Management."; 
            avoid = "Holding volatile assets without a hard Stop-Loss. Do not turn a bad trade into a long-term investment."; 
        }

        let maxProjectionYears = Math.max(90 - safeAge, 10);
        let projData = { 
            labels: [], 
            base: [], 
            nominalBase: [], 
            bull: [], 
            bear: [], 
            decay: [] 
        };
        
        let capBase = capMass;
        let capBull = capMass;
        let capBear = capMass;
        let capDecay = capMass;
        
        let bullCAGR = totalExpectedCAGR + 0.03; 
        let bearCAGR = totalExpectedCAGR - 0.02; 
        let bearShock = (macroPct.equity / 100) * 0.40; 
        
        const inflationRate = 0.04;

        for(let i = 0; i <= maxProjectionYears; i++) {
            projData.labels.push(`Age ${safeAge + i}`);
            
            let discount = isRealWealth ? Math.pow(1 + inflationRate, i) : 1;

            projData.nominalBase.push(Math.round(capBase));
            projData.base.push(Math.round(capBase / discount)); 
            projData.bull.push(Math.round(capBull / discount));
            projData.bear.push(Math.round(capBear / discount)); 
            projData.decay.push(Math.round(capDecay / discount));

            capBase = (capBase + (velocity * 12)) * (1 + totalExpectedCAGR);
            capBull = (capBull + (velocity * 12)) * (1 + bullCAGR);
            
            if (i === 1) {
                capBear = (capBear + (velocity * 12)) * (1 - bearShock); 
            } else {
                capBear = (capBear + (velocity * 12)) * (1 + bearCAGR);
            }
            
            capDecay = (capDecay + (velocity * 12)) * (1 - inflationRate); 
        }

        const assetDesc = {
            'Cash / HYSA / EF': "High-Yield Savings Accounts and Cash equivalents.", 
            'Fixed (Pag-IBIG MP2 / Long Bonds)': "Government-backed guaranteed yield vehicles.", 
            'Fixed (Time Deposits / Short RTBs)': "Short-term fixed yield to protect capital needed soon.", 
            'Total Equities': "Total capital exposed to stock market growth and volatility.",
            [divLabel]: "Real Estate Investment Trusts and high-dividend yielding equities.", 
            [blueLabel]: "Top 30 largest companies and broad market indices.", 
            'Second Liners (Tactical)': "Mid-cap growth stocks with higher volatility.", 
            'Third Liners / Speculative': "Highly speculative, low-cap momentum stocks.", 
            'Crypto Majors': "Bitcoin and Ethereum, strictly capped to asymmetric allocation."
        };

        return {
            score: isCriticalFailsafe ? "N/A" : Math.round(rawScore), 
            maxCalculatedLevel: maxCalculatedLevel, 
            finalLevel: finalLevel,
            profileName: profileName, 
            assignedObjective: assignedObjective,
            projectedYield: isCriticalFailsafe ? 0 : projectedCashFlow, 
            cagrPct: isCriticalFailsafe ? 0 : (totalExpectedCAGR * 100),
            totalCapital: capMass, 
            monthlyVelocity: velocity,
            horizon: safeHorizon,
            chartBase: effectiveBase,
            totalEquity: macroVal.equity,
            scamAlert: { active: isScamAlert },
            
            macroData: [ 
                { label: 'Cash / HYSA / EF', val: macroVal.cash, pct: macroPct.cash, color: '#0ea5e9', desc: assetDesc['Cash / HYSA / EF'] }, 
                { label: fixedLabel, val: macroVal.fixed, pct: macroPct.fixed, color: '#3b82f6', desc: assetDesc[fixedLabel] }, 
                { label: 'Total Equities', val: macroVal.equity, pct: macroPct.equity, color: '#3E8E35', desc: assetDesc['Total Equities'] } 
            ].filter(d => d.val > 0),
            
            microData: [ 
                { label: divLabel, val: microVal.reit, pct: displayPct.reit, color: '#10b981', desc: assetDesc[divLabel] }, 
                { label: blueLabel, val: microVal.blue, pct: displayPct.blue, color: '#3b82f6', desc: assetDesc[blueLabel] }, 
                { label: 'Second Liners (Tactical)', val: microVal.second, pct: displayPct.second, color: '#f59e0b', desc: assetDesc['Second Liners (Tactical)'] }, 
                { label: 'Third Liners / Speculative', val: microVal.third, pct: displayPct.third, color: '#f97316', desc: assetDesc['Third Liners / Speculative'] }, 
                { label: 'Crypto Majors', val: microVal.crypto, pct: displayPct.crypto, color: '#ef4444', desc: assetDesc['Crypto Majors'] } 
            ].filter(d => d.val > 0),
            
            failsafe: { active: isCriticalFailsafe, msg: failsafeMsg }, 
            focus: focus, selective: selective, avoid: avoid, 
            narrative: scenarioNarrative, projection: projData 
        };
    }
};

// --- 3. THE PAINTER (UI & DOM Renderer) ---
const Painter = {
    charts: { macro: null, micro: null, proj: null },

    toggleTheme: function() {
        const html = document.documentElement;
        html.classList.toggle('dark');
        const isDark = html.classList.contains('dark');
        
        const icon = document.getElementById('iconTheme');
        if(isDark) {
            icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
        } else {
            icon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
        }
        
        if (currentGlobalData) this.paintDashboard(currentGlobalData, false);
    },

    switchView: function(viewId, btnElement) {
        document.querySelectorAll('.view-section').forEach(el => {
            el.classList.remove('active');
        });
        
        document.getElementById(viewId).classList.add('active');
        
        if (btnElement) {
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            btnElement.classList.add('active');
        }
        
        document.getElementById('scrollableMain').scrollTo(0, 0);
    },

    paintDashboard: function(data, resetTargetAge = true) {
        document.getElementById('outProfile').textContent = data.profileName;
        
        document.getElementById('outScore').textContent = isNaN(data.score) ? data.score : `${data.score}/100`;
        document.getElementById('outScore').className = isNaN(data.score) ? 'text-2xl sm:text-3xl font-bold text-amber-500 number-font block' : 'text-2xl sm:text-3xl font-bold text-mtGreen number-font block';
        
        document.getElementById('outYield').textContent = `₱${Math.round(data.projectedYield).toLocaleString()} / yr`;
        document.getElementById('outCAGR').textContent = `${data.cagrPct.toFixed(1)}% CAGR`;

        const failsafeUI = document.getElementById('outFailsafe');
        const scamAlertUI = document.getElementById('outScamAlert');
        const thermostatBox = document.getElementById('thermostatContainer');
        
        if (data.failsafe.active) { 
            failsafeUI.classList.remove('hidden'); 
            document.getElementById('outFailsafeText').textContent = data.failsafe.msg; 
            thermostatBox.classList.add('hidden'); 
        } else { 
            failsafeUI.classList.add('hidden'); 
            thermostatBox.classList.remove('hidden'); 
        }

        if (data.scamAlert.active && !data.failsafe.active) {
            scamAlertUI.classList.remove('hidden');
        } else {
            scamAlertUI.classList.add('hidden');
        }

        document.getElementById('outFocus').textContent = data.focus;
        document.getElementById('outSelective').textContent = data.selective;
        document.getElementById('outAvoid').textContent = data.avoid;
        
        document.getElementById('outNarrative').innerHTML = data.narrative.replace(/\*\*(.*?)\*\*/g, '<span class="text-slate-900 dark:text-white font-bold">$1</span>');

        this.paintDoughnut('macroChart', 'macroLegend', data.macroData, data.failsafe.active, {
            text1: data.totalCapital === 0 && data.chartBase > 0 ? '1ST MONTH BASE' : 'TOTAL CAPITAL',
            text2: formatValueShorthand(data.chartBase)
        });
        
        this.paintDoughnut('microChart', 'microLegend', data.microData, data.failsafe.active, {
            text1: data.totalCapital === 0 && data.chartBase > 0 ? '1ST MONTH EQUITY' : 'TOTAL EQUITY',
            text2: formatValueShorthand(data.totalEquity)
        });
        
        const currentAge = parseInt(document.getElementById('f_age').value);
        
        if (resetTargetAge) {
            const targetAgeSlider = document.getElementById('f_targetAge');
            if (parseInt(targetAgeSlider.value) < currentAge + 5) {
                targetAgeSlider.value = currentAge + 5;
                document.getElementById('val_targetAge').textContent = currentAge + 5;
            }
        }
        
        const targetAge = parseInt(document.getElementById('f_targetAge').value);
        const isLog = document.getElementById('toggleLog').checked;
        
        this.paintProjectionChart(data.projection, currentAge, targetAge, isLog, data.horizon);

        let yearsInvested = targetAge - currentAge;
        if (yearsInvested < 0) yearsInvested = 0;
        if (yearsInvested >= data.projection.nominalBase.length) {
            yearsInvested = data.projection.nominalBase.length - 1;
        }
        
        const outPocket = data.totalCapital + (data.monthlyVelocity * 12 * yearsInvested);
        const nominalTarget = data.projection.nominalBase[yearsInvested];
        let earned = nominalTarget - outPocket;
        
        document.getElementById('outPocket').textContent = `₱${outPocket.toLocaleString()}`;
        
        if (earned >= 0) {
            document.getElementById('outEarned').textContent = `₱${earned.toLocaleString()}`;
            document.getElementById('outEarned').className = 'text-lg font-bold text-mtGreen number-font';
        } else {
            document.getElementById('outEarned').textContent = `-₱${Math.abs(earned).toLocaleString()}`;
            document.getElementById('outEarned').className = 'text-lg font-bold text-red-500 number-font';
        }
    },

    paintDoughnut: function(canvasId, legendId, chartData, isFailsafe, centerData) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        if (this.charts[canvasId]) this.charts[canvasId].destroy();
        
        const legendContainer = document.getElementById(legendId); 
        legendContainer.innerHTML = '';

        if (chartData.length === 0 || (isFailsafe && canvasId === 'microChart')) {
            legendContainer.innerHTML = '<div class="text-slate-400 text-center text-xs mt-4">Allocation Restricted</div>'; 
            return; 
        }

        const labels = chartData.map(d => d.label);
        const vals = chartData.map(d => d.val);
        const colors = chartData.map(d => d.color);
        
        chartData.forEach(d => {
            let displayPct = isNaN(d.pct) ? "0" : d.pct.toFixed(1).replace(/\.0$/, ''); 
            legendContainer.innerHTML += `
                <div class="flex justify-between items-center text-[10px] sm:text-[11px] mt-1.5 border-b border-slate-100 dark:border-slate-700/50 pb-1.5">
                    <span class="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-sans">
                        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${d.color}"></span>
                        <span class="truncate pr-2 asset-tooltip font-bold" title="${d.desc}">${d.label}</span>
                    </span>
                    <div class="flex flex-col items-end">
                        <span class="text-slate-900 dark:text-white font-bold tracking-wider number-font">₱${Math.round(d.val).toLocaleString()}</span>
                        <span class="text-[9px] text-slate-400 font-bold">${displayPct}%</span>
                    </div>
                </div>`;
        });

        this.charts[canvasId] = new Chart(ctx, {
            type: 'doughnut', 
            data: { labels: labels, datasets: [{ data: vals, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
            options: { 
                responsive: true, maintainAspectRatio: false, cutout: '65%', 
                plugins: { 
                    legend: { display: false }, 
                    tooltip: { 
                        position: 'nearest', align: 'center',
                        bodyFont: { family: "'JetBrains Mono', monospace" }, 
                        callbacks: { label: function(c) { return ` ₱${c.raw.toLocaleString()}`; } } 
                    } 
                },
                elements: { center: centerData }
            }
        });
    },

    paintProjectionChart: function(fullProjData, currentAge, targetAge, isLogarithmic, horizonYears) {
        const ctx = document.getElementById('projectionChart').getContext('2d');
        
        if (this.charts.proj) this.charts.proj.destroy();

        let maxIndex = targetAge - currentAge;
        if (maxIndex <= 0) maxIndex = 5; 
        if (maxIndex >= fullProjData.labels.length) maxIndex = fullProjData.labels.length - 1;

        const slicedData = {
            labels: fullProjData.labels.slice(0, maxIndex + 1),
            bull: fullProjData.bull.slice(0, maxIndex + 1),
            base: fullProjData.base.slice(0, maxIndex + 1),
            bear: fullProjData.bear.slice(0, maxIndex + 1),
            decay: fullProjData.decay.slice(0, maxIndex + 1)
        };

        const isDark = document.documentElement.classList.contains('dark');
        Chart.defaults.color = isDark ? '#94a3b8' : '#64748b'; 
        Chart.defaults.font.family = "'Inter', sans-serif";

        this.charts.proj = new Chart(ctx, {
            type: 'line',
            data: {
                labels: slicedData.labels,
                datasets: [
                    { label: 'Bull Cycle', data: slicedData.bull, borderColor: '#10b981', borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, tension: 0.4 },
                    { label: 'Expected Growth', data: slicedData.base, borderColor: '#3E8E35', backgroundColor: 'rgba(62, 142, 53, 0.15)', borderWidth: 3, fill: true, pointRadius: 0, tension: 0.4 },
                    { label: 'Bear Shock', data: slicedData.bear, borderColor: '#ef4444', borderWidth: 1.5, pointRadius: 0, tension: 0.4 },
                    { label: 'Cash Value (After Inflation)', data: slicedData.decay, borderColor: '#cbd5e1', borderDash: [2, 4], borderWidth: 2, pointRadius: 0, tension: 0.4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, 
                interaction: { mode: 'index', intersect: false },
                plugins: { 
                    legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, padding: 15, font: { size: 10 } } }, 
                    tooltip: { position: 'nearest', align: 'center', callbacks: { label: function(c) { return ` ${c.dataset.label}: ₱${c.raw.toLocaleString()}`; } } },
                    horizonLine: { draw: (horizonYears !== undefined && horizonYears <= maxIndex), horizonIndex: horizonYears }
                },
                scales: { 
                    y: { 
                        type: isLogarithmic ? 'logarithmic' : 'linear', display: true, 
                        grid: { color: isDark ? '#334155' : '#e2e8f0', drawBorder: false }, 
                        ticks: { 
                            font: { family: "'JetBrains Mono', monospace", size: 10 }, 
                            callback: function(v) { 
                                if(v >= 1e15) return '₱'+(v/1e15).toFixed(1) + 'Q'; 
                                if(v >= 1e12) return '₱'+(v/1e12).toFixed(1) + 'T'; 
                                if(v >= 1e9) return '₱'+(v/1e9).toFixed(1) + 'B'; 
                                if(v >= 1e6) return '₱'+(v/1e6).toFixed(1) + 'M'; 
                                if(v >= 1e3) return '₱'+(v/1e3).toFixed(0) + 'k'; 
                                return v; 
                            } 
                        } 
                    }, 
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } } 
                }
            }
        });
    }
};

// --- 4. STATE MANAGEMENT (Firestore) ---
async function saveToStorage(overrideLevel) {
    const uiState = {
        targetAge: document.getElementById('f_targetAge').value,
        isLog: document.getElementById('toggleLog').checked,
        isRealWealth: document.getElementById('toggleRealWealth').checked
    };

    const data = {
        inputs: userInputsState,
        override: overrideLevel,
        yields: globalYields,
        ui: uiState
    };
    
    localStorage.setItem('mtos_sandbox_state', JSON.stringify(data));
    
    if (currentUser) {
        try {
            const userRef = doc(db, 'users', currentUser.uid);
            await setDoc(userRef, { riskAssessmentState: data }, { merge: true });
            
            const indicator = document.getElementById('saveIndicator');
            if(indicator) {
                indicator.style.opacity = '1';
                setTimeout(() => { indicator.style.opacity = '0'; }, 2000);
            }
        } catch (error) {
            console.error("Error saving to cloud:", error);
        }
    }
}

async function loadCloudProfile() {
    if (!currentUser) return;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists() && docSnap.data().riskAssessmentState) {
            const data = docSnap.data().riskAssessmentState;
            applyLoadedData(data);
        } else {
            const saved = localStorage.getItem('mtos_sandbox_state');
            if (saved) applyLoadedData(JSON.parse(saved));
        }
    } catch (error) {
        console.error("Error loading from cloud:", error);
    }
}

function applyLoadedData(data) {
    userInputsState = data.inputs;
    if (data.yields) globalYields = data.yields;

    if (data.ui) {
        const fTarget = document.getElementById('f_targetAge');
        const vTarget = document.getElementById('val_targetAge');
        const tLog = document.getElementById('toggleLog');
        const tReal = document.getElementById('toggleRealWealth');
        
        if(fTarget) fTarget.value = data.ui.targetAge;
        if(vTarget) vTarget.textContent = data.ui.targetAge;
        if(tLog) tLog.checked = data.ui.isLog;
        if(tReal) tReal.checked = data.ui.isRealWealth;
    }
    
    const fAge = document.getElementById('f_age');
    const vAge = document.getElementById('val_age');
    if(fAge) fAge.value = userInputsState.age;
    if(vAge) vAge.textContent = userInputsState.age + (userInputsState.age == 80 ? '+' : '');
    
    const fCap = document.getElementById('f_capital');
    if(fCap) fCap.value = userInputsState.capital.toLocaleString();
    
    const fVel = document.getElementById('f_velocity');
    if(fVel) fVel.value = userInputsState.velocity.toLocaleString();
    
    const fHor = document.getElementById('f_horizon');
    const vHor = document.getElementById('val_horizon');
    if(fHor) fHor.value = userInputsState.horizon;
    if(vHor) vHor.textContent = userInputsState.horizon + (userInputsState.horizon == 20 ? '+ Yrs' : ' Yrs');
    
    if(document.querySelector(`input[name="f_prereq"][value="${userInputsState.prereq}"]`)) document.querySelector(`input[name="f_prereq"][value="${userInputsState.prereq}"]`).checked = true;
    if(document.querySelector(`input[name="f_incStab"][value="${userInputsState.incStab}"]`)) document.querySelector(`input[name="f_incStab"][value="${userInputsState.incStab}"]`).checked = true;
    if(document.querySelector(`input[name="f_jurisdiction"][value="${userInputsState.jurisdiction}"]`)) document.querySelector(`input[name="f_jurisdiction"][value="${userInputsState.jurisdiction}"]`).checked = true;
    if(document.querySelector(`input[name="f_scars"][value="${userInputsState.scars}"]`)) document.querySelector(`input[name="f_scars"][value="${userInputsState.scars}"]`).checked = true;
    if(document.querySelector(`input[name="f_pedigree"][value="${userInputsState.pedigree}"]`)) document.querySelector(`input[name="f_pedigree"][value="${userInputsState.pedigree}"]`).checked = true;
    if(document.querySelector(`input[name="f_tolerance"][value="${userInputsState.tolerance}"]`)) document.querySelector(`input[name="f_tolerance"][value="${userInputsState.tolerance}"]`).checked = true;

    const yCash = document.getElementById('y_cash');
    const yFixed = document.getElementById('y_fixed');
    const yReit = document.getElementById('y_reit');
    const yBlue = document.getElementById('y_blue');
    const ySecond = document.getElementById('y_second');
    const yThird = document.getElementById('y_third');
    const yCrypto = document.getElementById('y_crypto');

    if(yCash) yCash.value = (globalYields.cash * 100).toFixed(1);
    if(yFixed) yFixed.value = (globalYields.fixed * 100).toFixed(1);
    if(yReit) yReit.value = (globalYields.reit * 100).toFixed(1);
    if(yBlue) yBlue.value = (globalYields.blue * 100).toFixed(1);
    if(ySecond) ySecond.value = (globalYields.second * 100).toFixed(1);
    if(yThird) yThird.value = (globalYields.third * 100).toFixed(1);
    if(yCrypto) yCrypto.value = (globalYields.crypto * 100).toFixed(1);

    if(UI.navDashboard) UI.navDashboard.disabled = true;
}

// --- 5. CONTROLLER & EVENTS ---

const welcomeModal = document.getElementById('welcomeModal');
if (welcomeModal && !localStorage.getItem('mtos_welcomed_v1_6')) {
    welcomeModal.style.display = 'flex';
}

const btnDismiss = document.getElementById('btnDismissWelcome');
if(btnDismiss) {
    btnDismiss.onclick = () => {
        if(welcomeModal) {
            welcomeModal.style.opacity = '0';
            setTimeout(() => {
                welcomeModal.style.display = 'none';
            }, 300);
        }
        localStorage.setItem('mtos_welcomed_v1_6', 'true');
    };
}

const iconTheme = document.getElementById('iconTheme');
if(iconTheme) {
    if (document.documentElement.classList.contains('dark')) {
        iconTheme.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    } else {
        iconTheme.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
    }
}

const btnTheme = document.getElementById('btnThemeToggle');
if(btnTheme) btnTheme.onclick = () => Painter.toggleTheme();

if(UI.resetBtnConfirm) {
    UI.resetBtnConfirm.onclick = () => {
        const rModal = document.getElementById('resetModal');
        if(rModal) rModal.style.display = 'flex';
    };
}

const btnConfirmReset = document.getElementById('btnConfirmReset');
if(btnConfirmReset) {
    btnConfirmReset.onclick = () => {
        localStorage.removeItem('mtos_sandbox_state');
        localStorage.removeItem('mtos_welcomed_v1_6');
        window.location.reload();
    };
}

const btnOpenSettings = document.getElementById('btnOpenSettings');
if(btnOpenSettings) {
    btnOpenSettings.onclick = () => {
        const sModal = document.getElementById('settingsModal');
        if(sModal) sModal.style.display = 'flex';
    };
}

function clampYield(val) {
    let parsed = parseFloat(val);
    if (isNaN(parsed)) parsed = 0;
    return Math.max(-1, Math.min(5, parsed / 100));
}

const btnSaveSettings = document.getElementById('btnSaveSettings');
if(btnSaveSettings) {
    btnSaveSettings.onclick = () => {
        globalYields.cash = clampYield(document.getElementById('y_cash').value);
        globalYields.fixed = clampYield(document.getElementById('y_fixed').value);
        globalYields.reit = clampYield(document.getElementById('y_reit').value);
        globalYields.blue = clampYield(document.getElementById('y_blue').value);
        globalYields.second = clampYield(document.getElementById('y_second').value);
        globalYields.third = clampYield(document.getElementById('y_third').value);
        globalYields.crypto = clampYield(document.getElementById('y_crypto').value);

        const sModal = document.getElementById('settingsModal');
        if(sModal) sModal.style.display = 'none';
        window.runArchitect(currentGlobalData ? currentGlobalData.finalLevel : null);
    };
}

if(UI.exportBtn) {
    UI.exportBtn.onclick = function() {
        const target = document.getElementById('exportTarget');
        if(!target) return;
        
        const isDark = document.documentElement.classList.contains('dark');
        const originalBg = target.style.backgroundColor;
        const originalPadding = target.style.padding;
        const originalBorderRadius = target.style.borderRadius;
        
        const glassPanels = target.querySelectorAll('.glass-panel');
        const originalFilters = [];
        const originalBgs = [];
        
        glassPanels.forEach(panel => {
            originalFilters.push(panel.style.backdropFilter || panel.style.webkitBackdropFilter);
            originalBgs.push(panel.style.backgroundColor);
            
            panel.style.backdropFilter = 'none';
            panel.style.webkitBackdropFilter = 'none';
            
            if (isDark) {
                panel.style.backgroundColor = '#1e293b'; 
            } else {
                panel.style.backgroundColor = '#ffffff'; 
            }
        });

        target.style.backgroundColor = isDark ? '#0f172a' : '#f8fafc';
        target.style.padding = '20px';
        target.style.borderRadius = '10px';

        setTimeout(() => {
            html2canvas(target, { 
                scale: 1.5, 
                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                useCORS: true,
                logging: false
            }).then(canvas => {
                let link = document.createElement('a');
                link.download = 'MT_Risk_Assessment_Blueprint.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                
                target.style.backgroundColor = originalBg;
                target.style.padding = originalPadding;
                target.style.borderRadius = originalBorderRadius;
                
                glassPanels.forEach((panel, i) => {
                    panel.style.backdropFilter = originalFilters[i];
                    panel.style.webkitBackdropFilter = originalFilters[i];
                    panel.style.backgroundColor = originalBgs[i]; 
                });
            }).catch(err => {
                console.error("Export failed:", err);
                alert("Export failed. Please try on a desktop browser.");
                
                target.style.backgroundColor = originalBg;
                target.style.padding = originalPadding;
                target.style.borderRadius = originalBorderRadius;
                glassPanels.forEach((panel, i) => {
                    panel.style.backdropFilter = originalFilters[i];
                    panel.style.webkitBackdropFilter = originalFilters[i];
                    panel.style.backgroundColor = originalBgs[i]; 
                });
            });
        }, 100);
    };
}

function initiateUnlockSequence() {
    if(UI.form) UI.form.classList.remove('locked-form');
    if(UI.initLock) {
        UI.initLock.textContent = "Execute Analysis";
        UI.initLock.onclick = initiateLockSequence;
    }
    if(UI.navDashboard) UI.navDashboard.disabled = true; 
    
    const activeNav = document.querySelector('.nav-btn.active');
    Painter.switchView('view-assessment', activeNav);
}

function initiateLockSequence() {
    if(UI.form) UI.form.classList.add('locked-form');
    if(UI.initLock) {
        UI.initLock.textContent = "Update Inputs";
        UI.initLock.onclick = initiateUnlockSequence;
    }
    
    if(UI.resetBtnConfirm) UI.resetBtnConfirm.classList.remove('hidden');
    if(UI.exportBtn) UI.exportBtn.classList.remove('hidden');
    
    if(UI.navDashboard) UI.navDashboard.disabled = false; 
    
    window.runArchitect(null);
    
    Painter.switchView('view-dashboard', UI.navDashboard);
}

document.querySelectorAll('.mt-input-trigger').forEach(input => {
    input.addEventListener('input', () => {
        if (UI.form && !UI.form.classList.contains('locked-form')) {
            if(UI.navDashboard) UI.navDashboard.disabled = true;
        }
    });
});

if(UI.initLock) UI.initLock.onclick = initiateLockSequence;

function updateProjectionView() {
    if (currentGlobalData) {
        window.runArchitect(currentGlobalData.finalLevel); 
    }
}

function handleThermostatChange() {
    if (userInputsState) {
        const requestedLevel = parseInt(UI.thermostat.value);
        window.runArchitect(requestedLevel);
    }
}

window.runArchitect = function(overrideLevel = null, resetTargetAge = true) {
    const toggleReal = document.getElementById('toggleRealWealth');
    const isRealWealth = toggleReal ? toggleReal.checked : false;

    if (overrideLevel === null) {
        userInputsState = {
            age: parseInt(document.getElementById('f_age')?.value || 35), 
            prereq: document.querySelector('input[name="f_prereq"]:checked')?.value || 'debt',
            capital: document.getElementById('f_capital')?.value || '0', 
            velocity: document.getElementById('f_velocity')?.value || '0',
            incStab: document.querySelector('input[name="f_incStab"]:checked')?.value || 'none', 
            horizon: parseInt(document.getElementById('f_horizon')?.value || 10),
            jurisdiction: document.querySelector('input[name="f_jurisdiction"]:checked')?.value || 'local', 
            scars: parseInt(document.querySelector('input[name="f_scars"]:checked')?.value || 0), 
            pedigree: document.querySelector('input[name="f_pedigree"]:checked')?.value || 'social', 
            tolerance: document.querySelector('input[name="f_tolerance"]:checked')?.value || 'C'
        };
    }
    
    currentGlobalData = MathEngine.processInputs(userInputsState, overrideLevel, globalYields, isRealWealth);
    
    if (!currentGlobalData.failsafe.active) {
        if(UI.thermostat) {
            UI.thermostat.max = currentGlobalData.maxCalculatedLevel;
            UI.thermostat.value = currentGlobalData.finalLevel;
        }
        if(UI.thermostatMaxLabel) UI.thermostatMaxLabel.textContent = `${currentGlobalData.maxCalculatedLevel} (Max)`;
        
        if (currentGlobalData.maxCalculatedLevel === 1) {
            if(UI.thermostat) UI.thermostat.disabled = true; 
            if(UI.thermostatLabel) {
                UI.thermostatLabel.textContent = "SAFE LIMIT REACHED";
                UI.thermostatLabel.className = "text-[10px] font-bold text-slate-500 bg-slate-200 dark:bg-slate-700 uppercase tracking-wide px-2 py-0.5 rounded";
            }
        } else {
            if(UI.thermostat) UI.thermostat.disabled = false;
            if (currentGlobalData.finalLevel < currentGlobalData.maxCalculatedLevel) {
                if(UI.thermostatLabel) {
                    UI.thermostatLabel.textContent = "DOWNGRADED (SAFE)";
                    UI.thermostatLabel.className = "text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 uppercase tracking-wide px-2 py-0.5 rounded";
                }
            } else {
                if(UI.thermostatLabel) {
                    UI.thermostatLabel.textContent = "MAX ALLOWED";
                    UI.thermostatLabel.className = "text-[10px] font-bold text-mtGreen bg-emerald-100 dark:bg-emerald-900/30 uppercase tracking-wide px-2 py-0.5 rounded";
                }
            }
        }
    }

    saveToStorage(currentGlobalData.finalLevel);
    Painter.paintDashboard(currentGlobalData, overrideLevel === null && resetTargetAge);
};

// --- FIREBASE AUTH LISTENER & INITIALIZATION ---
updateTargetAgeSliderMin();

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadCloudProfile();
    } else {
        // Force redirect to the centralized master login page
        window.location.href = "../index.html";
    }
});
// ==========================================
// EXPOSE FUNCTIONS TO WINDOW FOR HTML BUTTONS
// ==========================================
window.formatCurrency = formatCurrency;
window.updateTargetAgeSliderMin = updateTargetAgeSliderMin;
window.initiateUnlockSequence = initiateUnlockSequence;
window.initiateLockSequence = initiateLockSequence;
window.updateProjectionView = updateProjectionView;
window.handleThermostatChange = handleThermostatChange;