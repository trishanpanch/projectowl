import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const SettingsModal = ({ userId, onClose }) => {
    const [settings, setSettings] = useState({
        content: true,
        contact: true,
        conduct: true,
        commercial: true,
        custom_instructions: ''
    });
    const [safeList, setSafeList] = useState([]);
    const [newDomain, setNewDomain] = useState('');
    const [loading, setLoading] = useState(true);

    const db = getFirestore();

    useEffect(() => {
        const fetchSettings = async () => {
            if (!userId) return;
            try {
                const docRef = doc(db, 'users', userId, 'settings', 'safetyProfile');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings(prev => ({ ...prev, ...docSnap.data() }));
                }

                // Mock Safe List loading (or fetch from real doc if implemented)
                const safeListRef = doc(db, 'users', userId, 'settings', 'safeList');
                const safeListSnap = await getDoc(safeListRef);
                if (safeListSnap.exists()) {
                    setSafeList(safeListSnap.data().domains || []);
                }

            } catch (error) {
                console.error("Error loading settings:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [userId]);

    const handleSave = async () => {
        try {
            await setDoc(doc(db, 'users', userId, 'settings', 'safetyProfile'), settings, { merge: true });
            await setDoc(doc(db, 'users', userId, 'settings', 'safeList'), { domains: safeList }, { merge: true });
            onClose();
        } catch (err) {
            console.error("Error saving settings:", err);
            alert("Failed to save settings.");
        }
    };

    const toggleSetting = (key) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const addDomain = () => {
        if (newDomain && !safeList.includes(newDomain)) {
            setSafeList([...safeList, newDomain]);
            setNewDomain('');
        }
    };

    if (loading) return <div className="fixed inset-0 bg-black/80 flex items-center justify-center text-white">Loading...</div>;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 text-slate-100 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold">Customize Detection</h2>
                        <p className="text-slate-400 text-sm">Configure the 4 Pillars of Digital Safety</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>

                <div className="space-y-6">
                    {/* 1. Content */}
                    <div className="flex items-start space-x-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                        <input
                            type="checkbox"
                            checked={settings.content}
                            onChange={() => toggleSetting('content')}
                            className="mt-1 w-5 h-5 accent-indigo-500"
                        />
                        <div>
                            <h3 className="font-semibold text-indigo-400">1. Content (What they see)</h3>
                            <p className="text-sm text-slate-400 mt-1">Pornography, Graphic Violence, Hate Speech, Self-harm, and Fake News.</p>
                        </div>
                    </div>

                    {/* 2. Contact */}
                    <div className="flex items-start space-x-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                        <input
                            type="checkbox"
                            checked={settings.contact}
                            onChange={() => toggleSetting('contact')}
                            className="mt-1 w-5 h-5 accent-indigo-500"
                        />
                        <div>
                            <h3 className="font-semibold text-indigo-400">2. Contact (Who they talk to)</h3>
                            <p className="text-sm text-slate-400 mt-1">Predatory Grooming, Cyberbullying, Harassment, Stalking, and Parasocial Relationships.</p>
                        </div>
                    </div>

                    {/* 3. Conduct */}
                    <div className="flex items-start space-x-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                        <input
                            type="checkbox"
                            checked={settings.conduct}
                            onChange={() => toggleSetting('conduct')}
                            className="mt-1 w-5 h-5 accent-indigo-500"
                        />
                        <div>
                            <h3 className="font-semibold text-indigo-400">3. Conduct (How they behave)</h3>
                            <p className="text-sm text-slate-400 mt-1">Sexting, Bullying others, Illegal downloading, and Oversharing personal info.</p>
                        </div>
                    </div>

                    {/* 4. Commercial */}
                    <div className="flex items-start space-x-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                        <input
                            type="checkbox"
                            checked={settings.commercial}
                            onChange={() => toggleSetting('commercial')}
                            className="mt-1 w-5 h-5 accent-indigo-500"
                        />
                        <div>
                            <h3 className="font-semibold text-indigo-400">4. Commercial (How they are influenced)</h3>
                            <p className="text-sm text-slate-400 mt-1">Dark Patterns, Loot Boxes/Gambling, Undisclosed Influencer Marketing, and Data Harvesting.</p>
                        </div>
                    </div>

                    {/* Custom Instructions */}
                    <div className="pt-4 border-t border-slate-700">
                        <label className="block font-semibold mb-2">Dr. Owl's Custom Instructions</label>
                        <p className="text-xs text-slate-500 mb-2">Specific things you want Dr. Owl to watch for (e.g., "Roblox spending").</p>
                        <textarea
                            value={settings.custom_instructions}
                            onChange={(e) => setSettings(prev => ({ ...prev, custom_instructions: e.target.value }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:border-indigo-500 outline-none"
                            rows="3"
                        ></textarea>
                    </div>

                    {/* Safe List */}
                    <div className="pt-4 border-t border-slate-700">
                        <label className="block font-semibold mb-2">Safe List (Trusted Domains)</label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                                placeholder="example.com"
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm"
                            />
                            <button onClick={addDomain} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm">Add</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {safeList.map((domain, i) => (
                                <span key={i} className="bg-green-900/30 text-green-400 border border-green-900/50 px-2 py-1 rounded text-xs flex items-center">
                                    {domain}
                                    <button onClick={() => setSafeList(prev => prev.filter(d => d !== domain))} className="ml-2 hover:text-white">&times;</button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-lg shadow-indigo-500/20">Save Preferences</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
