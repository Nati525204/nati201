"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const defaultDays = [
  { name: "ראשון", key: "sun" },
  { name: "שני", key: "mon" },
  { name: "שלישי", key: "tue" },
  { name: "רביעי", key: "wed" },
  { name: "חמישי", key: "thu" },
  { name: "שישי", key: "fri" },
  { name: "שבת", key: "sat" },
];

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser(data.user);
        loadSettings(data.user.id);
      }
    });
  }, []);

  const loadSettings = async (userId) => {
    const { data } = await supabase
      .from("work_settings")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (data) setSettings(data);
  };

  const saveSettings = async () => {
    if (!user) return;
    const payload = { user_id: user.id, ...settings };
    const { error } = await supabase
      .from("work_settings")
      .upsert(payload, { onConflict: ["user_id"] });
    setMessage(error ? "שגיאה בשמירה" : "הגדרות נשמרו בהצלחה");
  };

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: parseFloat(value) }));
  };

  return (
    <div className="max-w-xl mx-auto rtl p-6 bg-gray-900 text-white rounded-lg shadow-lg mt-10">
      <h1 className="text-2xl font-bold mb-6">הגדרות שעות עבודה</h1>

      {defaultDays.map((day) => (
        <div key={day.key} className="mb-4 flex justify-between items-center">
          <label>{day.name}:</label>
          <input
            type="number"
            value={settings[day.key] || ""}
            onChange={(e) => handleChange(day.key, e.target.value)}
            placeholder="שעות מתוכננות"
            className="border rounded px-2 py-1 text-black w-1/2"
          />
        </div>
      ))}

      <button
        onClick={saveSettings}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        שמור הגדרות
      </button>

      {message && <p className="text-orange-400 mt-4">{message}</p>}
    </div>
  );
}
