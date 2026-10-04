"use client";

import { useEffect, useState } from "react";
import { createMealLog, getMealLogsForDate, deleteMealLog } from "@/lib/db";
import type { MealLog } from "@/types/schema";
import { todayString } from "@/lib/date";

function nowTimeString() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Empty box means "didn't track this", which is different from 0.
function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function Meals() {
  const [date, setDate] = useState(todayString());
  // Remembers which date the fetched meals belong to, so loading is derived
  // ("do I have data for the date on screen?") instead of being flipped by
  // hand, and one day's meals can never flash up under another day's date.
  const [loaded, setLoaded] = useState<{
    date: string;
    meals: MealLog[];
  } | null>(null);
  const [time, setTime] = useState(nowTimeString());
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    getMealLogsForDate(date).then((meals) => {
      if (!ignore) setLoaded({ date, meals });
    });
    return () => {
      ignore = true;
    };
  }, [date]);

  const loading = loaded?.date !== date;
  const meals = loaded?.date === date ? loaded.meals : [];

  const handleAdd = async () => {
    const [hours, minutes] = time.split(":").map(Number);
    const at = new Date(`${date}T00:00:00`);
    at.setHours(hours, minutes, 0, 0);

    setSaving(true);
    const created = await createMealLog({
      date,
      time: at.getTime(),
      calories: parseOptionalNumber(calories),
      protein: parseOptionalNumber(protein),
    });
    setLoaded((prev) =>
      prev && prev.date === created.date
        ? {
            date: prev.date,
            meals: [...prev.meals, created].sort((a, b) => a.time - b.time),
          }
        : prev,
    );
    setCalories("");
    setProtein("");
    setTime(nowTimeString());
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this meal entry?")) return;
    await deleteMealLog(id);
    setLoaded((prev) =>
      prev ? { ...prev, meals: prev.meals.filter((m) => m.id !== id) } : prev,
    );
  };

  const withCalories = meals.filter((m) => m.calories !== undefined);
  const withProtein = meals.filter((m) => m.protein !== undefined);
  const totalCalories = withCalories.reduce(
    (sum, m) => sum + (m.calories ?? 0),
    0,
  );
  const totalProtein = withProtein.reduce(
    (sum, m) => sum + (m.protein ?? 0),
    0,
  );

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-1 text-xl font-semibold">Meals</h1>
      <p className="mb-4 text-xs text-zinc-500">
        Totally optional. Log a time, add numbers only if you feel like it.
      </p>

      <label className="mb-4 block text-sm">
        Date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block rounded border px-3 py-2"
        />
      </label>

      <div className="mb-6 space-y-2 rounded border p-3">
        <div className="flex flex-wrap gap-2">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
            title="Time eaten"
          />
          <input
            type="number"
            min={0}
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="kcal (optional)"
            className="w-32 rounded border px-2 py-1 text-sm"
          />
          <input
            type="number"
            min={0}
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="protein g (optional)"
            className="w-40 rounded border px-2 py-1 text-sm"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:bg-zinc-300"
        >
          {saving ? "Adding..." : "Add meal"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : meals.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing logged for this day.</p>
      ) : (
        <>
          <div className="space-y-2">
            {meals.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded border px-3 py-2 text-sm"
              >
                <span className="font-medium">{formatTime(m.time)}</span>
                <span className="text-zinc-600">
                  {m.calories !== undefined ? `${m.calories} kcal` : "no kcal"}
                  {" · "}
                  {m.protein !== undefined
                    ? `${m.protein} g protein`
                    : "no protein"}
                </span>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="ml-auto text-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {(withCalories.length > 0 || withProtein.length > 0) && (
            <div className="mt-4 text-sm">
              <p className="font-medium">
                Total: {totalCalories} kcal · {totalProtein} g protein
              </p>
              <p className="text-xs text-zinc-500">
                Only counts meals where you entered a number, so it can run low
                on days you skipped some.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Meals;
