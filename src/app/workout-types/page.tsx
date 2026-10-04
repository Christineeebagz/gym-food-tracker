"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getWorkoutTypes, createWorkoutType } from "@/lib/db";
import type { WorkoutType } from "@/types/schema";

function WorkoutTypesList() {
  const router = useRouter();
  const [types, setTypes] = useState<WorkoutType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  useEffect(() => {
    let ignore = false;
    getWorkoutTypes().then((data) => {
      if (!ignore) {
        setTypes(data);
        setLoading(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  const handleAddType = async () => {
    if (!newTypeName.trim()) return;
    const id = await createWorkoutType({
      name: newTypeName.trim(),
      order: types.length,
      exercises: [],
    });
    router.push(`/workout-types/${id}`);
  };

  const cancelCreate = () => {
    setCreating(false);
    setNewTypeName("");
  };

  const filteredTypes = types.filter((t) =>
    t.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  if (loading) return <p className="p-6 text-sm text-zinc-500">Loading...</p>;

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Workout types</h1>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search workout types"
        className="mb-3 w-full rounded border px-3 py-2"
      />

      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="mb-6 rounded bg-black px-4 py-2 text-sm text-white"
        >
          + Create workout type
        </button>
      ) : (
        <div className="mb-6 flex gap-2">
          <input
            autoFocus
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            placeholder="Workout type name"
            className="flex-1 rounded border px-3 py-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddType();
              if (e.key === "Escape") cancelCreate();
            }}
          />
          <button
            onClick={handleAddType}
            className="rounded bg-black px-4 py-2 text-sm text-white"
          >
            Create
          </button>
          <button
            onClick={cancelCreate}
            className="rounded border px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="space-y-2">
        {filteredTypes.map((type) => (
          <Link
            key={type.id}
            href={`/workout-types/${type.id}`}
            className="block rounded border px-4 py-3 hover:bg-zinc-50"
          >
            <div className="font-medium">{type.name}</div>
            <div className="text-sm text-zinc-500">
              {type.exercises.length} exercise
              {type.exercises.length === 1 ? "" : "s"}
            </div>
          </Link>
        ))}
        {filteredTypes.length === 0 && types.length > 0 && (
          <p className="text-sm text-zinc-500">
            No workout types match &quot;{search}&quot;.
          </p>
        )}
        {types.length === 0 && (
          <p className="text-sm text-zinc-500">
            No workout types yet, create one above.
          </p>
        )}
      </div>
    </div>
  );
}

export default WorkoutTypesList;
