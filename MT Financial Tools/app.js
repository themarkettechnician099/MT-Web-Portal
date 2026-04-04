// 1. Import Firebase functions directly from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut,
    sendPasswordResetEmail,
    deleteUser,
    EmailAuthProvider, // NEW: Required to verify password before deletion
    reauthenticateWithCredential // NEW: Required to verify password before deletion
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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
const loadingTextDisplay = document.getElementById('loading-text'); // NEW

setTimeout(() => {
    if(loadingProgress) loadingProgress.style.width = '92%';
}, 50);

// NEW: Function to dynamically drop the curtain during Auth events
function dropCurtain(message) {
    if(loadingTextDisplay) loadingTextDisplay.textContent = message;
    if(loadingScreen) loadingScreen.classList.remove('fade-out');
    if(loadingProgress) {
        loadingProgress.style.transition = 'none'; // Reset bar instantly
        loadingProgress.style.width = '0%';
        setTimeout(() => {
            loadingProgress.style.transition = 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
            loadingProgress.style.width = '85%';
        }, 50);
    }
}

// 3. Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); 

// 4. Get UI Elements
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const paywallSection = document.getElementById('paywall-section'); 
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const paywallLogoutBtn = document.getElementById('paywall-logout-btn'); 
const userEmailDisplay = document.getElementById('user-email');
const errorMessage = document.getElementById('error-message');
const forgotPasswordLink = document.getElementById('forgot-password-link'); 
const deleteAccountBtn = document.getElementById('delete-account-btn'); 

// NEW: UX Toggle Elements
const authTitle = document.getElementById('auth-title');
const authToggleLink = document.getElementById('auth-toggle-link');
const authToggleText = document.getElementById('auth-toggle-text');
const legalCheckContainer = document.getElementById('legal-check-container');
const legalCheckbox = document.getElementById('legal-checkbox'); 

// Delete Modal Elements
const deleteModalOverlay = document.getElementById('delete-modal-overlay');
const deletePasswordConfirm = document.getElementById('delete-password-confirm');
const deleteErrorMessage = document.getElementById('delete-error-message');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

// --- 4.5 UX TOGGLE LOGIC ---
let isSignUpMode = false;

authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    errorMessage.textContent = ""; 

    if (isSignUpMode) {
        authTitle.textContent = "Create your account.";
        loginBtn.classList.add('hidden');
        forgotPasswordLink.classList.add('hidden');
        signupBtn.classList.remove('hidden');
        legalCheckContainer.classList.remove('hidden');
        authToggleText.textContent = "Already have an account?";
        authToggleLink.textContent = "Log In";
    } else {
        authTitle.textContent = "Sign in to access your account.";
        signupBtn.classList.add('hidden');
        legalCheckContainer.classList.add('hidden');
        loginBtn.classList.remove('hidden');
        forgotPasswordLink.classList.remove('hidden');
        authToggleText.textContent = "Don't have an account?";
        authToggleLink.textContent = "Sign Up";
    }
});

// 5. Monitor Auth State & Enforce Paywall (Phase 2 & Phase 4)
onAuthStateChanged(auth, async (user) => { 
    
    if(loadingProgress) loadingProgress.style.width = '100%';
    
    setTimeout(() => {
        if(loadingScreen) loadingScreen.classList.add('fade-out');
    }, 400);

    if (user) {
        authSection.classList.add('hidden');
        userEmailDisplay.textContent = user.email;

        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            let hasAccess = false;

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.accessExpiresAt) {
                    const expiryDate = data.accessExpiresAt.toDate ? data.accessExpiresAt.toDate() : new Date(data.accessExpiresAt);
                    if (expiryDate > new Date()) {
                        hasAccess = true;
                    }
                }
            }

            if (hasAccess) {
                paywallSection.classList.add('hidden');
                dashboardSection.classList.remove('hidden'); 
            } else {
                dashboardSection.classList.add('hidden');
                paywallSection.classList.remove('hidden'); 
            }

        } catch (error) {
            console.error("Error checking access expiration:", error);
            dashboardSection.classList.add('hidden');
            paywallSection.classList.remove('hidden'); 
        }

    } else {
        authSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        paywallSection.classList.add('hidden');
        userEmailDisplay.textContent = "";

        // FIX: Reset stuck buttons and wipe password field on logout
        loginBtn.textContent = "Sign In";
        signupBtn.textContent = "Create Account";
        passwordInput.value = "";
    }
});

