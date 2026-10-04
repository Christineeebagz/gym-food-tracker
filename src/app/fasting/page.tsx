"use client";

import { useEffect, useState } from "react";
import {
  getFastingLog,
  upsertFastingLog,
  deleteFastingLog,
  getAllFastingLogs,
  getSettings,
} from "@/lib/db";
import type { FastingLog, FastingBreak, AppSettings } from "@/types/schema";
import { todayString, dateToString } from "@/lib/date";

const RECENT_DAYS_SHOWN = 14;

function recentDayStrings(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dateToString(d));
  }
  return days;
}

function nowTimeString() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.abs(ms) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function FastingScreen() {
  const date = todayString();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [log, setLog] = useState<FastingLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [mealTime, setMealTime] = useState(nowTimeString());
  const [now, setNow] = useState<number | null>(null);
  const [showBreakForm, setShowBreakForm] = useState(false);
  const [breakNote, setBreakNote] = useState("");
  const [allLogs, setAllLogs] = useState<FastingLog[]>([]);

  useEffect(() => {
    let ignore = false;
    Promise.all([getSettings(), getFastingLog(date), getAllFastingLogs()]).then(
      ([s, l, logs]) => {
        if (!ignore) {
          setSettings(s);
          setLog(l);
          setAllLogs(logs);
          setLoading(false);
        }
      },
    );
    return () => {
      ignore = true;
    };
  }, [date]);

  // Countdown display only needs minute-level accuracy, so a 30s tick is
  // plenty, no reason to re-render every second for a number nobody reads
  // that precisely.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  // Keeps the streak/history data in sync with whatever just happened to
  // today's log, without a full refetch, since a user staring at their own
  // streak count should see it move the instant they confirm or log a break.
  const syncAllLogs = (updatedLog: FastingLog | null) => {
    setAllLogs((prev) => {
      const filtered = prev.filter((l) => l.date !== date);
      return updatedLog ? [updatedLog, ...filtered] : filtered;
    });
  };

  const handleLogMeal = async () => {
    if (!settings) return;
    const [hours, minutes] = mealTime.split(":").map(Number);
    const firstMealAt = new Date(`${date}T00:00:00`);
    firstMealAt.setHours(hours, minutes, 0, 0);
    const firstMealAtMs = firstMealAt.getTime();

    // fastingWindowHours is the FAST's length (e.g. 16, as in "16:8"). The
    // eating window, the thing we're actually counting down to the end of
    // here, is what's left of the day once that fast is accounted for.
    const eatingWindowHours = 24 - settings.fastingWindowHours;
    const windowEndsAt = firstMealAtMs + eatingWindowHours * 60 * 60 * 1000;

    const newLog: FastingLog = {
      date,
      firstMealAt: firstMealAtMs,
      windowHours: settings.fastingWindowHours,
      windowEndsAt,
      status: "pending",
      breaks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await upsertFastingLog(date, newLog);
    setLog(newLog);
    syncAllLogs(newLog);
  };

  const handleUndo = async () => {
    const confirmed = confirm(
      "Undo today's fasting log? This removes today's entry entirely, you'll need to log your first meal again from scratch.",
    );
    if (!confirmed) return;
    await deleteFastingLog(date);
    setLog(null);
    syncAllLogs(null);
  };

  const handleConfirmCompleted = async () => {
    if (!log) return;
    const updated: FastingLog = {
      ...log,
      status: "completed",
      updatedAt: Date.now(),
    };
    await upsertFastingLog(date, updated);
    setLog(updated);
    syncAllLogs(updated);
  };

  // A fasting-safe drink is, definitionally, not a break, nothing to record.
  const handleLogSafeDrink = () => {
    setShowBreakForm(false);
  };

  const handleLogBreak = async () => {
    if (!log || !settings) return;
    const at = Date.now();
    const withinGrace =
      at - log.windowEndsAt <= settings.gracePeriodMinutes * 60 * 1000;
    const newBreak: FastingBreak = { at, note: breakNote.trim() || undefined };

    const updated: FastingLog = {
      ...log,
      breaks: [...log.breaks, newBreak],
      // Grace period exists specifically so a minor, close-to-the-line bite
      // doesn't get treated the same as an unambiguous break, per your
      // earlier decision. Outside grace, this flags immediately rather
      // than waiting for a separate confirmation step.
      status: withinGrace ? log.status : "broken",
      updatedAt: Date.now(),
    };
    await upsertFastingLog(date, updated);
    setLog(updated);
    syncAllLogs(updated);
    setShowBreakForm(false);
    setBreakNote("");
  };

  if (loading || now === null)
    return <p className="p-6 text-sm text-zinc-500">Loading...</p>;

  const completedCount = allLogs.filter((l) => l.status === "completed").length;
  const logsByDate = new Map(allLogs.map((l) => [l.date, l]));
  const recentDays = recentDayStrings(RECENT_DAYS_SHOWN);

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-semibold">Fasting</h1>

      <div className="mb-6 rounded border p-4">
        <p className="text-2xl font-semibold">
          {completedCount} days completed
        </p>
        <p className="mb-3 text-xs text-zinc-500">
          All-time, a broken day never takes this back down
        </p>
        <div className="flex gap-1">
          {recentDays.map((d) => {
            const dayLog = logsByDate.get(d);
            const color =
              dayLog?.status === "completed"
                ? "bg-green-500"
                : dayLog?.status === "broken"
                  ? "bg-amber-400"
                  : "bg-zinc-200";
            return (
              <div
                key={d}
                title={`${d}${dayLog ? `: ${dayLog.status}` : ": no log"}`}
                className={`h-3 w-3 rounded-full ${color}`}
              />
            );
          })}
        </div>
      </div>

      {!log ? (
        <div>
          <p className="mb-2 text-sm text-zinc-500">
            What time did you eat your first meal today?
          </p>
          <div className="flex gap-2">
            <input
              type="time"
              value={mealTime}
              onChange={(e) => setMealTime(e.target.value)}
              className="rounded border px-3 py-2"
            />
            <button
              onClick={handleLogMeal}
              className="rounded bg-black px-4 py-2 text-sm text-white"
            >
              Log first meal
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-zinc-500">
            First meal at{" "}
            {new Date(log.firstMealAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>

          {now < log.windowEndsAt ? (
            <>
              <p className="mt-4 text-3xl font-semibold">
                {formatDuration(log.windowEndsAt - now)}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                until your eating window closes
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 text-3xl font-semibold">Window closed</p>
              <p className="mt-1 text-sm text-zinc-500">
                {formatDuration(now - log.windowEndsAt)} ago
              </p>
            </>
          )}

          <p className="mt-4 text-xs text-zinc-400">
            Window ends at{" "}
            {new Date(log.windowEndsAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            ({log.windowHours}h fast)
          </p>

          {now >= log.windowEndsAt && (
            <div className="mt-6 space-y-3 border-t pt-4">
              {log.status === "completed" && (
                <p className="text-sm font-medium text-green-700">
                  ✓ Stayed within your window today
                </p>
              )}
              {log.status === "broken" && (
                <p className="text-sm font-medium text-amber-700">
                  Window was broken today
                </p>
              )}
              {log.status === "pending" && (
                <button
                  onClick={handleConfirmCompleted}
                  className="block w-full rounded bg-black px-4 py-2 text-sm text-white"
                >
                  I stayed within it
                </button>
              )}

              {!showBreakForm ? (
                <button
                  onClick={() => setShowBreakForm(true)}
                  className="text-sm text-blue-600"
                >
                  Log something I had
                </button>
              ) : (
                <div className="space-y-2 rounded border p-3">
                  <p className="text-sm text-zinc-500">What did you have?</p>
                  <div className="flex flex-wrap gap-2">
                    {settings?.fastingSafeDrinks.map((drink) => (
                      <button
                        key={drink}
                        onClick={handleLogSafeDrink}
                        className="rounded border px-3 py-1 text-sm"
                      >
                        {drink}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={breakNote}
                      onChange={(e) => setBreakNote(e.target.value)}
                      placeholder="Something else (optional note)"
                      className="flex-1 rounded border px-2 py-1 text-sm"
                    />
                    <button
                      onClick={handleLogBreak}
                      className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                    >
                      Log it
                    </button>
                  </div>
                  <button
                    onClick={() => setShowBreakForm(false)}
                    className="text-xs text-zinc-400"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {log.breaks.length > 0 && (
                <div className="text-xs text-zinc-500">
                  {log.breaks.map((b, i) => (
                    <div key={i}>
                      {new Date(b.at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {b.note ? `: ${b.note}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button onClick={handleUndo} className="mt-6 text-sm text-red-600">
            Undo today&apos;s log
          </button>
        </div>
      )}
    </div>
  );
}

export default FastingScreen;
