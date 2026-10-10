import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-lg p-6">
      {/* <h1 className="mb-6 text-xl font-semibold">Gym &amp; food tracker</h1> */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Gym &amp; food tracker</h1>
        <Link href="/settings" className="text-xl" title="Settings">
          ⚙️
        </Link>
      </div>

      <Link
        href="/log-session"
        className="block rounded border bg-black px-4 py-3 text-center font-medium text-white"
      >
        Log a session
      </Link>
      <Link
        href="/fasting"
        className="block rounded border bg-black px-4 py-3 text-center font-medium text-white"
      >
        Fasting
      </Link>
      <Link
        href="/meals"
        className="block rounded border px-4 py-3 text-center font-medium"
      >
        Log a meal (optional)
      </Link>
      <Link
        href="/notes"
        className="block rounded border px-4 py-3 text-center font-medium"
      >
        Notes (optional)
      </Link>
    </div>
  );
}
