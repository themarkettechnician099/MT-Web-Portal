// 1. Import Firebase functions directly from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// 2. YOUR FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyDvANibal59STlmeA6jKwKOPc_6XFtq30A",
  authDomain: "the-market-technician.firebaseapp.com",
  projectId: "the-market-technician",
  storageBucket: "the-market-technician.firebasestorage.app",
  messagingSenderId: "182431949342",
  appId: "1:182431949342:web:7f100110ac6617dc0c040f"
};

// --- LOADING SCREEN LOGIC (Phase 1) ---
const loadingScreen = document.getElementById('loading-screen');
const loadingProgress = document.getElementById('loading-progress');

// 0.1s: Bar width transitions to 92%
setTimeout(() => {
    if(loadingProgress) loadingProgress.style.width = '92%';
}, 50);

// 3. Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 4. Get UI Elements
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const userEmailDisplay = document.getElementById('user-email');
const errorMessage = document.getElementById('error-message');

// 5. Monitor Auth State & Finish Loading (Phase 2)
onAuthStateChanged(auth, (user) => {
    
    // 1.0s: Firebase finished loading data. Push to 100%
    if(loadingProgress) loadingProgress.style.width = '100%';
    
    // 1.2s: Fade entire screen to 0 opacity
    setTimeout(() => {
        if(loadingScreen) loadingScreen.classList.add('fade-out');
    }, 400);

    // Standard UI switching based on Auth State
    if (user) {
        authSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        userEmailDisplay.textContent = user.email;
    } else {
        authSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        userEmailDisplay.textContent = "";
    }
});

// 6. Handle Login (With UI Feedback)
authForm.addEventListener('submit', (e) => {
    e.preventDefault(); 
    errorMessage.textContent = ""; 
    
    // UI Feedback: "Syncing..." effect
    const originalText = loginBtn.textContent;
    loginBtn.textContent = "Authenticating...";
    
    const email = emailInput.value;
    const password = passwordInput.value;

    signInWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            errorMessage.textContent = error.message;
            loginBtn.textContent = originalText; // Revert on fail
        });
    // On success, onAuthStateChanged takes over and hides the form anyway
});

// 7. Handle Sign Up (With UI Feedback)
signupBtn.addEventListener('click', () => {
    errorMessage.textContent = "";
    
    const email = emailInput.value;
    const password = passwordInput.value;

    if(!email || !password) {
        errorMessage.textContent = "Please enter an email and password to sign up.";
        return;
    }

    // UI Feedback: "Syncing..." effect
    const originalText = signupBtn.textContent;
    signupBtn.textContent = "Creating Account...";

    createUserWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            errorMessage.textContent = error.message;
            signupBtn.textContent = originalText; // Revert on fail
        });
});

// 8. Handle Logout
logoutBtn.addEventListener('click', () => {
    signOut(auth).catch((error) => {
        console.error("Logout Error:", error);
    });
});
