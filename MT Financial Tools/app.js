// 1. Import Firebase functions directly from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut,
    sendPasswordResetEmail, // NEW: Forgot Password
    deleteUser // NEW: Delete Account
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// NEW: Import Firestore Database functions to check the Paywall Wristband
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const db = getFirestore(app); // NEW: Initialize the Database connection

// 4. Get UI Elements
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const paywallSection = document.getElementById('paywall-section'); // NEW
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const paywallLogoutBtn = document.getElementById('paywall-logout-btn'); // NEW
const userEmailDisplay = document.getElementById('user-email');
const errorMessage = document.getElementById('error-message');
const legalCheckbox = document.getElementById('legal-checkbox'); // NEW
const forgotPasswordLink = document.getElementById('forgot-password-link'); // NEW
const deleteAccountBtn = document.getElementById('delete-account-btn'); // NEW

// 5. Monitor Auth State & Enforce Paywall (Phase 2 & Phase 4)
onAuthStateChanged(auth, async (user) => { // Made async to await database checks
    
    // 1.0s: Firebase finished loading data. Push to 100%
    if(loadingProgress) loadingProgress.style.width = '100%';
    
    // 1.2s: Fade entire screen to 0 opacity
    setTimeout(() => {
        if(loadingScreen) loadingScreen.classList.add('fade-out');
    }, 400);

    // Smart UI routing based on Auth State and Expiration Date
    if (user) {
        // Step 1: Hide the login form immediately
        authSection.classList.add('hidden');
        userEmailDisplay.textContent = user.email;

        try {
            // Step 2: Check the Vault for their VIP Wristband
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            let hasAccess = false;

            if (docSnap.exists()) {
                const data = docSnap.data();
                // Check if accessExpiresAt exists in their file
                if (data.accessExpiresAt) {
                    // Convert Firebase Timestamp to a standard Javascript Date
                    const expiryDate = data.accessExpiresAt.toDate ? data.accessExpiresAt.toDate() : new Date(data.accessExpiresAt);
                    
                    // Step 3: Compare their expiration date to right now
                    if (expiryDate > new Date()) {
                        hasAccess = true;
                    }
                }
            }

            // Step 4: Route them based on the check
            if (hasAccess) {
                paywallSection.classList.add('hidden');
                dashboardSection.classList.remove('hidden'); // Show VIP Apps
            } else {
                dashboardSection.classList.add('hidden');
                paywallSection.classList.remove('hidden'); // Show Paywall Block
            }

        } catch (error) {
            console.error("Error checking access expiration:", error);
            // Security fallback: If the database fails to read, lock the doors.
            dashboardSection.classList.add('hidden');
            paywallSection.classList.remove('hidden'); 
        }

    } else {
        // User is logged out. Show Login, hide everything else.
        authSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        paywallSection.classList.add('hidden');
        userEmailDisplay.textContent = "";
    }
});

// 6. Handle Login (With UI Feedback)
authForm.addEventListener('submit', (e) => {
    e.preventDefault(); 
    errorMessage.textContent = ""; 
    errorMessage.style.color = "var(--danger-red)"; // Reset color
    
    // UI Feedback: "Syncing..." effect
    const originalText = loginBtn.textContent;
    loginBtn.textContent = "Authenticating...";
    
    const email = emailInput.value;
    const password = passwordInput.value;

    signInWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            errorMessage.textContent = "Invalid email or password.";
            loginBtn.textContent = originalText; // Revert on fail
        });
    // On success, onAuthStateChanged takes over.
});

// 7. Handle Sign Up (With UI Feedback & Legal Check)
signupBtn.addEventListener('click', () => {
    errorMessage.textContent = "";
    errorMessage.style.color = "var(--danger-red)"; // Reset color
    
    const email = emailInput.value;
    const password = passwordInput.value;

    if(!email || !password) {
        errorMessage.textContent = "Please enter an email and password to sign up.";
        return;
    }

    // NEW: The Legal Gatekeeper
    if(!legalCheckbox.checked) {
        errorMessage.textContent = "You must agree to the Terms & Conditions and Privacy Policy to create an account.";
        return;
    }

    // UI Feedback: "Syncing..." effect
    const originalText = signupBtn.textContent;
    signupBtn.textContent = "Creating Account...";

    createUserWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            if(error.code === 'auth/email-already-in-use') {
                errorMessage.textContent = "This email is already registered. Please sign in.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage.textContent = "Password should be at least 6 characters.";
            } else {
                errorMessage.textContent = error.message;
            }
            signupBtn.textContent = originalText; // Revert on fail
        });
});

// 8. Handle Forgot Password (NEW)
forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    errorMessage.textContent = "";
    const email = emailInput.value;

    if(!email) {
        errorMessage.textContent = "Please enter your email address in the box above, then click Forgot Password.";
        errorMessage.style.color = "var(--danger-red)";
        return;
    }

    sendPasswordResetEmail(auth, email)
        .then(() => {
            errorMessage.style.color = "var(--brand-green)"; // Turn text green for success
            errorMessage.textContent = "Password reset email sent! Please check your inbox.";
        })
        .catch((error) => {
            errorMessage.style.color = "var(--danger-red)";
            errorMessage.textContent = "Error sending reset email. Make sure the email is correct.";
        });
});

// 9. Handle Logouts
logoutBtn.addEventListener('click', () => {
    signOut(auth).catch((error) => console.error("Logout Error:", error));
});

paywallLogoutBtn.addEventListener('click', () => {
    signOut(auth).catch((error) => console.error("Logout Error:", error));
});

// 10. Handle Delete Account (NEW)
deleteAccountBtn.addEventListener('click', () => {
    const user = auth.currentUser;
    if (user) {
        // High-friction warning to prevent accidental deletions
        if(confirm("Are you absolutely sure you want to permanently delete your account? This will permanently erase your VIP access and all your saved portfolio data. This cannot be undone.")) {
            
            deleteUser(user).then(() => {
                alert("Your account has been permanently deleted.");
                // onAuthStateChanged will automatically kick them back to login
            }).catch((error) => {
                console.error("Error deleting user:", error);
                // Firebase requires a "recent login" to delete an account for security
                if (error.code === 'auth/requires-recent-login') {
                    alert("For security reasons, Firebase requires you to log out and log back in immediately before deleting your account.");
                } else {
                    alert("An error occurred: " + error.message);
                }
            });
        }
    }
});
