import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <p>
        Demo for sanity-plugin-posthog-ab-testing —{" "}
        <Link href="/home">visit the A/B-tested page</Link>
      </p>
    </main>
  );
}
