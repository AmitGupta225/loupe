import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatView } from "../components/chat/ChatView";
import { LanguageProvider } from "../context/LanguageContext";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, sendChat: vi.fn() };
});

import { sendChat } from "../services/api";

const renderChat = (props: { hasDocument: boolean; documentId?: string; rawText?: string }) =>
  render(<LanguageProvider><ChatView {...props} /></LanguageProvider>);

describe("ChatView", () => {
  it("shows the empty document state", () => {
    renderChat({ hasDocument: false });
    expect(screen.getByText("No contract loaded")).toBeInTheDocument();
  });

  it("recovers from invalid saved messages", () => {
    localStorage.setItem("loupe-chat-default", "{bad");
    renderChat({ hasDocument: true });
    expect(screen.getByText("Start a conversation")).toBeInTheDocument();
  });

  it("sends messages, restores saved messages, and clears them", async () => {
    localStorage.setItem("loupe-chat-doc", JSON.stringify([{ role: "assistant", content: "Saved" }]));
    vi.mocked(sendChat).mockResolvedValue({ answer: "Reply", citations: [] });
    renderChat({ hasDocument: true, documentId: "doc", rawText: "contract" });
    expect(screen.getByText("Saved")).toBeInTheDocument();
    const input = screen.getByTestId("chat-input");
    await fireEvent.change(input, { target: { value: "Question" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByText("Reply")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("chat-clear"));
    expect(screen.queryByText("Reply")).not.toBeInTheDocument();
  });

  it("shows request errors and prevents empty sends", async () => {
    vi.mocked(sendChat).mockRejectedValue(new Error("network down"));
    renderChat({ hasDocument: true });
    const send = screen.getByTestId("chat-send");
    expect(send).toBeDisabled();
    await fireEvent.change(screen.getByTestId("chat-input"), { target: { value: "Question" } });
    fireEvent.click(send);
    await waitFor(() => expect(screen.getByTestId("chat-error")).toHaveTextContent("network down"));
  });
});
