/** Ekran "jo aktiv" për profile jo të publikuar ose të pezulluar (pa zbuluar arsyen). */
export function Unavailable({ name }: { name: string }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0f1720",
        color: "#f5f0e6",
        padding: "0 24px",
        textAlign: "center",
      }}
    >
      <div>
        <h1 style={{ fontSize: "2rem", marginBottom: 12 }}>{name}</h1>
        <p style={{ opacity: 0.7 }}>Përkohësisht jo aktiv. Ju lutemi provoni më vonë.</p>
      </div>
    </main>
  );
}
