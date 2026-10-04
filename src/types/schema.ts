// Types only. No imports, no functions, nothing that touches Firebase.
// Anything that talks to the database lives in src/lib/db.ts.

// Shared shape for every date-only field in this app.
// Always "YYYY-MM-DD", never a full timestamp, see the README note on why.
export type DateString = string;

export interface ExerciseTemplate {
  id: string;
  name: string;
  order: number;
  defaultSets: number;
  defaultReps: number;
  defaultWeight?: number; // absent = bodyweight exercise by default
}

export interface WorkoutType {
  id: string;
  name: string;
  order: number;
  exercises: ExerciseTemplate[];
  createdAt: number; // epoch ms
  updatedAt: number;
}

export interface CompletedSet {
  setNumber: number;
  skipped: false;
  reps: number;
  weight?: number; // absent = no weight used for this set
}

export interface SkippedSet {
  setNumber: number;
  skipped: true;
}

export type SetEntry = CompletedSet | SkippedSet;

export interface PerformedExercise {
  name: string;
  order: number;
  sets: SetEntry[];
}

export interface GymSession {
  id: string;
  date: DateString;
  workoutTypeId: string;
  workoutTypeName: string;
  exercises: PerformedExercise[];
  createdAt: number;
  updatedAt: number;
}

export type FastingStatus = "pending" | "completed" | "broken";

export interface FastingBreak {
  at: number;
  note?: string;
}

export interface FastingLog {
  date: DateString; // also doubles as the document ID
  firstMealAt: number;
  windowHours: number;
  windowEndsAt: number;
  status: FastingStatus;
  breaks: FastingBreak[];
  createdAt: number;
  updatedAt: number;
}

export interface MealLog {
  id: string;
  date: DateString;
  time: number;
  calories?: number;
  protein?: number;
  createdAt: number;
}

export interface AppSettings {
  fastingWindowHours: number;
  fastingSafeDrinks: string[];
  gracePeriodMinutes: number;
  weightUnit: "kg" | "lb";
}

export interface DayNote {
  date: DateString; // also doubles as the document ID
  note: string;
  updatedAt: number;
}
