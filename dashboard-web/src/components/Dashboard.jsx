import React, { useState, useEffect } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import SettingsModal from './SettingsModal';

const Dashboard = ({ user }) => {
    const [showSettings, setShowSettings] = useState(false);
    const [history, setHistory] = useState([]); // In a real app, verify this loads from Firestore

    const auth = getAuth();

    const handleLogout = () => {
        signOut(auth).catch(console.error);
    };

    return (
        <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
            {/* Sidebar - Event List */}
            <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-950">
                <div className="p-4 border-b border-slate-800">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <span className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">O</span>
                        Project Owl
                    </h1>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    <p className="text-center text-slate-600 text-sm mt-10">No recent events.</p>
                    {/* Map history items here */}
                </div>
            </div>

            {/* Main Stage - Daily Reel */}
            <div className="flex-1 flex flex-col relative">

                {/* Header */}
                <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/50 backdrop-blur">
                    <div className="text-slate-400 text-sm">
                        Active Monitoring for: <span className="text-indigo-400 font-medium">{user?.email || 'Demo User'}</span>
                        <span className="ml-4 text-xs bg-slate-800 px-2 py-1 rounded text-slate-500 select-all cursor-pointer" title="Click to Copy">UID: {user?.uid}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">📄 Request Daily Report</button>
                        <button onClick={handleLogout} className="text-slate-400 hover:text-white px-3 py-2 text-sm">Sign Out</button>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 relative flex items-center justify-center bg-radial-at-c from-slate-900 to-slate-950">
                    {/* Reel Player Placeholder */}
                    <div className="text-center text-slate-600">
                        <div className="text-6xl mb-4 opacity-20">🦉</div>
                        <p>Select an event from the sidebar to review.</p>
                    </div>

                    {/* Controls Overlay */}
                    <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
                        <button className="px-6 py-3 bg-white text-slate-900 rounded-full font-bold hover:bg-slate-200 transition-colors shadow-lg">▶ Play Daily Reel</button>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="px-6 py-3 bg-slate-800/80 backdrop-blur text-white border border-slate-700 rounded-full font-medium hover:bg-slate-700 transition-colors"
                        >
                            ⚙️ Detection Settings
                        </button>
                    </div>
                </div>

            </div>

            {/* Modals */}
            {showSettings && <SettingsModal userId={user?.uid} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default Dashboard;
