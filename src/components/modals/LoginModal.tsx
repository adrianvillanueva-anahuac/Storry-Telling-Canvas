import React, { useState } from 'react';
import { UserProfile } from '../../types/workflow';
import { KeyRound, ShieldCheck, User, Workflow } from 'lucide-react';

interface LoginModalProps {
  onLogin: (user: UserProfile) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('Director');
  const [pin, setPin] = useState('1234');
  const [role, setRole] = useState<'Admin' | 'Editor' | 'Viewer'>('Admin');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setIsLoading(true);
    setError('');

    // Instant local login
    setTimeout(() => {
      onLogin({
        name: username.trim(),
        role: role,
        email: `${username.toLowerCase().trim()}@workspace.local`,
        isRegistered: true,
      });
      setIsLoading(false);
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-sm shadow-2xl p-7 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 mx-auto flex items-center justify-center shadow-lg">
          <Workflow className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-neutral-100 tracking-tight">Workspace Login</h2>
          <p className="text-xs text-neutral-400 mt-1">Enter your credentials to access the canvas</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
          <div>
            <label className="text-xs text-neutral-400 block mb-1">Username</label>
            <div className="relative">
              <User className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username (e.g. Director, Artist)"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-100 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-neutral-400 block mb-1">Access PIN</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-100 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-neutral-400 block mb-1">Project Role</label>
            <div className="relative">
              <ShieldCheck className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5 pointer-events-none" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'Admin' | 'Editor' | 'Viewer')}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-100 outline-none focus:border-blue-500"
              >
                <option value="Admin">Admin (Full Edit & Delete Access)</option>
                <option value="Editor">Editor (Edit Nodes & Annotations)</option>
                <option value="Viewer">Viewer (Read-Only Canvas)</option>
              </select>
            </div>
          </div>

          {error && <p className="text-xs text-red-400 font-medium text-center">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer mt-2"
          >
            {isLoading ? 'Verifying...' : 'Access Canvas'}
          </button>
        </form>
      </div>
    </div>
  );
};
