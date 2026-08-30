import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders its label", () => {
    render(<Button>Analizar</Button>);
    expect(
      screen.getByRole("button", { name: "Analizar" }),
    ).toBeInTheDocument();
  });

  // Guards the one deliberate edit to the generated component: the prototype's
  // `buttonRadius = "full"` (.streamlit/config.toml, MIGRATION.md §4.4).
  it("is pill-shaped", () => {
    render(<Button>Analizar</Button>);
    expect(screen.getByRole("button")).toHaveClass("rounded-full");
  });
});
