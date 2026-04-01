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

// 5. Monitor Auth State (Checks if user is logged in or out automatically)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is logged in: Hide auth, show dashboard
        authSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        userEmailDisplay.textContent = user.email;
    } else {
        // User is logged out: Show auth, hide dashboard
        authSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        userEmailDisplay.textContent = "";
    }
});

// 6. Handle Login
authForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Prevent page reload
    errorMessage.textContent = ""; // Clear old errors
    const email = emailInput.value;
    const password = passwordInput.value;

    signInWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            errorMessage.textContent = error.message;
        });
});

// 7. Handle Sign Up
signupBtn.addEventListener('click', () => {
    errorMessage.textContent = "";
    const email = emailInput.value;
    const password = passwordInput.value;

    if(!email || !password) {
        errorMessage.textContent = "Please enter an email and password to sign up.";
        return;
    }

    createUserWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            errorMessage.textContent = error.message;
        });
});

// 8. Handle Logout
logoutBtn.addEventListener('click', () => {
    signOut(auth).catch((error) => {
        console.error("Logout Error:", error);
    });
});