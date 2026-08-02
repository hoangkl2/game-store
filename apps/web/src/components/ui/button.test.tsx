import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("keeps its label mounted and disables interaction while loading", () => {
    render(<Button loading>Save game</Button>);
    const button = screen.getByRole("button", { name: "Save game" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.querySelector(".opacity-0")?.textContent).toBe("Save game");
  });

  it("exposes disabled semantics", () => {
    render(<Button disabled>Unavailable</Button>);
    expect((screen.getByRole("button", { name: "Unavailable" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
