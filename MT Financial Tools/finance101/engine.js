import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================================================
// FIREBASE INTEGRATION & AUTH GATEKEEPER
// ==========================================================================
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

let currentUserUid = null;

// ==========================================================================
// UX ARCHITECTURE: LOADERS & EXIT SEQUENCES
// ==========================================================================
function initLoader() {
    let bar = document.getElementById('loading_progress');
    if (bar) {
        // Instantly shoot to 92% to mask Firebase latency
        setTimeout(() => { bar.style.width = '92%'; }, 50);
    }
}

function dismissLoader() {
    let bar = document.getElementById('loading_progress');
    let screen = document.getElementById('loading_screen');
    if (bar && screen) {
        bar.style.width = '100%';
        setTimeout(() => {
            screen.style.opacity = '0';
            setTimeout(() => { screen.style.display = 'none'; }, 300);
        }, 200);
    }
}

async function saveAndExit() {
    let screen = document.getElementById('loading_screen');
    let bar = document.getElementById('loading_progress');
    if (screen) {
        screen.style.display = 'flex';
        screen.offsetHeight; // Force reflow
        screen.style.opacity = '1';
        if (bar) bar.style.width = '100%';
    }
    
    await saveProfile(true); // Silent save
    
    setTimeout(() => {
        window.location.href = '../index.html'; // Redirect to master login
    }, 500);
}

// Auth Observer: Gatekeeper Logic
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is authenticated
        currentUserUid = user.uid;
        
        // Automatically fetch data on load
        loadCloudProfile().then(() => {
            dismissLoader(); // Data loaded, drop the shield
        });
    } else {
        // No user authenticated: Immediate redirect to master login
        window.location.href = '../index.html';
    }
});

async function loadCloudProfile() {
    if (!currentUserUid) return;
    
    try {
        let userDocRef = doc(db, "users", currentUserUid);
        let docSnap = await getDoc(userDocRef);
        
        // Check if doc exists AND if it has data specifically for MT Finance 101
        if (docSnap.exists() && docSnap.data().mtFinance101Profile) {
            let profile = docSnap.data().mtFinance101Profile;
            applyProfileData(profile);
            closeModal(); // Ensure welcome screen drops on successful auto-load
        } else {
            console.log("No existing MT Finance 101 profile found in cloud. Ready for fresh setup.");
        }
    } catch (error) {
        console.error("Error loading cloud profile:", error);
    }
}

/* --------------------------------------------------------------------------
   1. GLOBAL VARIABLES, SVGS, & STATE MANAGEMENT
   -------------------------------------------------------------------------- */

let chartDietInstance = null;
let chartRehabInstance = null;

const LIFESTYLE_RATIO = 0.75; 
const TOXIC_DEBT_INTEREST_RATE = 0.03; 

const currencyFormatter = new Intl.NumberFormat('en-PH', { 
    style: 'currency', 
    currency: 'PHP', 
    maximumFractionDigits: 0 
});

// Premium SVG Icon Definitions
const SVG_DELETE = '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
const SVG_INFO = '<svg style="width:14px; height:14px; display:inline-block; vertical-align:text-bottom; margin-right:4px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
const SVG_ERROR = '<svg viewBox="0 0 24 24" style="width:36px;height:36px;stroke:currentColor;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
const SVG_WARN = '<svg viewBox="0 0 24 24" style="width:36px;height:36px;stroke:currentColor;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
const SVG_OK = '<svg viewBox="0 0 24 24" style="width:36px;height:36px;stroke:currentColor;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
const SVG_MOON = '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
const SVG_SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';

// State History for Undo Functionality
let stateHistory = [];
const MAX_HISTORY = 10;

/* --------------------------------------------------------------------------
   2. UTILITY FUNCTIONS (Parsing & Masking)
   -------------------------------------------------------------------------- */

function parseNum(stringValue) {
    if (!stringValue) {
        return 0;
    }
    let rawString = stringValue.toString().replace(/,/g, '').replace(/\s/g, '');
    let parsedFloat = parseFloat(rawString);
    if (isNaN(parsedFloat)) {
        return 0;
    }
    return parsedFloat;
}

function applyCommaMasking(event) {
    let inputElement = event.target;
    let rawValue = inputElement.value.replace(/[^0-9]/g, '');
    if (rawValue === '') {
        inputElement.value = '';
        return;
    }
    let numberValue = parseInt(rawValue, 10);
    inputElement.value = numberValue.toLocaleString('en-US');
}

function bindMaskingListeners() {
    let formatInputs = document.querySelectorAll('.format-num');
    formatInputs.forEach(function(input) {
        input.removeEventListener('input', applyCommaMasking);
        input.addEventListener('input', applyCommaMasking);
    });
}

/* --------------------------------------------------------------------------
   3. UI NAVIGATION, THEME, MODALS, & STATE HISTORY
   -------------------------------------------------------------------------- */

function saveStateToHistory() {
    let currentState = { html: {}, profile: {} };
    const containers = ['container-p1-cash', 'container-p1-yield', 'container-p1-real', 'container-p1-decay', 'container-p1-toxic', 'container-p1-healthy', 'container-p2-income', 'container-p2-bonus', 'container-p2-bills', 'container-p2-daily', 'container-p2-obli', 'container-p2-life'];
    
    containers.forEach(id => {
        let container = document.getElementById(id);
        if (container) {
            let inputs = container.querySelectorAll('input, select');
            inputs.forEach((inp) => {
                if(inp.tagName === 'INPUT') inp.setAttribute('value', inp.value);
                if(inp.tagName === 'SELECT') {
                    let options = inp.querySelectorAll('option');
                    options.forEach(opt => opt.removeAttribute('selected'));
                    if(inp.options[inp.selectedIndex]) inp.options[inp.selectedIndex].setAttribute('selected', 'selected');
                }
            });
            currentState.html[id] = container.innerHTML;
        }
    });
    
    currentState.profile = {
        age: document.getElementById('asm_age')?.value || '30',
        retire: document.getElementById('asm_retire')?.value || '65',
        windfall: document.getElementById('asm_windfall')?.value || '0',
        squeeze: document.getElementById('asm_squeeze')?.value || '0',
        efTarget: document.querySelector('input[name="ef_target"]:checked')?.value || '3',
        retireDrop: document.getElementById('asm_retire_drop')?.checked || false
    };

    stateHistory.push(currentState);
    if(stateHistory.length > MAX_HISTORY) stateHistory.shift();
}

function undoAction() {
    if(stateHistory.length === 0) return; 
    let previousState = stateHistory.pop();
    
    for(let id in previousState.html) {
        let el = document.getElementById(id);
        if(el) el.innerHTML = previousState.html[id];
    }
    
    if(previousState.profile) {
        if(document.getElementById('asm_age')) document.getElementById('asm_age').value = previousState.profile.age;
        if(document.getElementById('asm_retire')) document.getElementById('asm_retire').value = previousState.profile.retire;
        if(document.getElementById('asm_windfall')) document.getElementById('asm_windfall').value = previousState.profile.windfall;
        if(document.getElementById('asm_squeeze')) document.getElementById('asm_squeeze').value = previousState.profile.squeeze;
        if(document.getElementById('asm_retire_drop')) document.getElementById('asm_retire_drop').checked = previousState.profile.retireDrop;
        
        let efRadio = document.getElementById('ef_' + previousState.profile.efTarget);
        if (efRadio) {
            efRadio.checked = true;
            efRadio.dispatchEvent(new Event('change'));
        }
    }

    bindMaskingListeners();
    document.querySelectorAll('.calc-trigger').forEach(input => {
        input.removeEventListener('input', runOS);
        input.removeEventListener('change', runOS);
        input.addEventListener('input', runOS);
        input.addEventListener('change', runOS);
    });
    
    runOS();
}

function resetSqueezeSlider() {
    let squeezeSlider = document.getElementById('asm_squeeze');
    if (squeezeSlider) squeezeSlider.value = 0;
}

function toggleTheme() {
    let root = document.documentElement;
    let currentTheme = root.getAttribute('data-theme') || 'light';
    let newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('mt_theme', newTheme);
    
    document.querySelectorAll('#btn_theme').forEach(btn => {
        btn.innerHTML = newTheme === 'dark' ? SVG_SUN : SVG_MOON;
    });
    
    Chart.defaults.color = newTheme === 'dark' ? '#94a3b8' : '#64748b'; 
    runOS();
}

