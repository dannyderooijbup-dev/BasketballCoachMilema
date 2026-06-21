import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyASDFR8JquSrIRZZNR2URyBbFE9COdkUKQ",
  authDomain: "basketball-coach-gamestats.firebaseapp.com",
  projectId: "basketball-coach-gamestats",
  storageBucket: "basketball-coach-gamestats.firebasestorage.app",
  messagingSenderId: "457778095382",
  appId: "1:457778095382:web:e1eca3fcdeb2b5aee85c37",
  measurementId: "G-3NSVNNQZJ2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
