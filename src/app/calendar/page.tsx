"use client";

import { useEffect, useState } from "react";
import { getAllGymSessions, getAllFastingLogs } from "@/lib/db";
import type { GymSession, SetEntry, FastingLog } from "@/types/schema";
import { dateToString, todayString } from "@/lib/date";

function formatSet(set: SetEntry): string {
  if (set.skipped) return "skipped";
  return set.weight !== undefined
    ? `${set.reps} reps @ ${set.weight}kg`
    : `${set.reps} reps`;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function Calendar() {
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [fastingLogs, setFastingLogs] = useState<FastingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const today = todayString();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([getAllGymSessions(), getAllFastingLogs()]).then(
      ([gymData, fastingData]) => {
        if (!ignore) {
          setSessions(gymData);
          setFastingLogs(fastingData);
          setLoading(false);
        }
      },
    );
    return () => {
      ignore = true;
    };
  }, []);

  if (loading) return <p className="p-6 text-sm text-zinc-500">Loading...</p>;

  const sessionsByDate = new Map<string, GymSession[]>();
  for (const s of sessions) {
    const existing = sessionsByDate.get(s.date) ?? [];
    existing.push(s);
    sessionsByDate.set(s.date, existing);
  }

  const fastingByDate = new Map<string, FastingLog>();
  for (const f of fastingLogs) {
    fastingByDate.set(f.date, f);
  }

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();

  const cells: (string | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      dateToString(new Date(viewYear, viewMonth, i + 1)),
    ),
  ];

  const goToPrevMonth = () => {
    setSelectedDate(null);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    setSelectedDate(null);
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const colorFor = (dateStr: string): string => {
    if (dateStr > today) return "bg-red-100 text-red-700";
    if (sessionsByDate.has(dateStr)) return "bg-green-100 text-green-700";
    return "bg-yellow-100 text-yellow-700";
  };

  // Gym gets the cell's main color. Fasting status rides along as a small
  // dot instead, since a day can be strong on one and not the other.
  const fastingDotFor = (dateStr: string): string | null => {
    const log = fastingByDate.get(dateStr);
    if (!log) return null;
    if (log.status === "completed") return "bg-green-600";
    if (log.status === "broken") return "bg-amber-600";
    return null;
  };

  const selectedSessions = selectedDate
    ? (sessionsByDate.get(selectedDate) ?? [])
    : [];
  const selectedFasting = selectedDate
    ? fastingByDate.get(selectedDate)
    : undefined;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Calendar</h1>

      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={goToPrevMonth}
          className="rounded border px-3 py-1 text-sm"
        >
          ←
        </button>
        <p className="font-medium">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </p>
        <button
          onClick={goToNextMonth}
          className="rounded border px-3 py-1 text-sm"
        >
          →
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-zinc-400">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateStr, i) => {
          if (dateStr === null) return <div key={`blank-${i}`} />;
          const dot = fastingDotFor(dateStr);
          return (
            <button
              key={dateStr}
              onClick={() =>
                setSelectedDate(dateStr === selectedDate ? null : dateStr)
              }
              className={`relative aspect-square rounded text-sm ${colorFor(dateStr)} ${
                dateStr === today ? "ring-2 ring-black" : ""
              } ${dateStr === selectedDate ? "outline outline-blue-600" : ""}`}
            >
              {Number(dateStr.slice(-2))}
              {dot && (
                <span
                  className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${dot}`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-1 text-xs text-zinc-500">
        <div className="flex gap-4">
          <span>
            <span className="mr-1 inline-block h-3 w-3 rounded bg-green-100 align-middle" />{" "}
            Gym logged
          </span>
          <span>
            <span className="mr-1 inline-block h-3 w-3 rounded bg-yellow-100 align-middle" />{" "}
            Rest / unlogged
          </span>
          <span>
            <span className="mr-1 inline-block h-3 w-3 rounded bg-red-100 align-middle" />{" "}
            Upcoming
          </span>
        </div>
        <div className="flex gap-4">
          <span>
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-green-600 align-middle" />{" "}
            Fasting completed
          </span>
          <span>
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-600 align-middle" />{" "}
            Fasting broken
          </span>
        </div>
      </div>

      {selectedDate && (
        <div className="mt-6 border-t pt-4">
          <h2 className="mb-2 text-sm font-semibold text-zinc-500">
            {selectedDate}
          </h2>

          {selectedFasting && (
            <p className="mb-3 text-sm">
              <span className="font-medium">Fasting: </span>
              {selectedFasting.status === "completed" && (
                <span className="text-green-700">Completed</span>
              )}
              {selectedFasting.status === "broken" && (
                <span className="text-amber-700">Broken</span>
              )}
              {selectedFasting.status === "pending" && (
                <span className="text-zinc-500">Pending</span>
              )}
            </p>
          )}

          {selectedSessions.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {selectedDate > today
                ? "This day hasn't happened yet."
                : "No gym sessions logged."}
            </p>
          ) : (
            <div className="space-y-3">
              {selectedSessions.map((session) => (
                <div key={session.id} className="rounded border p-4">
                  <div className="mb-2 font-medium">
                    {session.workoutTypeName}
                  </div>
                  <div className="space-y-1 text-sm text-zinc-600">
                    {session.exercises.map((ex, i) => (
                      <div key={i}>
                        <span className="font-medium">{ex.name}:</span>{" "}
                        {ex.sets.map((s) => formatSet(s)).join(", ")}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Calendar;
