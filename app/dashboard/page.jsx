"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Initialize Supabase client outside the component
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [settings, setSettings] = useState({});
  const [message, setMessage] = useState("");
  const [isTiming, setIsTiming] = useState(false);
  const [liveTime, setLiveTime] = useState("00:00:00");
  const [isLoading, setIsLoading] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);

  // Initialize database tables if they don't exist
  const initializeDatabase = async () => {
    try {
      // Check if work_hours table exists
      const { error: checkError } = await supabase
        .from("work_hours")
        .select("id")
        .limit(1);

      if (checkError) {
        console.log("Creating work_hours table...");
        // Create work_hours table
        const { error: createError } = await supabase.rpc(
          "create_work_hours_table"
        );
        if (createError) {
          console.error("Error creating work_hours table:", createError);
        }
      }

      // Check if work_settings table exists
      const { error: settingsCheckError } = await supabase
        .from("work_settings")
        .select("user_id")
        .limit(1);

      if (settingsCheckError) {
        console.log("Creating work_settings table...");
        // Create work_settings table
        const { error: createSettingsError } = await supabase.rpc(
          "create_work_settings_table"
        );
        if (createSettingsError) {
          console.error(
            "Error creating work_settings table:",
            createSettingsError
          );
        }
      }

      setDbInitialized(true);
    } catch (error) {
      console.error("Database initialization error:", error);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data?.user) {
          router.push("/auth");
        } else {
          setUser(data.user);
          await initializeDatabase();
          fetchEntries(data.user.id);
          fetchSettings(data.user.id);
          const storedStartTime = localStorage.getItem("startTime");
          if (storedStartTime) {
            setStartTime(Number(storedStartTime));
            setIsTiming(true);
          }
        }
      } catch (error) {
        console.error("Auth error:", error);
        setMessage("שגיאת התחברות");
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    let interval;
    if (isTiming && startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const diff = now - startTime;
        const hours = String(Math.floor(diff / 3600000)).padStart(2, "0");
        const minutes = String(Math.floor((diff % 3600000) / 60000)).padStart(
          2,
          "0"
        );
        const seconds = String(Math.floor((diff % 60000) / 1000)).padStart(
          2,
          "0"
        );
        setLiveTime(`${hours}:${minutes}:${seconds}`);
      }, 1000);
    } else {
      setLiveTime("00:00:00");
    }
    return () => clearInterval(interval);
  }, [isTiming, startTime]);

  useEffect(() => {
    if (message) {
      const timeout = setTimeout(() => {
        setMessage("");
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [message]);

  const toggleTimer = async () => {
    if (!isTiming) {
      const now = Date.now();
      setStartTime(now);
      localStorage.setItem("startTime", now.toString());
      setIsTiming(true);
      setMessage("תזמון התחיל...");
    } else {
      await handleStop();
    }
  };

  const handleStop = async () => {
    try {
      setIsLoading(true);

      if (!startTime) {
        setMessage("לא נמצא זמן התחלה תקין.");
        setIsLoading(false);
        return;
      }

      if (!user || !user.id) {
        setMessage("משתמש לא מזוהה, נא להתחבר מחדש");
        setIsLoading(false);
        return;
      }

      if (!dbInitialized) {
        await initializeDatabase();
      }

      const now = Date.now();
      const dateStr = new Date().toISOString().split("T")[0];
      const target = settings[getTodayKey()] || 0;
      const workedHours = ((now - startTime) / (1000 * 60 * 60)).toFixed(2);
      const startVal = new Date(startTime).toTimeString().slice(0, 5);
      const endVal = new Date(now).toTimeString().slice(0, 5);

      // Create a complete record object
      const record = {
        user_id: user.id,
        date: dateStr,
        goal: target,
        actual: Number.parseFloat(workedHours),
        start_time: startVal,
        end_time: endVal,
        note: "רגיל",
        created_at: new Date().toISOString(),
      };

      console.log("Inserting record:", record);

      const { error, data } = await supabase
        .from("work_hours")
        .insert(record)
        .select();

      if (error) {
        console.error("Error saving work day:", error);
        setMessage(
          `שגיאה בשמירת היום: ${
            error.message || error.details || JSON.stringify(error)
          }`
        );
      } else {
        console.log("Work day saved successfully:", data);
        setMessage("היום נשמר בהצלחה!");
        await fetchEntries(user.id);
        setStartTime(null);
        localStorage.removeItem("startTime");
        setIsTiming(false);
      }
    } catch (error) {
      console.error("Stop error:", error);
      setMessage(
        `שגיאה בסיום יום העבודה: ${error.message || JSON.stringify(error)}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getTodayKey = () => {
    const dayIndex = new Date().getDay();
    return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][dayIndex];
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/auth");
    } catch (error) {
      console.error("Logout error:", error);
      setMessage("שגיאה בהתנתקות");
    }
  };

  const fetchSettings = async (userId) => {
    try {
      if (!dbInitialized) {
        await initializeDatabase();
      }

      const { data, error } = await supabase
        .from("work_settings")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Settings fetch error:", error);
      } else if (data) {
        setSettings(data);
      } else {
        // Create default settings if none exist
        const defaultSettings = {
          user_id: userId,
          sun: 8,
          mon: 8,
          tue: 8,
          wed: 8,
          thu: 8,
          fri: 4,
          sat: 0,
        };

        const { error: insertError } = await supabase
          .from("work_settings")
          .insert(defaultSettings);

        if (insertError) {
          console.error("Error creating default settings:", insertError);
        } else {
          setSettings(defaultSettings);
        }
      }
    } catch (error) {
      console.error("Settings error:", error);
    }
  };

  const fetchEntries = async (userId) => {
    try {
      if (!dbInitialized) {
        await initializeDatabase();
      }

      const { data, error } = await supabase
        .from("work_hours")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: true });

      if (error) {
        console.error("Entries fetch error:", error);
      } else if (data) {
        setEntries(data);
      }
    } catch (error) {
      console.error("Entries error:", error);
    }
  };

  const markDay = async (type) => {
    try {
      setIsLoading(true);

      if (!user || !user.id) {
        setMessage("משתמש לא מזוהה, נא להתחבר מחדש");
        setIsLoading(false);
        return;
      }

      if (!dbInitialized) {
        await initializeDatabase();
      }

      const dateStr = new Date().toISOString().split("T")[0];
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);

      // Create a record with dummy start_time and end_time to satisfy NOT NULL constraint
      const record = {
        user_id: user.id,
        date: dateStr,
        goal: 0,
        actual: 0,
        start_time: currentTime, // Use current time as dummy value
        end_time: currentTime, // Use current time as dummy value
        note: type,
        created_at: new Date().toISOString(),
      };

      console.log("Marking day:", record);

      const { error, data } = await supabase
        .from("work_hours")
        .insert(record)
        .select();

      if (error) {
        console.error("Mark day error:", error);
        setMessage(
          `שגיאה בהוספת יום ${type}: ${
            error.message || error.details || JSON.stringify(error)
          }`
        );
      } else {
        console.log("Day marked successfully:", data);
        setMessage(`התווסף יום ${type}`);
        await fetchEntries(user.id);
      }
    } catch (error) {
      console.error("Mark day error:", error);
      setMessage(
        `שגיאה בהוספת יום ${type}: ${error.message || JSON.stringify(error)}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualEntry = async () => {
    try {
      setIsLoading(true);

      if (!manualStart || !manualEnd) {
        setMessage("נא להזין שעת התחלה ושעת סיום");
        setIsLoading(false);
        return;
      }

      if (!user || !user.id) {
        setMessage("משתמש לא מזוהה, נא להתחבר מחדש");
        setIsLoading(false);
        return;
      }

      if (!dbInitialized) {
        await initializeDatabase();
      }

      const [h1, m1] = manualStart.split(":").map(Number);
      const [h2, m2] = manualEnd.split(":").map(Number);

      // Check if end time is before start time
      if (h2 < h1 || (h2 === h1 && m2 < m1)) {
        setMessage("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
        setIsLoading(false);
        return;
      }

      const workedHours = ((h2 * 60 + m2 - (h1 * 60 + m1)) / 60).toFixed(2);
      const dateStr = new Date().toISOString().split("T")[0];
      const target = settings[getTodayKey()] || 0;

      // Create a complete record object
      const record = {
        user_id: user.id,
        date: dateStr,
        goal: target,
        actual: Number.parseFloat(workedHours),
        start_time: manualStart,
        end_time: manualEnd,
        note: "ידני",
        created_at: new Date().toISOString(),
      };

      console.log("Manual entry:", record);

      const { error, data } = await supabase
        .from("work_hours")
        .insert(record)
        .select();

      if (error) {
        console.error("Manual entry error:", error);
        setMessage(
          `שגיאה בהזנה ידנית: ${
            error.message || error.details || JSON.stringify(error)
          }`
        );
      } else {
        console.log("Manual entry saved successfully:", data);
        setMessage("הוזן בהצלחה באופן ידני");
        await fetchEntries(user.id);
        setManualStart("");
        setManualEnd("");
      }
    } catch (error) {
      console.error("Manual entry error:", error);
      setMessage(
        `שגיאה בהזנה ידנית: ${error.message || JSON.stringify(error)}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const exportExcel = () => {
    try {
      if (entries.length === 0) {
        setMessage("אין נתונים לייצוא");
        return;
      }

      const sheet = entries.map((e) => ({
        תאריך: e.date,
        התחלה: e.start_time || "-",
        סיום: e.end_time || "-",
        שעות: e.actual ? e.actual.toFixed(2) : "0.00",
        סוג: e.note || "רגיל",
      }));

      const worksheet = XLSX.utils.json_to_sheet(sheet);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "שעות עבודה");
      XLSX.writeFile(workbook, "שעות_עבודה.xlsx");

      setMessage("הקובץ יוצא בהצלחה");
    } catch (error) {
      console.error("Excel export error:", error);
      setMessage("שגיאה בייצוא לאקסל");
    }
  };

  const shareWhatsapp = () => {
    try {
      const text = encodeURIComponent("הדוח שלך מוכן. מצורף דוח שעות עבודה 📊");
      window.open(`https://wa.me/?text=${text}`);
    } catch (error) {
      console.error("WhatsApp share error:", error);
      setMessage("שגיאה בשיתוף בוואצאפ");
    }
  };

  const shareEmail = () => {
    try {
      const subject = encodeURIComponent("דוח שעות עבודה");
      const body = encodeURIComponent("היי, מצורף דוח השעות שלך.");
      window.open(`mailto:?subject=${subject}&body=${body}`);
    } catch (error) {
      console.error("Email share error:", error);
      setMessage("שגיאה בשיתוף במייל");
    }
  };

  const resetTable = async () => {
    try {
      const confirm = window.confirm(
        "האם אתה בטוח שברצונך לאפס את כל הנתונים?"
      );

      if (!confirm || !user || !user.id) return;

      setIsLoading(true);

      const { error } = await supabase
        .from("work_hours")
        .delete()
        .eq("user_id", user.id);

      if (error) {
        console.error("Reset table error:", error);
        setMessage("שגיאה באיפוס הטבלה");
      } else {
        setMessage("הטבלה אופסה בהצלחה!");
        await fetchEntries(user.id);
      }
    } catch (error) {
      console.error("Reset table error:", error);
      setMessage("שגיאה באיפוס הטבלה");
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate totals safely
  const totalActual = entries.reduce((sum, e) => sum + (e.actual || 0), 0);

  // Prepare chart data
  const chartData = entries.map((e) => ({
    date: e.date,
    בוצע: e.actual || 0,
    יעד: e.goal || 0,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-800/30 to-cyan-700/20 animate-pulse" />
      <motion.div className="relative z-10 max-w-3xl mx-auto p-6 text-right rtl bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl mt-8">
        <div className="flex justify-between mb-4">
          <div>
            {!dbInitialized && (
              <span className="bg-yellow-500 text-black px-2 py-1 rounded text-sm">
                מאתחל מסד נתונים...
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="bg-gray-700 hover:bg-gray-800 text-blue-200 px-4 py-2 rounded"
            disabled={isLoading}
          >
            🚪 התנתק
          </button>
        </div>

        <h1 className="text-2xl font-bold mb-4 text-blue-300">שעון נוכחות</h1>
        {message && (
          <p className="text-orange-400 mb-4 p-2 bg-black/30 rounded">
            {message}
          </p>
        )}

        <div className="mb-4">
          <button
            onClick={toggleTimer}
            disabled={isLoading || !dbInitialized}
            className={`${
              isTiming
                ? "bg-red-500 hover:bg-red-600"
                : "bg-green-500 hover:bg-green-600"
            } text-blue-200 px-6 py-3 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading
              ? "מעבד..."
              : isTiming
              ? "סיום יום עבודה"
              : "התחל יום עבודה"}
          </button>
          {isTiming && (
            <div className="mt-2 text-blue-200 text-xl">⏱ {liveTime}</div>
          )}
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => markDay("חופשה")}
            disabled={isLoading || !dbInitialized}
            className="bg-yellow-400 hover:bg-yellow-500 text-blue-700 px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🏖️ חופשה
          </button>
          <button
            onClick={() => markDay("מחלה")}
            disabled={isLoading || !dbInitialized}
            className="bg-orange-400 hover:bg-orange-500 text-blue-200 px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🤒 מחלה
          </button>
        </div>

        <div className="mb-6">
          <label className="block mb-1 text-blue-400">הזנת שעות ידנית:</label>
          <div className="flex gap-4 mb-2">
            <input
              type="time"
              value={manualStart}
              onChange={(e) => setManualStart(e.target.value)}
              className="border px-4 py-2 rounded w-full bg-gray-800 text-white"
              disabled={isLoading || !dbInitialized}
            />
            <input
              type="time"
              value={manualEnd}
              onChange={(e) => setManualEnd(e.target.value)}
              className="border px-4 py-2 rounded w-full bg-gray-800 text-white"
              disabled={isLoading || !dbInitialized}
            />
          </div>
          <button
            onClick={handleManualEntry}
            disabled={isLoading || !manualStart || !manualEnd || !dbInitialized}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "מעבד..." : "💾 שמור דיווח ידני"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border text-center bg-black text-white rounded-lg overflow-hidden">
            <thead className="bg-gray-900 text-blue-300">
              <tr>
                <th className="p-2">תאריך</th>
                <th className="p-2">שעת התחלה</th>
                <th className="p-2">שעת סיום</th>
                <th className="p-2">סה"כ שעות</th>
                <th className="p-2">סוג</th>
              </tr>
            </thead>
            <tbody>
              {entries.length > 0 ? (
                entries.map((e, idx) => (
                  <tr key={idx} className="border-t border-gray-700">
                    <td className="p-2">{e.date}</td>
                    <td className="p-2">{e.start_time || "-"}</td>
                    <td className="p-2">{e.end_time || "-"}</td>
                    <td className="p-2">{(e.actual || 0).toFixed(2)}</td>
                    <td className="p-2">{e.note || "רגיל"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-4 text-center">
                    אין נתונים להצגה
                  </td>
                </tr>
              )}
              <tr className="font-bold bg-gray-800 text-blue-200">
                <td className="p-2">סה"כ</td>
                <td className="p-2">-</td>
                <td className="p-2">-</td>
                <td className="p-2">{totalActual.toFixed(2)}</td>
                <td className="p-2"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap gap-4 justify-end">
          <button
            onClick={exportExcel}
            disabled={isLoading || entries.length === 0}
            className="bg-green-800 hover:bg-green-900 text-blue-200 px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📥 ייצוא לאקסל
          </button>
          <button
            onClick={shareEmail}
            disabled={isLoading}
            className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📧 שלח במייל
          </button>
          <button
            onClick={shareWhatsapp}
            disabled={isLoading}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📲 שלח בוואצאפ
          </button>
          <button
            onClick={resetTable}
            disabled={isLoading || entries.length === 0}
            className="bg-red-700 hover:bg-red-800 text-blue-200 px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🗑️ איפוס טבלה
          </button>
        </div>

        {entries.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-blue-400 mb-4">
              גרף שעות שבועי
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#fff" />
                <YAxis stroke="#fff" />
                <Tooltip />
                <Legend />
                <Bar dataKey="בוצע" fill="#3b82f6" />
                <Bar dataKey="יעד" fill="#facc15" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>
    </div>
  );
}