// 6. Handle Form Submission (Smartly routes Login vs Signup based on mode)
authForm.addEventListener('submit', (e) => {
    e.preventDefault(); 
    errorMessage.textContent = ""; 
    errorMessage.style.color = "var(--danger-red)"; 
    
    // If they press "Enter" while in Sign Up mode, trigger the signup logic instead!
    if (isSignUpMode) {
        signupBtn.click();
        return;
    }
    
    const email = emailInput.value;
    const password = passwordInput.value;

    // NEW: Drop the curtain immediately!
    dropCurtain("Authenticating Credentials...");

    signInWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            // Pull the curtain back up on fail
            if(loadingScreen) loadingScreen.classList.add('fade-out');
            errorMessage.textContent = "Invalid email or password.";
        });
});

// 7. Handle Sign Up
signupBtn.addEventListener('click', () => {
    errorMessage.textContent = "";
    errorMessage.style.color = "var(--danger-red)"; 
    
    const email = emailInput.value;
    const password = passwordInput.value;

    if(!email || !password) {
        errorMessage.textContent = "Please enter an email and password to sign up.";
        return;
    }

    if(!legalCheckbox.checked) {
        errorMessage.textContent = "You must agree to the Terms & Conditions and Privacy Policy to create an account.";
        return;
    }

    // NEW: Drop the curtain immediately!
    dropCurtain("Provisioning Secure Workspace...");

    createUserWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            // Pull the curtain back up on fail
            if(loadingScreen) loadingScreen.classList.add('fade-out');
            if(error.code === 'auth/email-already-in-use') {
                errorMessage.textContent = "This email is already registered. Please sign in.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage.textContent = "Password should be at least 6 characters.";
            } else {
                errorMessage.textContent = error.message;
            }
        });
});

// 8. Handle Forgot Password
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
            errorMessage.style.color = "var(--brand-green)"; 
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

// 10. Handle Delete Account (NUCLEAR LOCK)
// Step 1: Trigger the Modal
deleteAccountBtn.addEventListener('click', () => {
    deleteErrorMessage.textContent = ""; // Clear any old errors
    deletePasswordConfirm.value = ""; // Clear old password inputs
    deleteModalOverlay.classList.add('active'); // Turn on the red atmosphere
});

// Step 2: Process the Deletion
confirmDeleteBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    const password = deletePasswordConfirm.value;

    if (!user) return;

    if (!password) {
        deleteErrorMessage.textContent = "You must enter your password to proceed.";
        return;
    }

    // UI Feedback
    const originalText = confirmDeleteBtn.textContent;
    confirmDeleteBtn.textContent = "Erasing Data...";

    try {
        // Build the security credential using their current email and the password they just typed
        const credential = EmailAuthProvider.credential(user.email, password);

        // Force Firebase to verify the password against their servers
        await reauthenticateWithCredential(user, credential);

        // If the code reaches this line, the password was a perfect match. Incinerate the account.
        await deleteUser(user);

        // Clean up the UI
        deleteModalOverlay.classList.remove('active');
        alert("Your account and all associated data have been permanently erased.");
        // The onAuthStateChanged listener will automatically detect they are gone and kick them to the login screen.

    } catch (error) {
        // If the code jumps here, the password was wrong (or another error occurred)
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
            deleteErrorMessage.textContent = "Incorrect password. Deletion aborted.";
        } else {
            deleteErrorMessage.textContent = "An error occurred: " + error.message;
        }
        confirmDeleteBtn.textContent = originalText; // Reset button text
    }
});
