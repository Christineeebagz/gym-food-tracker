"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getWorkoutType, updateWorkoutType, deleteWorkoutType } from "@/lib/db";
import type { WorkoutType, ExerciseTemplate } from "@/types/schema";

function emptyExercise(order: number): ExerciseTemplate {
  return {
    id: crypto.randomUUID(),
    name: "",
    order,
    defaultSets: 3,
    defaultReps: 10,
    defaultWeight: undefined,
  };
}

function WorkoutTypeDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [type, setType] = useState<WorkoutType | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let ignore = false;
    getWorkoutType(id).then((data) => {
      if (!ignore) {
        setType(data);
        setLoading(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, [id]);

  // Every local edit goes through here, so "dirty" can never drift out of
  // sync with reality just because a future edit handler forgot to set it.
  const applyLocalChange = (updater: (prev: WorkoutType) => WorkoutType) => {
    setType((prev) => (prev ? updater(prev) : prev));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!type) return;
    await updateWorkoutType(type.id, {
      name: type.name,
      order: type.order,
      exercises: type.exercises,
    });
    setDirty(false);
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Delete this workout type? This won't affect past logged sessions.",
      )
    )
      return;
    await deleteWorkoutType(id);
    router.push("/workout-types");
  };

  const updateExercise = (
    exerciseId: string,
    patch: Partial<ExerciseTemplate>,
  ) => {
    applyLocalChange((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) =>
        e.id === exerciseId ? { ...e, ...patch } : e,
      ),
    }));
  };

  const addExercise = () => {
    applyLocalChange((prev) => ({
      ...prev,
      exercises: [...prev.exercises, emptyExercise(prev.exercises.length)],
    }));
  };

  const removeExercise = (exerciseId: string) => {
    applyLocalChange((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((e) => e.id !== exerciseId),
    }));
  };

  if (loading) return <p className="p-6 text-sm text-zinc-500">Loading...</p>;
  if (!type)
    return <p className="p-6 text-sm text-zinc-500">Workout type not found.</p>;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link
        href="/workout-types"
        className="mb-4 inline-block text-sm text-blue-600"
      >
        ← Back to workout types
      </Link>

      <div className="mb-4 flex items-center gap-2">
        <input
          value={type.name}
          onChange={(e) =>
            applyLocalChange((prev) => ({ ...prev, name: e.target.value }))
          }
          className="flex-1 rounded border px-3 py-2 text-lg font-medium"
        />
        <button onClick={handleDelete} className="text-sm text-red-600">
          Delete type
        </button>
      </div>

      <div className="space-y-2">
        {type.exercises.map((ex) => (
          <div
            key={ex.id}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <input
              value={ex.name}
              onChange={(e) => updateExercise(ex.id, { name: e.target.value })}
              placeholder="Exercise name"
              className="min-w-40 flex-1 rounded border px-2 py-1"
            />
            <input
              type="number"
              value={ex.defaultSets}
              onChange={(e) =>
                updateExercise(ex.id, { defaultSets: Number(e.target.value) })
              }
              className="w-16 rounded border px-2 py-1"
              title="Default sets"
            />
            <span>sets ×</span>
            <input
              type="number"
              value={ex.defaultReps}
              onChange={(e) =>
                updateExercise(ex.id, { defaultReps: Number(e.target.value) })
              }
              className="w-16 rounded border px-2 py-1"
              title="Default reps"
            />
            <span>reps @</span>
            <input
              type="number"
              value={ex.defaultWeight ?? ""}
              onChange={(e) =>
                updateExercise(ex.id, {
                  defaultWeight:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder="bodyweight"
              className="w-24 rounded border px-2 py-1"
              title="Default weight, leave blank for bodyweight"
            />
            <button
              onClick={() => removeExercise(ex.id)}
              className="text-red-600"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={addExercise} className="text-sm text-blue-600">
          + Add exercise
        </button>
        <button
          onClick={handleSave}
          disabled={!dirty}
          className={`ml-auto rounded px-3 py-1 text-sm text-white ${
            dirty ? "bg-black" : "cursor-not-allowed bg-zinc-300"
          }`}
        >
          {dirty ? "Save" : "Saved"}
        </button>
      </div>
    </div>
  );
}

export default WorkoutTypeDetail;
