import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MessageList } from "./MessageList";

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

describe("MessageList live tool progress", () => {
  it("collapses live inline tool progress while an agent answer is streaming", () => {
    const toolProgress = Array.from(
      { length: 30 },
      (_, index) => `python line ${index + 1} with a long generated command`,
    ).join("\n");

    render(
      <MessageList
        messages={[
          { id: "user-1", role: "user", content: "make an image" },
          { id: "agent-1", role: "agent", content: "Working on it..." },
        ]}
        isLoading={true}
        toolProgress={toolProgress}
        onApprove={vi.fn()}
        onDeny={vi.fn()}
      />,
    );

    const progress = screen
      .getByText(/python line 1/)
      .closest(".chat-tool-progress-live");
    expect(progress).toHaveClass("chat-tool-progress-inline");
    expect(progress).not.toHaveClass("chat-tool-progress-live--expanded");
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));

    expect(progress).toHaveClass("chat-tool-progress-live--expanded");
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
  });
});
