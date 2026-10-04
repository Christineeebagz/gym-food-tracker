"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { todayString } from "@/lib/date";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getWorkoutType, createGymSession } from "@/lib/db";
import type {
  WorkoutType,
  PerformedExercise,
  SetEntry,
  CompletedSet,
} from "@/types/schema";

// Local-only field, used purely to give dnd-kit and React a stable identity
// for each exercise row. Stripped out before anything is saved to Firestore,
// it's not part of the schema and never should be.
type DraggableExercise = PerformedExercise & { dragId: string };

function templateToPerformedExercises(type: WorkoutType): DraggableExercise[] {
  return [...type.exercises]
    .sort((a, b) => a.order - b.order)
    .map((ex, i) => {
      const sets: SetEntry[] = Array.from(
        { length: ex.defaultSets },
        (_, setIdx) => {
          const set: CompletedSet = {
            setNumber: setIdx + 1,
            skipped: false,
            reps: ex.defaultReps,
          };
          if (ex.defaultWeight !== undefined) set.weight = ex.defaultWeight;
          return set;
        },
      );
      return { dragId: crypto.randomUUID(), name: ex.name, order: i, sets };
    });
}

function SortableExerciseCard({
  exercise,
  exIdx,
  onNameChange,
  onRemove,
  onUpdateSet,
  onToggleSkip,
  onAddSet,
  onRemoveSet,
}: {
  exercise: DraggableExercise;
  exIdx: number;
  onNameChange: (exIdx: number, name: string) => void;
  onRemove: (exIdx: number) => void;
  onUpdateSet: (
    exIdx: number,
    setIdx: number,
    patch: Partial<CompletedSet>,
  ) => void;
  onToggleSkip: (exIdx: number, setIdx: number) => void;
  onAddSet: (exIdx: number) => void;
  onRemoveSet: (exIdx: number, setIdx: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: exercise.dragId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded border bg-black p-4">
      <div className="mb-2 flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab select-none px-1 text-lg text-zinc-400 active:cursor-grabbing"
          title="Press and hold to drag, or use arrow keys"
          aria-label={`Reorder ${exercise.name || "exercise"}`}
        >
          ⠿
        </button>
        <input
          value={exercise.name}
          onChange={(e) => onNameChange(exIdx, e.target.value)}
          placeholder="Exercise name"
          className="flex-1 rounded border px-2 py-1 font-medium"
        />
        <button
          onClick={() => onRemove(exIdx)}
          className="text-sm text-red-600"
        >
          Remove
        </button>
      </div>

      <div className="space-y-1">
        {exercise.sets.map((set, setIdx) => (
          <div key={setIdx} className="flex items-center gap-2 text-sm">
            <span className="w-14 text-zinc-500">Set {set.setNumber}</span>
            <label className="flex items-center gap-1 text-xs text-zinc-500">
              <input
                type="checkbox"
                checked={set.skipped}
                onChange={() => onToggleSkip(exIdx, setIdx)}
              />
              Skipped
            </label>
            {!set.skipped && (
              <>
                <input
                  type="number"
                  value={set.reps}
                  onChange={(e) =>
                    onUpdateSet(exIdx, setIdx, { reps: Number(e.target.value) })
                  }
                  className="w-16 rounded border px-2 py-1"
                  title="Reps"
                />
                <span>reps @</span>
                <input
                  type="number"
                  value={set.weight ?? ""}
                  onChange={(e) =>
                    onUpdateSet(exIdx, setIdx, {
                      weight:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                  placeholder="bodyweight"
                  className="w-24 rounded border px-2 py-1"
                  title="Weight, leave blank for bodyweight"
                />
              </>
            )}
            <button
              onClick={() => onRemoveSet(exIdx, setIdx)}
              className="ml-auto text-red-600"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => onAddSet(exIdx)}
        className="mt-2 text-sm text-blue-600"
      >
        + Add set
      </button>
    </div>
  );
}

function LogSession() {
  const params = useParams<{ typeId: string }>();
  const router = useRouter();
  const [date, setDate] = useState(todayString());
  const [type, setType] = useState<WorkoutType | null>(null);
  const [exercises, setExercises] = useState<DraggableExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    let ignore = false;
    getWorkoutType(params.typeId).then((data) => {
      if (!ignore && data) {
        setType(data);
        setExercises(templateToPerformedExercises(data));
        setLoading(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, [params.typeId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setExercises((prev) => {
      const oldIndex = prev.findIndex((ex) => ex.dragId === active.id);
      const newIndex = prev.findIndex((ex) => ex.dragId === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex).map((ex, i) => ({
        ...ex,
        order: i,
      }));
    });
  };

  const updateSet = (
    exIdx: number,
    setIdx: number,
    patch: Partial<CompletedSet>,
  ) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exIdx
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, j) =>
                j === setIdx && !s.skipped ? { ...s, ...patch } : s,
              ),
            },
      ),
    );
  };

  const toggleSkip = (exIdx: number, setIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exIdx
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, j): SetEntry => {
                if (j !== setIdx) return s;
                if (s.skipped)
                  return { setNumber: s.setNumber, skipped: false, reps: 0 };
                return { setNumber: s.setNumber, skipped: true };
              }),
            },
      ),
    );
  };

  const addSet = (exIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exIdx
          ? ex
          : {
              ...ex,
              sets: [
                ...ex.sets,
                { setNumber: ex.sets.length + 1, skipped: false, reps: 0 },
              ],
            },
      ),
    );
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exIdx
          ? ex
          : {
              ...ex,
              sets: ex.sets
                .filter((_, j) => j !== setIdx)
                .map((s, j) => ({ ...s, setNumber: j + 1 })),
            },
      ),
    );
  };

  const updateExerciseName = (exIdx: number, name: string) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i === exIdx ? { ...ex, name } : ex)),
    );
  };

  const addExtraExercise = () => {
    setExercises((prev) => [
      ...prev,
      {
        dragId: crypto.randomUUID(),
        name: "",
        order: prev.length,
        sets: [{ setNumber: 1, skipped: false, reps: 0 }],
      },
    ]);
  };

  const removeExercise = (exIdx: number) => {
    setExercises((prev) =>
      prev.filter((_, i) => i !== exIdx).map((ex, i) => ({ ...ex, order: i })),
    );
  };

  const handleSaveSession = async () => {
    if (!type) return;
    setSaving(true);
    const cleaned: PerformedExercise[] = exercises.map((ex) => {
      const { name, order, sets } = ex;
      return { name, order, sets };
    });
    await createGymSession({
      date,
      workoutTypeId: type.id,
      workoutTypeName: type.name,
      exercises: cleaned,
    });
    router.push("/log-session");
  };

  if (loading) return <p className="p-6 text-sm text-zinc-500">Loading...</p>;
  if (!type)
    return <p className="p-6 text-sm text-zinc-500">Workout type not found.</p>;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link
        href="/log-session"
        className="mb-4 inline-block text-sm text-blue-600"
      >
        ← Back
      </Link>

      <h1 className="mb-1 text-xl font-semibold">{type.name}</h1>

      <label className="mb-4 block text-sm">
        Date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block rounded border px-3 py-2"
        />
      </label>

      <p className="mb-2 text-xs text-zinc-500">
        Press and hold the ⠿ handle to drag an exercise into a new order.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={exercises.map((ex) => ex.dragId)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-6">
            {exercises.map((ex, exIdx) => (
              <SortableExerciseCard
                key={ex.dragId}
                exercise={ex}
                exIdx={exIdx}
                onNameChange={updateExerciseName}
                onRemove={removeExercise}
                onUpdateSet={updateSet}
                onToggleSkip={toggleSkip}
                onAddSet={addSet}
                onRemoveSet={removeSet}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-4 flex gap-2">
        <button onClick={addExtraExercise} className="text-sm text-blue-600">
          + Add exercise
        </button>
        <button
          onClick={handleSaveSession}
          disabled={saving}
          className="ml-auto rounded bg-black px-4 py-2 text-sm text-white disabled:bg-zinc-300"
        >
          {saving ? "Saving..." : "Save session"}
        </button>
      </div>
    </div>
  );
}

export default LogSession;
