import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '../firebase-config.js';
import OnboardingChat from './components/OnboardingChat';
import Dashboard from './components/Dashboard';

// Initialize Firebase 
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [needsOnboarding, setNeedsOnboarding] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                await checkOnboardingStatus(currentUser.uid);
            } else {
                // For demo purposes, sign in anonymously if not signed in
                signInAnonymously(auth).catch(console.error);
            }
        });

        return () => unsubscribe();
    }, []);

    const checkOnboardingStatus = async (uid) => {
        try {
            const docRef = doc(db, 'users', uid, 'settings', 'safetyProfile');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setNeedsOnboarding(false);
            } else {
                setNeedsOnboarding(true);
            }
        } catch (error) {
            console.error("Error checking onboarding status:", error);
            setNeedsOnboarding(false);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (needsOnboarding) {
        return <OnboardingChat onComplete={() => setNeedsOnboarding(false)} />;
    }

    return (
        <Dashboard user={user} />
    );
}

export default App;
