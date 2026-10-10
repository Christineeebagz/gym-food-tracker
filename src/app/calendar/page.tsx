"use client";

import { useEffect, useState } from "react";
import {
  getAllGymSessions,
  getAllFastingLogs,
  getGymSessionsInRange,
  getFastingLogsInRange,
  getSettings,
} from "@/lib/db";
import type {
  GymSession,
  SetEntry,
  FastingLog,
  CompletedSet,
} from "@/types/schema";
import { dateToString, todayString } from "@/lib/date";

function formatSet(set: SetEntry, weightUnit: string): string {
  if (set.skipped) return "skipped";
  return set.weight !== undefined
    ? `${set.reps} reps @ ${set.weight}${weightUnit}`
    : `${set.reps} reps`;
}

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
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

// ---- CSV helpers: no library, just string building + a Blob download ----

function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\n");
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function gymSessionsToCsvRows(sessions: GymSession[]): (string | number)[][] {
  const rows: (string | number)[][] = [
    [
      "date",
      "workoutType",
      "exercise",
      "setNumber",
      "skipped",
      "reps",
      "weight",
    ],
  ];
  for (const session of sessions) {
    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        const completed: CompletedSet | null = set.skipped ? null : set;
        rows.push([
          session.date,
          session.workoutTypeName,
          ex.name,
          set.setNumber,
          set.skipped ? "yes" : "no",
          completed ? completed.reps : "",
          completed ? (completed.weight ?? "") : "",
        ]);
      }
    }
  }
  return rows;
}

function fastingLogsToCsvRows(logs: FastingLog[]): (string | number)[][] {
  const rows: (string | number)[][] = [
    [
      "date",
      "firstMeal",
      "windowEnds",
      "windowHours",
      "status",
      "breaksCount",
      "breakNotes",
    ],
  ];
  for (const log of logs) {
    const breakNotes = log.breaks
      .map((b) => b.note)
      .filter(Boolean)
      .join("; ");
    rows.push([
      log.date,
      formatClock(log.firstMealAt),
      formatClock(log.windowEndsAt),
      log.windowHours,
      log.status,
      log.breaks.length,
      breakNotes,
    ]);
  }
  return rows;
}

