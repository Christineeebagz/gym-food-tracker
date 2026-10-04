import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  orderBy,
  where,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  WorkoutType,
  GymSession,
  FastingLog,
  AppSettings,
  MealLog,
  DayNote,
} from "@/types/schema";

// ---- workoutTypes ----

const workoutTypesCol = collection(db, "workoutTypes");

export async function createWorkoutType(
  data: Omit<WorkoutType, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(workoutTypesCol, {
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function getWorkoutTypes(): Promise<WorkoutType[]> {
  const q = query(workoutTypesCol, orderBy("order"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WorkoutType);
}

// ---- gymSessions ----

const gymSessionsCol = collection(db, "gymSessions");

export async function createGymSession(
  data: Omit<GymSession, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(gymSessionsCol, {
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function getGymSessionsForDate(
  date: string,
): Promise<GymSession[]> {
  const q = query(gymSessionsCol, where("date", "==", date));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GymSession);
}

// ---- fastingLogs (the date itself is the doc ID, see schema notes) ----

export async function upsertFastingLog(
  date: string,
  data: Omit<FastingLog, "date">,
): Promise<void> {
  await setDoc(doc(db, "fastingLogs", date), { date, ...data });
}

export async function getFastingLog(date: string): Promise<FastingLog | null> {
  const snap = await getDoc(doc(db, "fastingLogs", date));
  return snap.exists() ? (snap.data() as FastingLog) : null;
}

export async function updateWorkoutType(
  id: string,
  data: Partial<Omit<WorkoutType, "id" | "createdAt" | "updatedAt">>,
): Promise<void> {
  await updateDoc(doc(db, "workoutTypes", id), {
    ...data,
    updatedAt: Date.now(),
  });
}

export async function deleteWorkoutType(id: string): Promise<void> {
  await deleteDoc(doc(db, "workoutTypes", id));
}

export async function getWorkoutType(id: string): Promise<WorkoutType | null> {
  const snap = await getDoc(doc(db, "workoutTypes", id));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as WorkoutType)
    : null;
}

export async function getAllGymSessions(): Promise<GymSession[]> {
  const q = query(gymSessionsCol, orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GymSession);
}

// ---- settings (a single fixed document, since there's exactly one user) ----
// No dedicated Settings screen exists yet (that's Phase 6), so this returns
// sensible defaults until a settings document actually exists.

const DEFAULT_SETTINGS: AppSettings = {
  fastingWindowHours: 16,
  fastingSafeDrinks: ["Black coffee", "Plain tea", "Water"],
  gracePeriodMinutes: 15,
  weightUnit: "kg",
};

export async function getSettings(): Promise<AppSettings> {
  const snap = await getDoc(doc(db, "settings", "default"));
  return snap.exists()
    ? { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<AppSettings>) }
    : DEFAULT_SETTINGS;
}

export async function deleteFastingLog(date: string): Promise<void> {
  await deleteDoc(doc(db, "fastingLogs", date));
}

export async function getAllFastingLogs(): Promise<FastingLog[]> {
  const q = query(collection(db, "fastingLogs"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as FastingLog);
}

// ---- mealLogs (optional, many per day, so auto-generated IDs) ----

const mealLogsCol = collection(db, "mealLogs");

export async function createMealLog(
  data: Omit<MealLog, "id" | "createdAt">,
): Promise<MealLog> {
  const createdAt = Date.now();
  const ref = await addDoc(mealLogsCol, { ...data, createdAt });
  return { id: ref.id, ...data, createdAt };
}

// Sorted in code rather than with orderBy("time"): combining a where() on
// one field with an orderBy() on another needs a composite index, and for a
// day's worth of meals a client-side sort is plenty.
export async function getMealLogsForDate(date: string): Promise<MealLog[]> {
  const q = query(mealLogsCol, where("date", "==", date));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as MealLog)
    .sort((a, b) => a.time - b.time);
}

export async function deleteMealLog(id: string): Promise<void> {
  await deleteDoc(doc(db, "mealLogs", id));
}

export async function upsertDayNote(date: string, note: string): Promise<void> {
  await setDoc(doc(db, "dayNotes", date), {
    date,
    note,
    updatedAt: Date.now(),
  });
}

export async function getDayNote(date: string): Promise<DayNote | null> {
  const snap = await getDoc(doc(db, "dayNotes", date));
  return snap.exists() ? (snap.data() as DayNote) : null;
}

export async function deleteDayNote(date: string): Promise<void> {
  await deleteDoc(doc(db, "dayNotes", date));
}

export async function getGymSessionsInRange(
  startDate: string,
  endDate: string,
): Promise<GymSession[]> {
  const q = query(
    gymSessionsCol,
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GymSession);
}

export async function getFastingLogsInRange(
  startDate: string,
  endDate: string,
): Promise<FastingLog[]> {
  const q = query(
    collection(db, "fastingLogs"),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as FastingLog);
}
