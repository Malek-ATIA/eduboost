import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold">EduBoost</h1>
      <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
        Professional platform for tutoring. Find trusted teachers, book sessions, learn online.
      </p>
      <div className="mt-8 flex gap-3">
        <Link className="rounded bg-black px-5 py-2 text-white dark:bg-white dark:text-black" href="/signup">
          Sign up
        </Link>
        <Link className="rounded border px-5 py-2" href="/login">
          Log in
        </Link>
      </div>
    </main>
  );
}
