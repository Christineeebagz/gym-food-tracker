"use client";

import { useEffect, useState } from "react";
import { getSettings, upsertSettings } from "@/lib/db";
import type { AppSettings } from "@/types/schema";

function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    getSettings().then((s) => {
      if (!ignore) {
        setSettings(s);
        setLoading(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  const applyChange = (updater: (prev: AppSettings) => AppSettings) => {
    setSettings((prev) => (prev ? updater(prev) : prev));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    await upsertSettings(settings);
    setDirty(false);
    setSaving(false);
  };

  const updateDrink = (index: number, value: string) => {
    applyChange((prev) => ({
      ...prev,
      fastingSafeDrinks: prev.fastingSafeDrinks.map((d, i) =>
        i === index ? value : d,
      ),
    }));
  };

  const addDrink = () => {
    applyChange((prev) => ({
      ...prev,
      fastingSafeDrinks: [...prev.fastingSafeDrinks, ""],
    }));
  };

  const removeDrink = (index: number) => {
    applyChange((prev) => ({
      ...prev,
      fastingSafeDrinks: prev.fastingSafeDrinks.filter((_, i) => i !== index),
    }));
  };

  if (loading || !settings)
    return <p className="p-6 text-sm text-zinc-500">Loading...</p>;

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-semibold">Settings</h1>

      <label className="mb-4 block text-sm">
        Fasting window (hours)
        <input
          type="number"
          min={1}
          max={23}
          value={settings.fastingWindowHours}
          onChange={(e) =>
            applyChange((prev) => ({
              ...prev,
              fastingWindowHours: Number(e.target.value),
            }))
          }
          className="mt-1 block w-24 rounded border px-3 py-2"
        />
        <span className="mt-1 block text-xs text-zinc-500">
          The length of your fast, e.g. 16 for a 16:8 schedule. Only affects
          days you log from now on, past days keep whatever window applied at
          the time.
        </span>
      </label>

      <label className="mb-4 block text-sm">
        Grace period (minutes)
        <input
          type="number"
          min={0}
          max={120}
          value={settings.gracePeriodMinutes}
          onChange={(e) =>
            applyChange((prev) => ({
              ...prev,
              gracePeriodMinutes: Number(e.target.value),
            }))
          }
          className="mt-1 block w-24 rounded border px-3 py-2"
        />
      </label>

      <label className="mb-4 block text-sm">
        Weight unit
        <select
          value={settings.weightUnit}
          onChange={(e) =>
            applyChange((prev) => ({
              ...prev,
              weightUnit: e.target.value as "kg" | "lb",
            }))
          }
          className="mt-1 block rounded border px-3 py-2"
        >
          <option value="kg">kg</option>
          <option value="lb">lb</option>
        </select>
        <span className="mt-1 block text-xs text-zinc-500">
          Changes how weights are labeled going forward. Numbers already logged
          aren&apos;t converted, a 20 stays a 20, only the letters next to it
          change.
        </span>
      </label>

      <div className="mb-6">
        <p className="mb-2 text-sm">Fasting-safe drinks</p>
        <div className="space-y-2">
          {settings.fastingSafeDrinks.map((drink, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={drink}
                onChange={(e) => updateDrink(i, e.target.value)}
                className="flex-1 rounded border px-2 py-1 text-sm"
              />
              <button onClick={() => removeDrink(i)} className="text-red-600">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button onClick={addDrink} className="mt-2 text-sm text-blue-600">
          + Add drink
        </button>
      </div>

      <button
        onClick={handleSave}
        disabled={!dirty || saving}
        className={`rounded px-4 py-2 text-sm text-white ${dirty ? "bg-black" : "cursor-not-allowed bg-zinc-300"}`}
      >
        {saving ? "Saving..." : dirty ? "Save" : "Saved"}
      </button>
    </div>
  );
}

export default Settings;