function Calendar() {
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [fastingLogs, setFastingLogs] = useState<FastingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const today = todayString();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [showExport, setShowExport] = useState(false);
  const [exportStart, setExportStart] = useState(today);
  const [exportEnd, setExportEnd] = useState(today);
  const [exportGym, setExportGym] = useState(true);
  const [exportFasting, setExportFasting] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [printPreview, setPrintPreview] = useState<{
    start: string;
    end: string;
    sessions: GymSession[];
    fastingLogs: FastingLog[];
  } | null>(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([getAllGymSessions(), getAllFastingLogs(), getSettings()]).then(
      ([gymData, fastingData, settings]) => {
        if (!ignore) {
          setSessions(gymData);
          setFastingLogs(fastingData);
          setWeightUnit(settings.weightUnit);
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

  const setPresetRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setExportStart(dateToString(start));
    setExportEnd(dateToString(end));
  };

  const setThisMonthRange = () => {
    setExportStart(dateToString(new Date(viewYear, viewMonth, 1)));
    setExportEnd(dateToString(new Date(viewYear, viewMonth + 1, 0)));
  };

  const handleDownloadCsv = async () => {
    setExporting(true);
    if (exportGym) {
      const gymData = await getGymSessionsInRange(exportStart, exportEnd);
      downloadFile(
        `gym-sessions_${exportStart}_to_${exportEnd}.csv`,
        "\uFEFF" + toCsv(gymSessionsToCsvRows(gymData)),
        "text/csv;charset=utf-8;",
      );
    }
    if (exportFasting) {
      const fastingData = await getFastingLogsInRange(exportStart, exportEnd);
      downloadFile(
        `fasting_${exportStart}_to_${exportEnd}.csv`,
        "\uFEFF" + toCsv(fastingLogsToCsvRows(fastingData)),
        "text/csv;charset=utf-8;",
      );
    }
    setExporting(false);
  };

  const handlePreviewForPrint = async () => {
    setExporting(true);
    const [gymData, fastingData] = await Promise.all([
      exportGym
        ? getGymSessionsInRange(exportStart, exportEnd)
        : Promise.resolve([]),
      exportFasting
        ? getFastingLogsInRange(exportStart, exportEnd)
        : Promise.resolve([]),
    ]);
    setPrintPreview({
      start: exportStart,
      end: exportEnd,
      sessions: gymData,
      fastingLogs: fastingData,
    });
    setExporting(false);
  };

  if (printPreview) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="mb-6 flex gap-2 print:hidden">
          <button
            onClick={() => setPrintPreview(null)}
            className="text-sm text-blue-600"
          >
            ← Back to calendar
          </button>
          <button
            onClick={() => window.print()}
            className="ml-auto rounded bg-black px-4 py-2 text-sm text-white"
          >
            Print / Save as PDF
          </button>
        </div>

        <h1 className="mb-1 text-xl font-semibold">
          {printPreview.start} to {printPreview.end}
        </h1>
        <p className="mb-6 text-xs text-zinc-500 print:hidden">
          In the print dialog, choose &quot;Save as PDF&quot; as the
          destination.
        </p>

        {exportGym && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">Gym sessions</h2>
            {printPreview.sessions.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No sessions in this range.
              </p>
            ) : (
              printPreview.sessions.map((session) => (
                <div key={session.id} className="mb-3">
                  <p className="font-medium">
                    {session.date} — {session.workoutTypeName}
                  </p>
                  <div className="pl-4 text-sm text-zinc-700">
                    {session.exercises.map((ex, i) => (
                      <p key={i}>
                        {ex.name}:{" "}
                        {ex.sets
                          .map((s) => formatSet(s, weightUnit))
                          .join(", ")}
                      </p>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {exportFasting && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Fasting</h2>
            {printPreview.fastingLogs.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No fasting logs in this range.
              </p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-1 pr-3">Date</th>
                    <th className="py-1 pr-3">First meal</th>
                    <th className="py-1 pr-3">Window ends</th>
                    <th className="py-1 pr-3">Status</th>
                    <th className="py-1">Breaks</th>
                  </tr>
                </thead>
                <tbody>
                  {printPreview.fastingLogs.map((log) => (
                    <tr key={log.date} className="border-b">
                      <td className="py-1 pr-3">{log.date}</td>
                      <td className="py-1 pr-3">
                        {formatClock(log.firstMealAt)}
                      </td>
                      <td className="py-1 pr-3">
                        {formatClock(log.windowEndsAt)}
                      </td>
                      <td className="py-1 pr-3">{log.status}</td>
                      <td className="py-1">{log.breaks.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
    );
  }

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

      <div className="mt-6 border-t pt-4">
        {!showExport ? (
          <button
            onClick={() => setShowExport(true)}
            className="text-sm text-blue-600"
          >
            Export data
          </button>
        ) : (
          <div className="space-y-3 rounded border p-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                onClick={() => setPresetRange(7)}
                className="rounded border px-2 py-1"
              >
                Last 7 days
              </button>
              <button
                onClick={() => setPresetRange(30)}
                className="rounded border px-2 py-1"
              >
                Last 30 days
              </button>
              <button
                onClick={setThisMonthRange}
                className="rounded border px-2 py-1"
              >
                This month
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <input
                type="date"
                value={exportStart}
                onChange={(e) => setExportStart(e.target.value)}
                className="rounded border px-2 py-1"
              />
              <span>to</span>
              <input
                type="date"
                value={exportEnd}
                onChange={(e) => setExportEnd(e.target.value)}
                className="rounded border px-2 py-1"
              />
            </div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={exportGym}
                  onChange={(e) => setExportGym(e.target.checked)}
                />
                Gym
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={exportFasting}
                  onChange={(e) => setExportFasting(e.target.checked)}
                />
                Fasting
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDownloadCsv}
                disabled={exporting || (!exportGym && !exportFasting)}
                className="rounded bg-black px-3 py-1 text-sm text-white disabled:bg-zinc-300"
              >
                {exporting ? "Working..." : "Download CSV"}
              </button>
              <button
                onClick={handlePreviewForPrint}
                disabled={exporting || (!exportGym && !exportFasting)}
                className="rounded border px-3 py-1 text-sm disabled:text-zinc-300"
              >
                Preview for PDF
              </button>
              <button
                onClick={() => setShowExport(false)}
                className="text-sm text-zinc-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
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
                        {ex.sets
                          .map((s) => formatSet(s, weightUnit))
                          .join(", ")}
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
