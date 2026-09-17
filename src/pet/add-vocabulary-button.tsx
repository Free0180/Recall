import { useRef } from "react";

/** Some touch browsers omit the synthetic click. Keep keyboard/mouse activation too. */
export function AddVocabularyButton({ onAdd }: { onAdd: () => void }) {
  const touch = useRef<{ id: number; x: number; y: number; at: number } | null>(null);
  const lastTouch = useRef(-Infinity);
  return <button type="button" style={{ touchAction: "manipulation" }}
    onPointerDown={event => {
      touch.current = event.pointerType === "touch" && event.isPrimary
        ? { id: event.pointerId, x: event.clientX, y: event.clientY, at: Date.now() } : null;
    }}
    onPointerMove={event => {
      const start = touch.current;
      if (start && (Math.abs(event.clientX - start.x) > 10 || Math.abs(event.clientY - start.y) > 10)) touch.current = null;
    }}
    onPointerCancel={() => { touch.current = null; }}
    onPointerLeave={() => { touch.current = null; }}
    onPointerUp={event => {
      const start = touch.current;
      touch.current = null;
      if (!start || start.id !== event.pointerId || Date.now() - start.at > 800) return;
      if (Math.abs(event.clientX - start.x) > 10 || Math.abs(event.clientY - start.y) > 10) return;
      lastTouch.current = Date.now();
      event.preventDefault();
      onAdd();
    }}
    onClick={event => {
      if (event.detail > 0 && Date.now() - lastTouch.current < 1000) return;
      onAdd();
    }}>增加</button>;
}
