"use client";

import { useEffect, useState } from "react";
import { getDayNote, upsertDayNote, deleteDayNote } from "@/lib/db";
import { todayString } from "@/lib/date";

function Notes() {
  const [date, setDate] = useState(todayString());
  const [loaded, setLoaded] = useState<{ date: string; note: string } | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    getDayNote(date).then((existing) => {
      if (!ignore) {
        const text = existing?.note ?? "";
        setLoaded({ date, note: text });
        setNote(text);
        setDirty(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, [date]);

  const loading = loaded?.date !== date;

  const handleChange = (value: string) => {
    setNote(value);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await upsertDayNote(date, note);
    setLoaded({ date, note });
    setDirty(false);
    setSaving(false);
  };

  const handleClear = async () => {
    const confirmed = confirm("Clear this day's note? This can't be undone.");
    if (!confirmed) return;
    await deleteDayNote(date);
    setNote("");
    setLoaded({ date, note: "" });
    setDirty(false);
  };

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-1 text-xl font-semibold">Notes</h1>
      <p className="mb-4 text-xs text-zinc-500">
        Whatever&apos;s on your mind for the day. Optional.
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

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : (
        <>
          <textarea
            value={note}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Anything you want to remember about today..."
            rows={6}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className={`rounded px-4 py-2 text-sm text-white ${
                dirty ? "bg-black" : "cursor-not-allowed bg-zinc-300"
              }`}
            >
              {saving ? "Saving..." : dirty ? "Save" : "Saved"}
            </button>
            {loaded?.note && (
              <button onClick={handleClear} className="text-sm text-red-600">
                Clear note
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Notes;
