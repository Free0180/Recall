import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AddVocabularyButton } from "./add-vocabulary-button";

afterEach(() => { cleanup(); vi.useRealTimers(); });
const finger = { pointerType: "touch", isPrimary: true, pointerId: 1, clientX: 20, clientY: 20 };
it("adds on touch release even when the browser omits click, without adding twice", () => {
  const add = vi.fn(); render(<AddVocabularyButton onAdd={add} />);
  const button = screen.getByRole("button", { name: "增加" });
  fireEvent.pointerDown(button, finger); fireEvent.pointerUp(button, finger);
  expect(add).toHaveBeenCalledTimes(1);
  fireEvent.click(button, { detail: 1 });
  expect(add).toHaveBeenCalledTimes(1);
  fireEvent.click(button, { detail: 0 }); // Keyboard remains accessible.
  expect(add).toHaveBeenCalledTimes(2);
});
it("does not add from a drag, cancelled touch, long press or secondary finger", () => {
  vi.useFakeTimers();
  const add = vi.fn(); render(<AddVocabularyButton onAdd={add} />);
  const button = screen.getByRole("button", { name: "增加" });
  fireEvent.pointerDown(button, finger); fireEvent.pointerMove(button, { ...finger, clientY: 60 }); fireEvent.pointerUp(button, finger);
  fireEvent.pointerDown(button, finger); fireEvent.pointerCancel(button, finger); fireEvent.pointerUp(button, finger);
  fireEvent.pointerDown(button, finger); vi.advanceTimersByTime(900); fireEvent.pointerUp(button, finger);
  fireEvent.pointerDown(button, { ...finger, isPrimary: false }); fireEvent.pointerUp(button, finger);
  expect(add).not.toHaveBeenCalled();
  fireEvent.click(button, { detail: 1 });
  expect(add).toHaveBeenCalledTimes(1);
});
