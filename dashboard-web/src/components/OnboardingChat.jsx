import React, { useState, useEffect, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const OnboardingChat = ({ onComplete }) => {
    const [messages, setMessages] = useState([
        {
            sender: 'owl',
            text: "Hoo there! I'm Dr. Owl. 🦉\n\nMy job isn't to spy on your child—it's to help you guide them. To do that, I need to know what *you* worry about most as a parent.\n\nIs it bullying? Overspending? Too much screen time? Talk to me."
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const auth = getAuth();
    const functions = getFunctions();
    const db = getFirestore();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = { sender: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const drOwlChat = httpsCallable(functions, 'drOwlChat');
            const response = await drOwlChat({
                message: input,
                history: messages // Send context if needed, or backend can handle state
            });

            const { reply, hiddenProfile } = response.data;

            // Check for hidden completion signal
            if (hiddenProfile) {
                // Save profile and finish
                if (auth.currentUser) {
                    await setDoc(doc(db, 'users', auth.currentUser.uid, 'settings', 'safetyProfile'), hiddenProfile);
                }
                setMessages(prev => [...prev, { sender: 'owl', text: reply || "Thanks! I've updated your safety profile. I'll keep a special eye out for those things." }]);
                setTimeout(() => {
                    onComplete();
                }, 3000);
            } else {
                setMessages(prev => [...prev, { sender: 'owl', text: reply }]);
            }

        } catch (error) {
            console.error("Error talking to Dr. Owl:", error);
            setMessages(prev => [...prev, { sender: 'owl', text: "Hoo! My feathers are ruffled. I couldn't reach the server. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') handleSend();
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-800">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm flex items-center justify-center border-b border-slate-100">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3 text-2xl">🦉</div>
                <div>
                    <h1 className="font-bold text-lg text-indigo-900">Dr. Owl</h1>
                    <p className="text-xs text-slate-500">Digital Wellness Expert</p>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.sender === 'user'
                                ? 'bg-indigo-600 text-white rounded-br-none'
                                : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none'
                            }`}>
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-slate-100 rounded-2xl p-4 rounded-bl-none shadow-sm flex items-center space-x-2">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white p-4 border-t border-slate-100">
                <div className="flex items-center space-x-2 bg-slate-50 rounded-full border border-slate-200 px-4 py-2 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all">
                    <input
                        type="text"
                        className="flex-1 bg-transparent outline-none text-slate-700 placeholder-slate-400"
                        placeholder="Type your reply..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={loading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingChat;
