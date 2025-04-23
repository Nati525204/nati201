"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("login");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        router.push("/dashboard");
      }
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (mode === "signup" && password !== confirmPassword) {
      return setMessage("הסיסמאות לא תואמות");
    }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return setMessage("שגיאה: " + error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/dashboard`,
        },
      });
      if (error) return setMessage("שגיאה: " + error.message);
      setMessage("נשלח מייל אישור. אנא בדוק את הדואר שלך.");
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1e293b] relative overflow-hidden">
      {/* רקע מונפש */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-800/30 to-cyan-700/20 animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md p-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl text-white rtl"
      >
        <h1 className="text-3xl font-bold text-center mb-6 drop-shadow text-blue-200">
          {mode === "login" ? "התחברות" : "הרשמה"} למערכת ⏱️
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm mb-1 text-blue-100">אימייל</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="name@email.com"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-blue-100">סיסמה</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          {mode === "signup" && (
            <div>
              <label className="block text-sm mb-1 text-blue-100">
                אימות סיסמה
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
          )}

          {message && (
            <p className="text-red-400 text-sm text-center">{message}</p>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold py-2 rounded-lg transition duration-300 shadow-md"
          >
            {mode === "login" ? "התחבר 🔐" : "הרשם 📝"}
          </button>
        </form>

        <div className="mt-6 text-center text-blue-200">
          {mode === "login" ? (
            <p>
              אין לך חשבון?{" "}
              <button
                onClick={() => setMode("signup")}
                className="underline hover:text-white transition"
              >
                הרשם כאן
              </button>
            </p>
          ) : (
            <p>
              כבר יש לך חשבון?{" "}
              <button
                onClick={() => setMode("login")}
                className="underline hover:text-white transition"
              >
                התחבר
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