function updateNav(activeId) {
    let tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    let target = document.getElementById(activeId);
    if (target) target.classList.add('active');
}

function switchTab(tabId) {
    let panels = document.querySelectorAll('.tab-panel');
    panels.forEach(panel => panel.classList.remove('active'));
    
    let targetPanel = document.getElementById(tabId);
    if (targetPanel) targetPanel.classList.add('active');

    let navButtons = document.querySelectorAll('.sidebar .nav-btn');
    navButtons.forEach(btn => btn.classList.remove('active'));
    let btnId = tabId.replace('tab-', 'btn-');
    let targetBtn = document.getElementById(btnId);
    if (targetBtn) targetBtn.classList.add('active');
    
    let mainScroll = document.getElementById('main-scroll');
    if (mainScroll) mainScroll.scrollTop = 0;
    
    runOS(); 
}

function switchP1Tab(subTabId) {
    let subPanels = document.querySelectorAll('#tab-pillar1 .sub-panel');
    subPanels.forEach(panel => panel.classList.remove('active'));
    let targetPanel = document.getElementById(subTabId);
    if (targetPanel) targetPanel.classList.add('active');

    let subNavBtns = document.querySelectorAll('#tab-pillar1 .sub-nav-btn');
    subNavBtns.forEach(btn => btn.classList.remove('active'));
    let targetBtn = document.getElementById('btn-' + subTabId);
    if (targetBtn) targetBtn.classList.add('active');
}

function switchP2Tab(subTabId) {
    let subPanels = document.querySelectorAll('#tab-pillar2 .sub-panel');
    subPanels.forEach(panel => panel.classList.remove('active'));
    let targetPanel = document.getElementById(subTabId);
    if (targetPanel) targetPanel.classList.add('active');

    let subNavBtns = document.querySelectorAll('#tab-pillar2 .sub-nav-btn');
    subNavBtns.forEach(btn => btn.classList.remove('active'));
    let targetBtn = document.getElementById('btn-' + subTabId);
    if (targetBtn) targetBtn.classList.add('active');
}

function showResetModal() {
    let modal = document.getElementById('reset_modal');
    if (modal) modal.style.display = 'flex';
}

function hideResetModal() {
    let modal = document.getElementById('reset_modal');
    if (modal) modal.style.display = 'none';
}

function confirmReset() {
    hideResetModal();
    resetAllData();
}

function startFreshWelcome() {
    closeModal();
    resetAllData();
}

function closeModal() {
    let modal = document.getElementById('welcome_modal');
    if (modal) modal.style.display = 'none';
    localStorage.setItem('mt_os_welcomed', 'true');
}

function resetAllData() {
    try {
        localStorage.removeItem('mt_os_profile');
        stateHistory = []; // Clear history on reset
        
        const containers = ['container-p1-cash', 'container-p1-yield', 'container-p1-real', 'container-p1-decay', 'container-p1-toxic', 'container-p1-healthy', 'container-p2-income', 'container-p2-bonus', 'container-p2-bills', 'container-p2-daily', 'container-p2-obli', 'container-p2-life'];
        containers.forEach(id => {
            let el = document.getElementById(id);
            if(el) el.innerHTML = '';
        });

        // Obliterate all pre-filled data and inject pure blank slates
        if(document.getElementById('container-p1-cash')) addAssetRow('container-p1-cash', 'Cash', 'Cash Account');
        if(document.getElementById('container-p1-yield')) addAssetRow('container-p1-yield', 'Yield', 'Investment Account');
        if(document.getElementById('container-p1-real')) addAssetRow('container-p1-real', 'Real', 'Property');
        if(document.getElementById('container-p1-decay')) addAssetRow('container-p1-decay', 'Decay', 'Vehicle');
        if(document.getElementById('container-p1-toxic')) addLiabilityRow('container-p1-toxic', 'Toxic', 'Credit Card / Loan');
        if(document.getElementById('container-p1-healthy')) addLiabilityRow('container-p1-healthy', 'Healthy', 'Secured Loan');
        
        if(document.getElementById('container-p2-income')) addDynamicRow('container-p2-income', 'Income Source', 'p2-inc-val', true);
        if(document.getElementById('container-p2-bonus')) addDynamicRow('container-p2-bonus', 'Bonus', 'p2-bon-val', false);
        if(document.getElementById('container-p2-bills')) addExpenseRow('container-p2-bills', 'Need', 'Fixed Bill');
        if(document.getElementById('container-p2-daily')) addExpenseRow('container-p2-daily', 'Need', 'Daily Cost');
        if(document.getElementById('container-p2-obli')) addExpenseRow('container-p2-obli', 'Need', 'Obligation');
        if(document.getElementById('container-p2-life')) addExpenseRow('container-p2-life', 'Want', 'Discretionary');

        let ageEl = document.getElementById('asm_age'); if(ageEl) ageEl.value = '30';
        let retireEl = document.getElementById('asm_retire'); if(retireEl) retireEl.value = '65';
        let windEl = document.getElementById('asm_windfall'); if(windEl) windEl.value = '0';
        let retireDrop = document.getElementById('asm_retire_drop'); if(retireDrop) retireDrop.checked = false;
        
        resetSqueezeSlider();
        
        let ef3 = document.getElementById('ef_3');
        if(ef3) {
            ef3.checked = true;
            ef3.dispatchEvent(new Event('change'));
        }

        runOS();
        saveProfile(true); 
    } catch (error) {
        console.error("Reset Failed: ", error);
    }
}

// Integrated Cloud Save Protocol with UX Feedback
async function saveProfile(silent = false) {
    let profile = {
        age: document.getElementById('asm_age').value,
        retire: document.getElementById('asm_retire').value,
        windfall: document.getElementById('asm_windfall').value,
        squeeze: document.getElementById('asm_squeeze').value,
        efTarget: document.querySelector('input[name="ef_target"]:checked').value,
        retireDrop: document.getElementById('asm_retire_drop')?.checked || false,
        htmlState: {}
    };

    const containers = ['container-p1-cash', 'container-p1-yield', 'container-p1-real', 'container-p1-decay', 'container-p1-toxic', 'container-p1-healthy', 'container-p2-income', 'container-p2-bonus', 'container-p2-bills', 'container-p2-daily', 'container-p2-obli', 'container-p2-life'];
    
    containers.forEach(id => {
        let container = document.getElementById(id);
        if (container) {
            let inputs = container.querySelectorAll('input, select');
            inputs.forEach((inp) => {
                if(inp.tagName === 'INPUT') inp.setAttribute('value', inp.value);
                if(inp.tagName === 'SELECT') {
                    let options = inp.querySelectorAll('option');
                    options.forEach(opt => opt.removeAttribute('selected'));
                    if(inp.options[inp.selectedIndex]) inp.options[inp.selectedIndex].setAttribute('selected', 'selected');
                }
            });
            profile.htmlState[id] = container.innerHTML;
        }
    });

    // UI Feedback: Syncing State
    if (!silent) {
        let btns = document.querySelectorAll('.icon-btn.save, .btn-action.save');
        btns.forEach(btn => {
            btn.dataset.originalHtml = btn.dataset.originalHtml || btn.innerHTML; // Cache icon
            btn.innerHTML = "SYNCING...";
        });
    }

    try {
        // Backup to local storage
        localStorage.setItem('mt_os_profile', JSON.stringify(profile));
        
        // Cloud Sync execution
        if (currentUserUid) {
            let userDocRef = doc(db, "users", currentUserUid);
            await setDoc(userDocRef, { mtFinance101Profile: profile }, { merge: true });
        }
        
        // UI Feedback: Success State
        if (!silent) {
            let btns = document.querySelectorAll('.icon-btn.save, .btn-action.save');
            btns.forEach(btn => {
                btn.innerHTML = "SAVED! ✓";
                setTimeout(() => { btn.innerHTML = btn.dataset.originalHtml; }, 2000);
            });
        }
    } catch (error) {
        console.error("Failed to sync profile to cloud:", error);
        if (!silent) {
            let btns = document.querySelectorAll('.icon-btn.save, .btn-action.save');
            btns.forEach(btn => {
                btn.innerHTML = "ERROR";
                setTimeout(() => { btn.innerHTML = btn.dataset.originalHtml; }, 2000);
            });
        }
    }
}

