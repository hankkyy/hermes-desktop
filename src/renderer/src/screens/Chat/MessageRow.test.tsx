import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MessageRow } from "./MessageRow";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({
    locale: "en",
    setLocale: vi.fn(),
    t: (key: string) =>
      ({
        "chat.approve": "Approve",
        "chat.deny": "Deny",
        "chat.codeShowMore": "Show more",
        "chat.codeShowLess": "Show less",
      })[key] ?? key,
  }),
}));

function fencedCode(lines: string[]): string {
  return ["```ts", ...lines, "```"].join("\n");
}

describe("MessageRow streaming code bounds", () => {
  it("collapses long code blocks while the agent answer is streaming", () => {
    const content = fencedCode(
      Array.from(
        { length: 32 },
        (_, index) => `line ${index + 1} const value = compute(${index});`,
      ),
    );

    render(
      <MessageRow
        msg={{ id: "agent-1", role: "agent", content }}
        isLast={true}
        isLoading={true}
        onApprove={vi.fn()}
        onDeny={vi.fn()}
      />,
    );

    const codeBlock = screen
      .getByText(/line 1 const value/)
      .closest(".chat-code-block");
    expect(codeBlock).toHaveClass("chat-code-block--collapsible");
    expect(codeBlock).toHaveClass("chat-code-block--collapsed");
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));

    expect(codeBlock).toHaveClass("chat-code-block--collapsible");
    expect(codeBlock).not.toHaveClass("chat-code-block--collapsed");
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
  });

  it("does not collapse short streaming code blocks", () => {
    render(
      <MessageRow
        msg={{
          id: "agent-1",
          role: "agent",
          content: fencedCode(["line 1", "line 2"]),
        }}
        isLast={true}
        isLoading={true}
        onApprove={vi.fn()}
        onDeny={vi.fn()}
      />,
    );

    const codeBlock = screen.getByText(/line 1/).closest(".chat-code-block");
    expect(codeBlock).not.toHaveClass("chat-code-block--collapsible");
    expect(codeBlock).not.toHaveClass("chat-code-block--collapsed");
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
});
