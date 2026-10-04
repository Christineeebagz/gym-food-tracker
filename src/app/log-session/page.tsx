"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getWorkoutTypes } from "@/lib/db";
import type { WorkoutType } from "@/types/schema";

function LogSessionPicker() {
  const router = useRouter();
  const [types, setTypes] = useState<WorkoutType[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <p className="p-6 text-sm text-zinc-500">Loading...</p>;

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Log a session</h1>
      <p className="mb-2 text-sm text-zinc-500">Choose a workout type:</p>

      <div className="space-y-2">
        {types.map((type) => (
          <button
            key={type.id}
            onClick={() => router.push(`/log-session/${type.id}`)}
            className="block w-full rounded border px-4 py-3 text-left hover:bg-zinc-50"
          >
            <div className="font-medium">{type.name}</div>
            <div className="text-sm text-zinc-500">
              {type.exercises.length} exercises
            </div>
          </button>
        ))}
        {types.length === 0 && (
          <p className="text-sm text-zinc-500">
            No workout types yet,{" "}
            <Link href="/workout-types" className="text-blue-600 underline">
              create one first
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}

export default LogSessionPicker;