function applyProfileData(profile) {
    document.getElementById('asm_age').value = profile.age || '30';
    document.getElementById('asm_retire').value = profile.retire || '65';
    document.getElementById('asm_windfall').value = profile.windfall || '0';
    document.getElementById('asm_squeeze').value = profile.squeeze || '0';
    if (document.getElementById('asm_retire_drop')) document.getElementById('asm_retire_drop').checked = profile.retireDrop || false;
    
    let efRadio = document.getElementById('ef_' + profile.efTarget);
    if(efRadio) {
        efRadio.checked = true;
        efRadio.dispatchEvent(new Event('change'));
    }

    const containers = ['container-p1-cash', 'container-p1-yield', 'container-p1-real', 'container-p1-decay', 'container-p1-toxic', 'container-p1-healthy', 'container-p2-income', 'container-p2-bonus', 'container-p2-bills', 'container-p2-daily', 'container-p2-obli', 'container-p2-life'];
    
    containers.forEach(id => {
        let container = document.getElementById(id);
        if (container && profile.htmlState && profile.htmlState[id]) {
            container.innerHTML = profile.htmlState[id];
        }
    });

    bindMaskingListeners();
    let allTriggers = document.querySelectorAll('.calc-trigger');
    allTriggers.forEach(function(input) {
        input.removeEventListener('input', runOS);
        input.removeEventListener('change', runOS);
        input.addEventListener('input', runOS);
        input.addEventListener('change', runOS);
    });

    runOS();
    saveProfile(true); 
    stateHistory = []; // Clear history on load
}

/* --------------------------------------------------------------------------
   4. TWO-TIER DYNAMIC ROW GENERATION (v1.6 Architecture)
   -------------------------------------------------------------------------- */

document.addEventListener('click', function(e) {
    let btn = e.target.closest('.btn-delete');
    if (btn) {
        saveStateToHistory();
        let row = btn.closest('.dynamic-row');
        if (row) {
            let parent = row.parentElement;
            if (parent && parent.parentElement && parent.parentElement.id.includes('container-p1')) {
                parent.remove(); 
            } else {
                row.remove();
            }
            resetSqueezeSlider();
            runOS();
        }
    }
});

