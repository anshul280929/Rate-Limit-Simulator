export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-geist-sans)",
        background: "#0a0a0f",
        color: "#e0e0e6",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          RateGate
        </h1>
        <p style={{ color: "#8888a0", fontSize: "1.1rem" }}>
          Distributed Rate Limiter Playground
        </p>
        <p
          style={{
            color: "#555566",
            fontSize: "0.85rem",
            marginTop: "2rem",
          }}
        >
          Dashboard coming in Phase 4
        </p>
      </div>
    </main>
  );
}
