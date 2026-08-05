/**
 * Ambient colour wash behind the whole app.
 *
 * Pure CSS, no images: three large blurred blobs in the stage colours,
 * drifting slowly. Sits at z-index 0 under `main`, and is hidden from
 * assistive tech since it carries no meaning.
 */
export function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <div
        className="aurora-blob drift-a"
        style={{
          width: "46rem",
          height: "46rem",
          top: "-16rem",
          left: "-12rem",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--signal) 65%, transparent), transparent 70%)",
        }}
      />
      <div
        className="aurora-blob drift-b"
        style={{
          width: "38rem",
          height: "38rem",
          top: "-8rem",
          right: "-10rem",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--evidence) 55%, transparent), transparent 70%)",
        }}
      />
      <div
        className="aurora-blob drift-a"
        style={{
          width: "42rem",
          height: "42rem",
          top: "48%",
          left: "36%",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--authenticity) 42%, transparent), transparent 70%)",
          animationDelay: "-12s",
        }}
      />
    </div>
  );
}