function addAssetRow(containerId, type, placeholder) {
    saveStateToHistory();
    let container = document.getElementById(containerId);
    if (!container) return;
    
    let wrapper = document.createElement('div');
    let valClass = 'p1-cash-val';
    let microLabel = 'Balance';
    
    if (type === 'Yield') { valClass = 'p1-yield-val'; microLabel = 'Est. Value'; }
    if (type === 'Real') { valClass = 'p1-real-val'; microLabel = 'Est. Value'; }
    if (type === 'Decay') { valClass = 'p1-decay-val'; microLabel = 'Est. Value'; }
    
    if (type === 'Real' || type === 'Decay') {
        wrapper.style.marginBottom = '25px';
        wrapper.style.paddingBottom = '15px';
        wrapper.style.borderBottom = '1px dashed var(--border-light)';
        
        let linkText = type === 'Decay' ? 'Active Auto Loan Link' : 'Active Mortgage Link';
        
        wrapper.innerHTML = `
            <div class="dynamic-row" style="border: none; margin: 0; padding: 0;">
                <div class="row-header">
                    <input type="text" value="${placeholder}" class="label-input">
                    <button class="btn-delete">${SVG_DELETE}</button>
                </div>
                <div class="row-controls">
                    <select class="badge-select input-asset-type calc-trigger" style="display:none;"><option value="${type}" selected></option></select>
                    <div class="input-group">
                        <span class="micro-label">${microLabel}</span>
                        <div class="input-wrapper">
                            <span class="currency">₱</span>
                            <input type="text" value="" class="calc-trigger format-num ${valClass}" placeholder="0">
                        </div>
                    </div>
                </div>
            </div>
            <div style="background: var(--bg-input); padding: 15px; border-radius: 6px; margin-top: 15px;">
                <label style="font-size: 10px; font-weight: 800; color: var(--status-blue); display: block; margin-bottom: 8px; text-transform: uppercase;">${linkText}</label>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <div class="input-group">
                        <span class="micro-label">Rem. Balance</span>
                        <div class="input-wrapper">
                            <span class="currency">₱</span>
                            <input type="text" value="" class="calc-trigger format-num p1-linked-bal" placeholder="0" style="width: 100%;">
                        </div>
                    </div>
                    <div class="input-group">
                        <span class="micro-label">Mo. Payment</span>
                        <div class="input-wrapper">
                            <span class="currency">₱</span>
                            <input type="text" value="" class="calc-trigger format-num p1-linked-pmt" placeholder="0" style="width: 100%;">
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        wrapper.className = 'dynamic-row';
        wrapper.innerHTML = `
            <div class="row-header">
                <input type="text" value="${placeholder}" class="label-input">
                <button class="btn-delete">${SVG_DELETE}</button>
            </div>
            <div class="row-controls">
                <select class="badge-select input-asset-type calc-trigger" style="display:none;"><option value="${type}" selected></option></select>
                <div class="input-group">
                    <span class="micro-label">${microLabel}</span>
                    <div class="input-wrapper">
                        <span class="currency">₱</span>
                        <input type="text" value="" class="calc-trigger format-num ${valClass}" placeholder="0">
                    </div>
                </div>
            </div>
        `;
    }
    container.appendChild(wrapper);
    bindMaskingListeners();
    let newTriggers = wrapper.querySelectorAll('.calc-trigger');
    newTriggers.forEach(input => input.addEventListener('input', runOS));
    resetSqueezeSlider();
    runOS();
}

function addLiabilityRow(containerId, type, placeholder) {
    saveStateToHistory();
    let container = document.getElementById(containerId);
    if (!container) return;
    
    let row = document.createElement('div');
    row.className = 'dynamic-row';
    let balClass = type === 'Toxic' ? 'p1-toxic-bal' : 'p1-healthy-bal';
    let pmtClass = type === 'Toxic' ? 'p1-toxic-pmt' : 'p1-healthy-pmt';
    
    row.innerHTML = `
        <div class="row-header">
            <input type="text" value="${placeholder}" class="label-input">
            <button class="btn-delete">${SVG_DELETE}</button>
        </div>
        <div class="row-controls">
            <select class="badge-select input-liab-type calc-trigger" style="display:none;"><option value="${type}" selected></option></select>
            <div class="input-group">
                <span class="micro-label">Balance</span>
                <div class="input-wrapper">
                    <span class="currency">₱</span>
                    <input type="text" value="" class="calc-trigger format-num ${balClass}" placeholder="0">
                </div>
            </div>
            <div class="input-group">
                <span class="micro-label">Mo. Pmt</span>
                <div class="input-wrapper">
                    <span class="currency">₱</span>
                    <input type="text" value="" class="calc-trigger format-num ${pmtClass}" placeholder="0">
                </div>
            </div>
        </div>
    `;
    container.appendChild(row);
    bindMaskingListeners();
    let newTriggers = row.querySelectorAll('.calc-trigger');
    newTriggers.forEach(input => input.addEventListener('input', runOS));
    resetSqueezeSlider();
    runOS();
}

function addDynamicRow(containerId, defaultLabel, inputClass, isGrowable) {
    saveStateToHistory();
    let container = document.getElementById(containerId);
    if (!container) return;
    
    let row = document.createElement('div');
    row.className = 'dynamic-row';
    let growthAttr = isGrowable ? 'data-growth="true"' : 'data-growth="false"';
    let freqDropdown = inputClass === 'p2-inc-val' ? `
        <div class="input-group">
            <span class="micro-label">Frequency</span>
            <select class="freq-select calc-trigger"><option value="1">Monthly</option><option value="2">Per Cut-off</option><option value="4.33">Weekly</option><option value="20">Daily (Work)</option><option value="30">Daily (All)</option><option value="0.0833">Annually</option></select>
        </div>` : '';
    
    row.innerHTML = `
        <div class="row-header">
            <input type="text" value="${defaultLabel}" class="label-input">
            <button class="btn-delete">${SVG_DELETE}</button>
        </div>
        <div class="row-controls">
            ${freqDropdown}
            <div class="input-group">
                <span class="micro-label">Amount</span>
                <div class="input-wrapper">
                    <span class="currency">₱</span>
                    <input type="text" value="" class="calc-trigger format-num ${inputClass}" ${growthAttr} placeholder="0">
                </div>
            </div>
        </div>
    `;
    container.appendChild(row);
    bindMaskingListeners();
    let newTriggers = row.querySelectorAll('.calc-trigger');
    newTriggers.forEach(input => { input.addEventListener('input', runOS); input.addEventListener('change', runOS); });
    resetSqueezeSlider();
    runOS();
}

function addExpenseRow(containerId, type, placeholder) {
    saveStateToHistory();
    let container = document.getElementById(containerId);
    if (!container) return;
    
    let row = document.createElement('div');
    row.className = 'dynamic-row';
    let valClass = type === 'Want' ? 'p2-want-val' : 'p2-need-val';
    
    row.innerHTML = `
        <div class="row-header">
            <input type="text" value="${placeholder}" class="label-input">
            <button class="btn-delete">${SVG_DELETE}</button>
        </div>
        <div class="row-controls">
            <select class="badge-select input-exp-type calc-trigger" style="display:none;"><option value="${type}" selected></option></select>
            <div class="input-group">
                <span class="micro-label">Frequency</span>
                <select class="freq-select calc-trigger"><option value="1">Monthly</option><option value="2">Per Cut-off</option><option value="4.33">Weekly</option><option value="20">Daily (Work)</option><option value="30">Daily (All)</option><option value="0.0833">Annually</option></select>
            </div>
            <div class="input-group">
                <span class="micro-label">Amount</span>
                <div class="input-wrapper">
                    <span class="currency">₱</span>
                    <input type="text" value="" class="calc-trigger format-num ${valClass}" placeholder="0">
                </div>
            </div>
        </div>
    `;
    container.appendChild(row);
    bindMaskingListeners();
    let newTriggers = row.querySelectorAll('.calc-trigger');
    newTriggers.forEach(input => { input.addEventListener('input', runOS); input.addEventListener('change', runOS); });
    resetSqueezeSlider();
    runOS();
}

/* --------------------------------------------------------------------------
   5. THE MASTER ENGINE (Data Harvesting, Math, & Processing)
   -------------------------------------------------------------------------- */
function runOS() {
    
    // ======================================================================
    // A. HARVEST PILLAR 1: ASSETS & LIABILITIES
    // ======================================================================
    let liquidCash = 0; let yieldAssets = 0; let realAssets = 0; let decayAssets = 0;
    let toxicBal = 0; let toxicPmt = 0; let healthyBal = 0; let healthyPmt = 0;

    document.querySelectorAll('.p1-cash-val').forEach(inp => liquidCash += parseNum(inp.value));
    document.querySelectorAll('.p1-yield-val').forEach(inp => yieldAssets += parseNum(inp.value));
    document.querySelectorAll('.p1-real-val').forEach(inp => realAssets += parseNum(inp.value));
    document.querySelectorAll('.p1-decay-val').forEach(inp => decayAssets += parseNum(inp.value));

    document.querySelectorAll('.p1-toxic-bal').forEach(inp => toxicBal += parseNum(inp.value));
    document.querySelectorAll('.p1-toxic-pmt').forEach(inp => toxicPmt += parseNum(inp.value));
    
    document.querySelectorAll('.p1-healthy-bal').forEach(inp => healthyBal += parseNum(inp.value));
    document.querySelectorAll('.p1-healthy-pmt').forEach(inp => healthyPmt += parseNum(inp.value));
    document.querySelectorAll('.p1-linked-bal').forEach(inp => healthyBal += parseNum(inp.value));
    document.querySelectorAll('.p1-linked-pmt').forEach(inp => healthyPmt += parseNum(inp.value));

    let totalAssets = liquidCash + yieldAssets + realAssets + decayAssets;
    let totalDebt = toxicBal + healthyBal;
    let trueNetWorth = totalAssets - totalDebt;
    let totalDebtPmts = toxicPmt + healthyPmt;

    let subAssetsEl = document.getElementById('minihud_assets');
    if (subAssetsEl) subAssetsEl.innerText = currencyFormatter.format(totalAssets);

    let subLiabEl = document.getElementById('minihud_liabs');
    if (subLiabEl) subLiabEl.innerText = currencyFormatter.format(totalDebt);

    let subNwEl = document.getElementById('minihud_nw');
    if (subNwEl) {
        subNwEl.innerText = currencyFormatter.format(trueNetWorth);
        subNwEl.style.color = trueNetWorth < 0 ? 'var(--status-red)' : 'var(--mt-green)';
    }

    let p1EmptyPrompt = document.getElementById('p1-empty-prompt');
    if (p1EmptyPrompt) p1EmptyPrompt.style.display = (totalAssets === 0 && totalDebt === 0) ? 'block' : 'none';

    let uiLockedDebt = document.getElementById('ui_locked_debt');
    if (uiLockedDebt) uiLockedDebt.value = totalDebtPmts.toLocaleString('en-US');

    // ======================================================================
    // B. HARVEST PILLAR 2: MONTHLY BUDGET
    // ======================================================================
    let totalMonthlyIncome = 0; let growableMonthlyIncome = 0; let staticMonthlyIncome = 0;   

    document.querySelectorAll('.p2-inc-val').forEach(input => {
        let rawVal = parseNum(input.value);
        let row = input.closest('.dynamic-row');
        let freqSelect = row.querySelector('.freq-select');
        let multiplier = freqSelect ? parseFloat(freqSelect.value) : 1;
        let normalizedVal = rawVal * multiplier;
        
        totalMonthlyIncome += normalizedVal;
        if (input.getAttribute('data-growth') === 'true') growableMonthlyIncome += normalizedVal;
        else staticMonthlyIncome += normalizedVal;
    });

    let subtotalIncomeEl = document.getElementById('minihud_income');
    if (subtotalIncomeEl) subtotalIncomeEl.innerText = currencyFormatter.format(totalMonthlyIncome);

    let totalAnnualBonuses = 0;
    document.querySelectorAll('.p2-bon-val').forEach(inp => totalAnnualBonuses += parseNum(inp.value));

    let windfallPct = parseNum(document.getElementById('asm_windfall').value);
    let lblWindfall = document.getElementById('lbl_windfall');
    if (lblWindfall) lblWindfall.innerText = '(' + windfallPct + '%)';
    
    let investableWindfall = totalAnnualBonuses * (windfallPct / 100);
    let monthlyBonusBoost = investableWindfall / 12; 
    
    let lblWindfallAmount = document.getElementById('lbl_windfall_amount');
    if (lblWindfallAmount) lblWindfallAmount.innerText = '+ ' + currencyFormatter.format(monthlyBonusBoost) + ' / mo';

    let totalNeeds = 0; let totalWants = 0;

    document.querySelectorAll('.p2-need-val').forEach(input => {
        let rawVal = parseNum(input.value);
        let freqSelect = input.closest('.dynamic-row').querySelector('.freq-select');
        let multiplier = freqSelect ? parseFloat(freqSelect.value) : 1;
        totalNeeds += (rawVal * multiplier);
    });

    document.querySelectorAll('.p2-want-val').forEach(input => {
        let rawVal = parseNum(input.value);
        let freqSelect = input.closest('.dynamic-row').querySelector('.freq-select');
        let multiplier = freqSelect ? parseFloat(freqSelect.value) : 1;
        totalWants += (rawVal * multiplier);
    });
    
    if (document.getElementById('lbl_current_wants')) {
        document.getElementById('lbl_current_wants').innerText = currencyFormatter.format(totalWants) + ' / mo';
    }

    let baselineSurvivalNeeds = totalNeeds + totalDebtPmts;
    let totalMonthlyExpenses = baselineSurvivalNeeds + totalWants;
    let savingsCapacity = totalMonthlyIncome - totalMonthlyExpenses;

    if (document.getElementById('minihud_debt')) document.getElementById('minihud_debt').innerText = currencyFormatter.format(totalDebtPmts);
    if (document.getElementById('minihud_needs')) document.getElementById('minihud_needs').innerText = currencyFormatter.format(totalNeeds);
    if (document.getElementById('minihud_wants')) document.getElementById('minihud_wants').innerText = currencyFormatter.format(totalWants);

    let subSurplusEl = document.getElementById('minihud_surplus');
    if (subSurplusEl) {
        subSurplusEl.innerText = currencyFormatter.format(savingsCapacity);
        subSurplusEl.style.color = savingsCapacity < 0 ? 'var(--status-red)' : 'var(--mt-green)';
    }

    let p2EmptyPrompt = document.getElementById('p2-empty-prompt');
    if (p2EmptyPrompt) p2EmptyPrompt.style.display = (totalMonthlyIncome === 0 && totalMonthlyExpenses === 0) ? 'block' : 'none';

    // ======================================================================
    // C. EMPTY STATE INTERCEPTOR
    // ======================================================================
    let p3EmptyState = document.getElementById('p3-empty-state');
    let p3Content = document.getElementById('p3-content');
    let p4EmptyState = document.getElementById('p4-empty-state');
    let p4Content = document.getElementById('p4-content');

    if (totalAssets === 0 && totalMonthlyIncome === 0) {
        if (p3EmptyState) { p3EmptyState.classList.remove('hidden-state'); p3EmptyState.classList.add('visible-state'); }
        if (p3Content) { p3Content.classList.remove('visible-state'); p3Content.classList.add('hidden-state'); }
        if (p4EmptyState) { p4EmptyState.classList.remove('hidden-state'); p4EmptyState.classList.add('visible-state'); }
        if (p4Content) { p4Content.classList.remove('visible-state'); p4Content.classList.add('hidden-state'); }
        return; 
    } else {
        if (p3EmptyState) { p3EmptyState.classList.remove('visible-state'); p3EmptyState.classList.add('hidden-state'); }
        if (p3Content) { p3Content.classList.remove('hidden-state'); p3Content.classList.add('visible-state'); }
        if (p4EmptyState) { p4EmptyState.classList.remove('visible-state'); p4EmptyState.classList.add('hidden-state'); }
        if (p4Content) { p4Content.classList.remove('hidden-state'); p4Content.classList.add('visible-state'); }
    }

    // ======================================================================
    // HUD VITAL HARVESTING (Age Clamps with Keystroke Safety)
    // ======================================================================
    let asmAge = parseNum(document.getElementById('asm_age').value);
    let asmRetireInput = document.getElementById('asm_retire');
    let rawRetire = parseNum(asmRetireInput.value);
    
    let asmRetire = rawRetire;
    if (rawRetire < asmAge && asmRetireInput.value !== "") {
        asmRetire = asmAge; 
    }

    let isRetireDrop = document.getElementById('asm_retire_drop') ? document.getElementById('asm_retire_drop').checked : false;

    // ======================================================================
    // D. PILLAR 3: FINANCIAL REVIEW
    // ======================================================================
    let monthsFunded = baselineSurvivalNeeds > 0 ? (liquidCash / baselineSurvivalNeeds) : 0;
    let needsPct = 0; let wantsPct = 0; let savingsPct = 0; let dtiPct = 0;

    if (totalMonthlyIncome > 0) {
        needsPct = (baselineSurvivalNeeds / totalMonthlyIncome) * 100;
        wantsPct = (totalWants / totalMonthlyIncome) * 100;
        savingsPct = (savingsCapacity / totalMonthlyIncome) * 100;
        dtiPct = (totalDebtPmts / totalMonthlyIncome) * 100;
    }

    let isInsolvent = false;
    let eradicatePower = savingsCapacity + toxicPmt; 
    if (eradicatePower < 0) eradicatePower = 0; 

    if (toxicBal > 0 && eradicatePower <= (toxicBal * TOXIC_DEBT_INTEREST_RATE)) {
        isInsolvent = true;
    }

    let bannerStatus = 'GREEN'; let bannerTitle = ''; let bannerSubtitle = '';
    
    if (isInsolvent) {
        bannerStatus = 'RED';
        bannerTitle = 'Action Required: High-Interest Debt';
        bannerSubtitle = 'The interest on your debt is growing faster than your current payments. To fix this, we need to temporarily redirect more cash to your monthly payments to bring the balance down.';
    } else if (savingsCapacity < 0) {
        bannerStatus = 'RED';
        bannerTitle = 'Action Required: Negative Cash Flow';
        bannerSubtitle = 'Your monthly expenses are currently higher than your income. We need to close this gap by reducing discretionary spending or increasing your income before we can start investing.';
    } else if (toxicBal > savingsCapacity && savingsCapacity > 0) {
        bannerStatus = 'YELLOW';
        bannerTitle = 'Action Required: High-Interest Debt';
        bannerSubtitle = 'You have positive cash flow, but capital is leaking to interest. Let\'s prioritize clearing this debt before investing.';
    } else if (monthsFunded < 3 && staticMonthlyIncome < baselineSurvivalNeeds) {
        bannerStatus = 'YELLOW';
        bannerTitle = 'Attention: Low Emergency Fund';
        bannerSubtitle = 'Your emergency fund is running low. Build your emergency fund to protect against market shocks.';
    } else {
        bannerStatus = 'GREEN';
        bannerTitle = 'Ready to Invest';
        bannerSubtitle = 'Your financial foundation is secure. You are now ready to start investing your monthly surplus.';
    }

    let bannerEl = document.getElementById('statusBanner');
    let iconEl = document.getElementById('statusIcon');
    let titleEl = document.getElementById('statusTitle');
    let subtitleEl = document.getElementById('statusSubtitle');
    
    if (bannerEl) {
        if (bannerStatus === 'RED') {
            bannerEl.style.borderLeftColor = 'var(--status-red)'; 
            bannerEl.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
            iconEl.innerHTML = SVG_ERROR; iconEl.style.color = 'var(--status-red)';
            titleEl.innerText = bannerTitle; titleEl.style.color = 'var(--status-red)';
        } else if (bannerStatus === 'YELLOW') {
            bannerEl.style.borderLeftColor = 'var(--status-yellow)'; 
            bannerEl.style.backgroundColor = 'rgba(245, 158, 11, 0.05)';
            iconEl.innerHTML = SVG_WARN; iconEl.style.color = 'var(--status-yellow)';
            titleEl.innerText = bannerTitle; titleEl.style.color = 'var(--status-yellow)';
        } else {
            bannerEl.style.borderLeftColor = 'var(--status-green)'; 
            bannerEl.style.backgroundColor = 'rgba(34, 197, 94, 0.05)';
            iconEl.innerHTML = SVG_OK; iconEl.style.color = 'var(--status-green)';
            titleEl.innerText = bannerTitle; titleEl.style.color = 'var(--status-green)';
        }
        subtitleEl.innerText = bannerSubtitle;
    }

    let efBar = document.getElementById('bar_ef');
    if (efBar) {
        document.getElementById('val_ef').innerText = monthsFunded.toFixed(1) + ' mo';
        let efWidth = Math.min((monthsFunded / 6) * 100, 100);
        efBar.style.width = efWidth + '%';
        efBar.style.backgroundColor = monthsFunded >= 3 ? 'var(--status-green)' : (monthsFunded >= 1 ? 'var(--status-yellow)' : 'var(--status-red)');
    }

    let dtiBar = document.getElementById('bar_dti');
    if (dtiBar) {
        document.getElementById('val_dti').innerText = dtiPct.toFixed(0) + '%';
        let dtiWidth = Math.min(dtiPct, 100);
        dtiBar.style.width = dtiWidth + '%';
        dtiBar.style.backgroundColor = dtiPct <= 36 ? 'var(--status-green)' : (dtiPct <= 43 ? 'var(--status-yellow)' : 'var(--status-red)');
    }

    let safeSavingsPct = Math.max(savingsPct, 0);
    renderDietChart('chartDiet', chartDietInstance, needsPct, wantsPct, safeSavingsPct, newChart => chartDietInstance = newChart);

    let checklistItems = [];
    if (savingsCapacity < 0) {
        checklistItems.push(`<li style="border-left-color: var(--status-red);"><strong>Negative Cash Flow</strong> Your expenses exceed your gross income by ₱${Math.abs(savingsCapacity).toLocaleString()}. We recommend identifying discretionary expenses that can be temporarily reduced.</li>`);
    } else {
        checklistItems.push(`<li style="border-left-color: var(--status-green);"><strong>Positive Cash Flow</strong> The system is successfully generating a monthly investable surplus of ₱${savingsCapacity.toLocaleString()}.</li>`);
    }

    if (toxicBal > 0) {
        if (isInsolvent) {
            checklistItems.push(`<li style="border-left-color: var(--status-red);"><strong>Debt Growing Faster Than Payments</strong> Based on your current numbers, your debt is growing faster than you can pay it off. Professional restructuring may be necessary.</li>`);
        } else if (toxicBal <= savingsCapacity) {
            checklistItems.push(`<li style="border-left-color: var(--status-green);"><strong>Negligible Liability</strong> Exposure to consumer debt is ₱${toxicBal.toLocaleString()}, but your healthy surplus means this could potentially be cleared in a single month to optimize savings.</li>`);
        } else {
            checklistItems.push(`<li style="border-left-color: var(--status-red);"><strong>High-Interest Exposure</strong> You carry ₱${toxicBal.toLocaleString()} in consumer debt. Diverting your surplus to eliminate this principal provides a guaranteed mathematical return.</li>`);
        }
    } else {
        checklistItems.push(`<li style="border-left-color: var(--status-green);"><strong>Zero High-Interest Debt</strong> Finances optimized. Potential wealth is not being lost to compounding credit card or personal loan interest.</li>`);
    }

    if (staticMonthlyIncome >= baselineSurvivalNeeds && baselineSurvivalNeeds > 0) {
        checklistItems.push(`<li style="border-left-color: var(--status-green);"><strong>Passive Income Covers Expenses</strong> Your passive income fully covers essential living costs. This significantly lowers overall financial risk.</li>`);
    } else if (monthsFunded < 3) {
        let neededCash = (baselineSurvivalNeeds * 3) - liquidCash;
        checklistItems.push(`<li style="border-left-color: var(--status-yellow);"><strong>Low Emergency Fund</strong> Your emergency savings currently covers ${monthsFunded.toFixed(1)} months of survival needs. A standard target is 3 months. Saving an additional ₱${neededCash.toLocaleString()} will provide a stronger safety net.</li>`);
    } else {
        checklistItems.push(`<li style="border-left-color: var(--status-green);"><strong>Strong Emergency Fund</strong> Reserve cash currently covers ${monthsFunded.toFixed(1)} months, providing strong structural defense against unexpected events. Make sure to keep an eye on your available cash.</li>`);
    }

    if (needsPct > 50) {
        if (savingsCapacity > 100000) {
            checklistItems.push(`<li style="border-left-color: var(--status-blue);"><strong>High Essential Costs (Mitigated)</strong> Essential bills consume ${needsPct.toFixed(0)}% of gross income. While this normally requires attention, the absolute surplus provides an adequate operational buffer.</li>`);
        } else {
            checklistItems.push(`<li style="border-left-color: var(--status-yellow);"><strong>High Essential Costs</strong> Essential bills consume ${needsPct.toFixed(0)}% of gross income. A common structural guideline is to keep this near 50% to ensure enough room for savings and lifestyle.</li>`);
        }
    }

    let checklistContainer = document.getElementById('doctorChecklist');
    if (checklistContainer) checklistContainer.innerHTML = checklistItems.join('');

    let rehabModule = document.getElementById('rehabModule');
    let chartContainer = document.getElementById('rehabChartContainer');
    let warningContainer = document.getElementById('insolvencyWarning');
    let insightContainer = document.getElementById('rehabInsightContainer');
    
    if (toxicBal > 0 && !isInsolvent) {
        if (rehabModule) rehabModule.style.display = 'block';
        if (chartContainer) { chartContainer.classList.remove('hidden-state'); chartContainer.classList.add('visible-state'); }
        if (warningContainer) { warningContainer.classList.remove('visible-state'); warningContainer.classList.add('hidden-state'); }
        
        let visibleSurplus = Math.max(savingsCapacity, 0);
        if (document.getElementById('rehabSurplus')) document.getElementById('rehabSurplus').innerText = currencyFormatter.format(visibleSurplus);
        
        if (insightContainer) {
            let freedEF = toxicPmt * 3;
            insightContainer.innerHTML = `
                <div style="background: rgba(34, 197, 94, 0.05); border-left: 3px solid var(--status-green); padding: 12px; margin-bottom: 20px; font-size: 12px; color: var(--text-main); border-radius:0 4px 4px 0;">
                    ${SVG_INFO} <strong>System Note:</strong> Upon clearing this monthly obligation, your required 3-Month Emergency Fund target will structurally decrease by <strong>₱${freedEF.toLocaleString()}</strong>.
                </div>
            `;
        }
        
        let debtLabels = []; let debtData = [];
        let currentDebt = toxicBal; let month = 0;
        
        while (currentDebt > 0 && month < 120) { 
            debtLabels.push('Mo ' + month); 
            debtData.push(currentDebt);
            currentDebt = currentDebt + (currentDebt * TOXIC_DEBT_INTEREST_RATE) - eradicatePower; 
            month++;
        }
        if (currentDebt <= 0) { debtLabels.push('Mo ' + month); debtData.push(0); }
        
        renderRehabChart('chartRehab', chartRehabInstance, debtLabels, debtData, newChart => chartRehabInstance = newChart);

    } else if (toxicBal > 0 && isInsolvent) {
        if (rehabModule) rehabModule.style.display = 'block';
        if (chartContainer) { chartContainer.classList.remove('visible-state'); chartContainer.classList.add('hidden-state'); }
        if (warningContainer) { warningContainer.classList.remove('hidden-state'); warningContainer.classList.add('visible-state'); }
        if (insightContainer) insightContainer.innerHTML = '';
        if (document.getElementById('rehabSurplus')) document.getElementById('rehabSurplus').innerText = currencyFormatter.format(savingsCapacity);
    } else {
        if (rehabModule) rehabModule.style.display = 'none';
    }

    // ======================================================================
    // E. PILLAR 4: YOUR ACTION PLAN
    // ======================================================================
    let squeezeSlider = document.getElementById('asm_squeeze');
    let squeezePct = squeezeSlider ? parseNum(squeezeSlider.value) / 100 : 0;
    if (document.getElementById('lbl_squeeze_pct')) document.getElementById('lbl_squeeze_pct').innerText = Math.round(squeezePct * 100) + '%';

    let squeezedCash = totalWants * squeezePct;
    if (document.getElementById('lbl_squeezed_cash')) document.getElementById('lbl_squeezed_cash').innerText = currencyFormatter.format(squeezedCash) + ' / mo';

    let actionableSurplus = savingsCapacity + squeezedCash + monthlyBonusBoost;
    let isBleeding = false;
    if (actionableSurplus <= 0) { actionableSurplus = 0; isBleeding = true; }

    if (document.getElementById('lbl_attack_power')) document.getElementById('lbl_attack_power').innerText = currencyFormatter.format(actionableSurplus) + ' / mo';

    let efTargetMonths = 3;
    let efRadios = document.getElementsByName('ef_target');
    for (let i = 0; i < efRadios.length; i++) {
        if (efRadios[i].checked) { efTargetMonths = parseInt(efRadios[i].value); break; }
    }

    let labels = []; let simDebtLine = []; let simEfLine = []; let simInvestLine = [];
    let currentSimDebt = toxicBal; let currentSimEF = liquidCash;
    let targetEF = baselineSurvivalNeeds * efTargetMonths;
    let currentSimInvest = 0;

    let dynamicInsolvent = false;
    let totalPaymentPower = actionableSurplus + toxicPmt;
    if (toxicBal > 0 && totalPaymentPower <= (toxicBal * TOXIC_DEBT_INTEREST_RATE)) dynamicInsolvent = true;

    let lumpSumExecuted = 0;
    if (currentSimEF > targetEF && currentSimDebt > 0) {
        let excessCash = currentSimEF - targetEF;
        if (excessCash >= currentSimDebt) {
            lumpSumExecuted = currentSimDebt;
            currentSimEF -= currentSimDebt;
            currentSimDebt = 0;
        } else {
            lumpSumExecuted = excessCash;
            currentSimDebt -= excessCash;
            currentSimEF = targetEF;
        }
    }

    let monthDebtCleared = currentSimDebt <= 0 ? 0 : null;
    let monthEFCleared = currentSimEF >= targetEF ? 0 : null;

    for (let m = 0; m <= 36; m++) {
        if (m === 0) labels.push("Now");
        else if (m % 3 === 0) labels.push("Mo " + m);
        else labels.push("");

        simDebtLine.push(currentSimDebt);
        simEfLine.push(currentSimEF);
        simInvestLine.push(currentSimInvest);

        if (m < 36) {
            let availableCashThisMonth = isBleeding ? 0 : actionableSurplus;

            if (currentSimDebt > 0) {
                let interest = currentSimDebt * TOXIC_DEBT_INTEREST_RATE;
                let payment = toxicPmt + availableCashThisMonth; 
                currentSimDebt = currentSimDebt + interest - payment;
                if (currentSimDebt <= 0) {
                    if (monthDebtCleared === null) monthDebtCleared = m + 1;
                    availableCashThisMonth = Math.abs(currentSimDebt); 
                    currentSimDebt = 0;
                } else { availableCashThisMonth = 0; }
            }

            if (currentSimDebt <= 0 && currentSimEF < targetEF && !isBleeding) {
                currentSimEF += availableCashThisMonth;
                if (currentSimEF >= targetEF) {
                    if (monthEFCleared === null) monthEFCleared = m + 1;
                    availableCashThisMonth = currentSimEF - targetEF;
                    currentSimEF = targetEF;
                } else { availableCashThisMonth = 0; }
            }

            if (currentSimDebt <= 0 && currentSimEF >= targetEF && !isBleeding) {
                currentSimInvest += availableCashThisMonth;
            }
        }
    }

    let currentPhase = 3; 
    if (toxicBal > 0) currentPhase = 1;
    else if (liquidCash < targetEF) currentPhase = 2;

    let focusBanner = document.getElementById('current_focus_banner');
    let focusTitle = document.getElementById('current_focus_title');
    let focusDesc = document.getElementById('current_focus_desc');
    
    let nDebt = document.getElementById('node_debt'); let tDebt = document.getElementById('title_debt'); let bDebt = document.getElementById('badge_debt'); let mDebt = document.getElementById('metric_debt'); let vRemDebt = document.getElementById('val_rem_debt');
    let nEf = document.getElementById('node_ef'); let tEf = document.getElementById('title_ef'); let bEf = document.getElementById('badge_ef'); let pCEf = document.getElementById('prog_container_ef');
    let nInv = document.getElementById('node_invest'); let tInv = document.getElementById('title_invest'); let bInv = document.getElementById('badge_invest'); let mInv = document.getElementById('metric_invest'); let vCapInv = document.getElementById('val_cap_invest');

    [nDebt, nEf, nInv].forEach(n => { if(n) { n.style.borderColor = 'var(--border-light)'; n.style.backgroundColor = 'var(--bg-panel)'; } });
    [tDebt, tEf, tInv].forEach(t => { if(t) t.style.color = 'var(--text-muted)'; });
    [mDebt, pCEf, mInv].forEach(m => { if(m) m.style.display = 'none'; });

    if (focusBanner && focusTitle && focusDesc) {
        if (isBleeding && currentPhase !== 3) {
            focusBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
            focusBanner.style.borderLeftColor = 'var(--status-red)';
            focusTitle.innerText = "Cash Flow Deficit"; focusTitle.style.color = 'var(--status-red)';
            focusDesc.innerText = "Your expenses exceed your gross income. Adjust your budget before proceeding.";
        } else if (dynamicInsolvent) {
            focusBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
            focusBanner.style.borderLeftColor = 'var(--status-red)';
            focusTitle.innerText = "Debt Emergency"; focusTitle.style.color = 'var(--status-red)';
            focusDesc.innerText = "Based on your current numbers, your debt is growing faster than you can pay it off.";
            
            if(nDebt) nDebt.style.borderColor = 'var(--status-red)';
            if(tDebt) tDebt.style.color = 'var(--text-main)';
            if(bDebt) { bDebt.innerText = "Critical"; bDebt.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; bDebt.style.color = 'var(--status-red)'; }
            if(mDebt) mDebt.style.display = 'block';
            if(vRemDebt) { vRemDebt.innerText = currencyFormatter.format(toxicBal); vRemDebt.style.color = 'var(--status-red)'; }
        } else if (currentPhase === 1) {
            focusBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
            focusBanner.style.borderLeftColor = 'var(--status-red)';
            focusTitle.innerText = "Pay Off Debt"; focusTitle.style.color = 'var(--status-red)';
            focusDesc.innerText = monthDebtCleared ? `Estimated completion timeline: ${monthDebtCleared} months.` : "Estimated completion timeline: 36+ months.";

            if(nDebt) { nDebt.style.borderColor = 'var(--status-red)'; nDebt.style.backgroundColor = 'var(--status-red)'; }
            if(tDebt) tDebt.style.color = 'var(--text-main)';
            if(bDebt) { bDebt.innerText = "Active"; bDebt.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; bDebt.style.color = 'var(--status-red)'; }
            if(mDebt) mDebt.style.display = 'block';
            if(vRemDebt) { vRemDebt.innerText = currencyFormatter.format(toxicBal); vRemDebt.style.color = 'var(--text-main)'; }
        } else {
            if(nDebt) nDebt.style.borderColor = 'var(--status-green)';
            if(tDebt) tDebt.style.color = 'var(--status-green)';
            if(bDebt) { bDebt.innerText = "Cleared"; bDebt.style.backgroundColor = 'rgba(34, 197, 94, 0.1)'; bDebt.style.color = 'var(--status-green)'; }
        }

        if (currentPhase === 2 && !isBleeding) {
            focusBanner.style.backgroundColor = 'rgba(245, 158, 11, 0.05)';
            focusBanner.style.borderLeftColor = 'var(--status-yellow)';
            focusTitle.innerText = `Building ${efTargetMonths}-Month Emergency Fund`; focusTitle.style.color = 'var(--status-yellow)';
            focusDesc.innerText = monthEFCleared ? `Estimated completion timeline: ${monthEFCleared} months.` : "Estimated completion timeline: 36+ months.";

            if(nEf) { nEf.style.borderColor = 'var(--status-yellow)'; nEf.style.backgroundColor = 'var(--status-yellow)'; }
            if(tEf) tEf.style.color = 'var(--text-main)';
            if(bEf) { bEf.innerText = "Active"; bEf.style.backgroundColor = 'rgba(245, 158, 11, 0.1)'; bEf.style.color = 'var(--status-yellow)'; }
            
            if(pCEf) pCEf.style.display = 'block';
            let efPct = Math.min((liquidCash / targetEF) * 100, 100);
            if(document.getElementById('lbl_prog_ef_val')) document.getElementById('lbl_prog_ef_val').innerText = `${currencyFormatter.format(liquidCash)} / ${currencyFormatter.format(targetEF)}`;
            if(document.getElementById('lbl_prog_ef_pct')) document.getElementById('lbl_prog_ef_pct').innerText = efPct.toFixed(0) + '%';
            if(document.getElementById('bar_prog_ef')) document.getElementById('bar_prog_ef').style.width = efPct + '%';
        } else if (currentPhase > 2) {
            if(nEf) nEf.style.borderColor = 'var(--status-green)';
            if(tEf) tEf.style.color = 'var(--status-green)';
            if(bEf) { bEf.innerText = "Funded"; bEf.style.backgroundColor = 'rgba(34, 197, 94, 0.1)'; bEf.style.color = 'var(--status-green)'; }
        }

        if (currentPhase === 3 && !isBleeding) {
            focusBanner.style.backgroundColor = 'rgba(34, 197, 94, 0.05)';
            focusBanner.style.borderLeftColor = 'var(--status-green)';
            focusTitle.innerText = "Ready to Invest"; focusTitle.style.color = 'var(--status-green)';
            focusDesc.innerText = "Your current finances are secure. You are cleared to start investing.";

            if(nInv) { nInv.style.borderColor = 'var(--mt-green)'; nInv.style.backgroundColor = 'var(--mt-green)'; }
            if(tInv) tInv.style.color = 'var(--text-main)';
            if(bInv) { bInv.innerText = "Ready"; bInv.style.backgroundColor = 'rgba(56, 142, 60, 0.1)'; bInv.style.color = 'var(--mt-green)'; }
            
            if(mInv) mInv.style.display = 'block';
            if(vCapInv) vCapInv.innerText = currencyFormatter.format(actionableSurplus) + ' / mo';
        }
    }

    // 4. Update the Financial Baseline Summary (Handoff)
    let investableStartingCapital = liquidCash > targetEF ? (liquidCash - targetEF) : 0;
    if (document.getElementById('handoff_capital')) document.getElementById('handoff_capital').innerText = currencyFormatter.format(investableStartingCapital);

    let finalInvestCapacity = (toxicBal <= 0 && liquidCash >= targetEF) ? actionableSurplus : 0;
    if (document.getElementById('handoff_capacity')) document.getElementById('handoff_capacity').innerText = currencyFormatter.format(finalInvestCapacity) + ' / mo';

    let retirementSurvivalNeeds = Math.max(baselineSurvivalNeeds - healthyPmt, 0);
    let targetNeeds = isRetireDrop ? (retirementSurvivalNeeds * LIFESTYLE_RATIO) : retirementSurvivalNeeds;
    let lifestyleNeeded = targetNeeds + (totalWants - squeezedCash);
    if (document.getElementById('handoff_lifestyle')) document.getElementById('handoff_lifestyle').innerText = currencyFormatter.format(lifestyleNeeded) + ' / mo';

    let verdictEl = document.getElementById('executive_verdict_text');
    if (verdictEl) {
        let verdictText = "";
        if (asmRetire <= asmAge) {
            verdictText = `You are currently in your retirement phase. Your estimated essential living costs (excluding standard mortgages) require ₱${lifestyleNeeded.toLocaleString()} per month. Ensure your pensions and passive investments generate this amount. `;
            if (toxicBal > 0) verdictText += `CRITICAL: You still have ₱${toxicBal.toLocaleString()} in high-interest debt. This is very dangerous for your retirement savings. Direct all available liquid capital to eliminate this exposure immediately.`;
            else if (liquidCash < targetEF) verdictText += `Make sure to keep an eye on your available cash; reserves are currently underperforming your targeted ${efTargetMonths}-month buffer.`;
            else verdictText += `Emergency fund is fully funded, and high-interest exposure is zero. You remain structurally secure.`;
        } else if (dynamicInsolvent) {
            verdictText = `Based on your current numbers, your debt is growing faster than you can pay it off. You must immediately find a way to increase your income, drastically reduce fixed bills, or consider professional debt restructuring.`;
        } else if (isInsolvent && !dynamicInsolvent) {
            verdictText = `Your previous spending habits were keeping you trapped in debt. However, by adjusting your spending and freeing up ₱${squeezedCash.toLocaleString()}, you now have positive cash flow. Maintain this strict budget to clear the debt in ${monthDebtCleared} months.`;
        } else if (isBleeding) {
            verdictText = `Your monthly expenses are currently higher than your income. Reduce discretionary outflows via the adjustment parameter above to restore positive cash flow before we can project your wealth.`;
        } else if (toxicBal > 0) {
            verdictText = `Cash flow is positive, but performance is dragged by high-interest liabilities. `;
            if (lumpSumExecuted > 0) verdictText += `Since you have extra cash in your savings, applying a one-time payment of ₱${lumpSumExecuted.toLocaleString()} will significantly drop your debt. If you direct your ₱${actionableSurplus.toLocaleString()} monthly surplus to the remaining balance, you can be completely debt-free in ${monthDebtCleared} months.`;
            else verdictText += `If you direct your entire ₱${actionableSurplus.toLocaleString()} monthly surplus strictly toward clearing this debt, you can be completely debt-free in ${monthDebtCleared} months. Investing should be paused until this is cleared.`;
        } else if (liquidCash < targetEF) {
            verdictText = `High-interest exposure is cleared. Focus shifts to building your emergency fund. Divert the monthly surplus to raise cash reserves to ₱${targetEF.toLocaleString()} (${efTargetMonths} months of essential expenditure). Investing unlocks in ${monthEFCleared} months.`;
        } else {
            verdictText = `Your finances are fully optimized. High-interest debt is zero. The targeted ${efTargetMonths}-month emergency fund is at 100% capacity. The ₱${actionableSurplus.toLocaleString()} monthly surplus is cleared to start investing. You may export these metrics to your portfolio analysis tool.`;
        }
        verdictEl.innerText = verdictText;
    }
}

/* --------------------------------------------------------------------------
   6. CHART.JS RENDERING UTILITIES
   -------------------------------------------------------------------------- */
Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";

function renderDietChart(canvasId, instance, needs, wants, savings, callback) {
    let canvas = document.getElementById(canvasId);
    if (!canvas) return;
    let ctx = canvas.getContext('2d');
    if (instance) instance.destroy();
    
    let needsColor = needs > 50 ? 'rgba(239, 68, 68, 0.8)' : '#3b82f6';
    
    let chartConfig = {
        type: 'bar',
        data: {
            labels: ['Allocation'],
            datasets: [
                { label: 'Essential Expenses', data: [needs], backgroundColor: needsColor },
                { label: 'Wants (Non-Essentials)', data: [wants], backgroundColor: '#f59e0b' },
                { label: 'Monthly Surplus', data: [savings], backgroundColor: '#22c55e' } 
            ]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            scales: { x: { stacked: true, max: 100, display: false }, y: { stacked: true, display: false } },
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: (context) => context.dataset.label + ': ' + context.raw.toFixed(1) + '%' } } },
            animation: { duration: 0 } 
        }
    };
    callback(new Chart(ctx, chartConfig));
}

function renderRehabChart(canvasId, instance, labels, data, callback) {
    let canvas = document.getElementById(canvasId);
    if (!canvas) return;
    let ctx = canvas.getContext('2d');
    if (instance) instance.destroy();
    
    let chartConfig = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{ label: 'Consumer Debt Balance', data: data, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 3, fill: true, tension: 0.1, pointRadius: 2 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => currencyFormatter.format(context.parsed.y) } } },
            scales: { x: { grid: { display: false } }, y: { grid: { color: 'var(--border-light)' }, ticks: { callback: (value) => '₱' + (value / 1000).toFixed(0) + 'k' } } }
        }
    };
    callback(new Chart(ctx, chartConfig));
}

/* --------------------------------------------------------------------------
   7. SYSTEM INITIALIZATION & MODULE EXPORTS
   -------------------------------------------------------------------------- */

// Global exposures required for HTML inline event handlers because this file is now a JS Module
window.applyCommaMasking = applyCommaMasking;
window.undoAction = undoAction;
window.toggleTheme = toggleTheme;
window.saveProfile = saveProfile;
window.saveAndExit = saveAndExit;
window.showResetModal = showResetModal;
window.hideResetModal = hideResetModal;
window.confirmReset = confirmReset;
window.startFreshWelcome = startFreshWelcome;
window.closeModal = closeModal;
window.switchTab = switchTab;
window.updateNav = updateNav;
window.switchP1Tab = switchP1Tab;
window.switchP2Tab = switchP2Tab;
window.addAssetRow = addAssetRow;
window.addLiabilityRow = addLiabilityRow;
window.addDynamicRow = addDynamicRow;
window.addExpenseRow = addExpenseRow;
window.runOS = runOS;

window.onload = function() {
    initLoader(); // Trigger the psychological loading bar instantly
    
    bindMaskingListeners();
    document.querySelectorAll('.calc-trigger').forEach(input => {
        input.addEventListener('input', runOS);
        input.addEventListener('change', runOS);
    });
    
    // Theme Init
    let savedTheme = localStorage.getItem('mt_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    document.querySelectorAll('#btn_theme').forEach(btn => {
        btn.innerHTML = savedTheme === 'dark' ? SVG_SUN : SVG_MOON;
    });

    Chart.defaults.color = savedTheme === 'dark' ? '#94a3b8' : '#64748b'; 

    runOS();

    // For testing: Bypass localStorage check to force Welcome Modal (Optional)
    let modal = document.getElementById('welcome_modal');
    if(modal) modal.style.display = 'flex';
};
