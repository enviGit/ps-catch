import React, { useState, useEffect } from "react";
import { X, Mail, Lock, Loader2, Gamepad2 } from "lucide-react";
import { supabase } from "./supabase";

const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setMessage(null);
      setEmail("");
      setPassword("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setMessage(
          "Success! Check your email for the confirmation link to activate your account.",
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div className="bg-white/90 dark:bg-slate-900/80 border border-black/5 dark:border-white/10 w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden backdrop-blur-2xl transition-all duration-500 animate-in fade-in zoom-in duration-300">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="p-8 relative z-10">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/30 text-white">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                {isLogin ? "Welcome back" : "Create account"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest px-1">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="email"
                  required
                  className="w-full bg-black/5 dark:bg-black/40 border border-transparent focus:border-blue-500 dark:focus:border-blue-500 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all duration-300"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest px-1">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="password"
                  required
                  className="w-full bg-black/5 dark:bg-black/40 border border-transparent focus:border-blue-500 dark:focus:border-blue-500 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all duration-300"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="text-rose-600 dark:text-rose-400 text-sm bg-rose-50 dark:bg-rose-400/10 p-4 rounded-2xl border border-rose-200 dark:border-rose-400/20 animate-shake">
                {error}
              </div>
            )}

            {message && (
              <div className="text-emerald-700 dark:text-emerald-400 text-sm bg-emerald-50 dark:bg-emerald-400/10 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-400/20">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.98] mt-4"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setMessage(null);
              }}
              className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {isLogin
                ? "New to PSCatch? Create an account"
                : "Already have an account? Sign in here"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
