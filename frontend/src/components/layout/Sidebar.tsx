import { FileText, LayoutDashboard, BookOpen, MessageCircle, Plus } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export type SidebarView = "audit" | "document" | "terms" | "chat" | "intake";

export interface SidebarProps {
  activeView: SidebarView;
  onNavigate: (view: SidebarView) => void;
  onNewContract: () => void;
  documentTitle?: string;
  clauseCount?: number;
  hasDocument?: boolean;
  dataTestId?: string;
}

const navItems: Array<{ id: SidebarView; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: "audit", label: "Audit report", icon: LayoutDashboard },
  { id: "document", label: "Original document", icon: FileText },
  { id: "terms", label: "Defined terms", icon: BookOpen },
  { id: "chat", label: "AI Chat", icon: MessageCircle },
];

export function Sidebar({ activeView, onNavigate, onNewContract, documentTitle, clauseCount, hasDocument, dataTestId = "sidebar" }: SidebarProps) {
  const { t } = useLanguage();
  return (
    <aside
      data-testid={dataTestId}
      className="flex h-screen w-[260px] shrink-0 flex-col border-r border-zinc-200 bg-zinc-50"
      style={{ width: 260, background: "#F9FAFB", borderRight: "1px solid #E5E7EB" }}>
      <button
        type="button"
        data-testid="brand-logo-btn"
        onClick={onNewContract}
        className="flex h-[72px] shrink-0 items-center gap-2.5 border-b border-zinc-200 bg-white px-5 text-left hover:bg-zinc-50">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0 text-zinc-900">
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="20" y2="20" />
        </svg>
        <h1 data-testid="brand-wordmark" className="text-[22px] font-semibold tracking-tight text-zinc-900">
          Loupe
        </h1>
      </button>
      {hasDocument && documentTitle && typeof clauseCount === "number" && (
        <div data-testid="sidebar-doc-indicator" className="sr-only" aria-hidden="true">
          {clauseCount} clauses indexed
        </div>
      )}

      <nav data-testid="sidebar-nav" className="flex-1 px-3.5 py-5">
        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid={`nav-${item.id}`}
                  onClick={() => onNavigate(item.id)}
                  className={
                    isActive
                      ? "flex w-full items-center gap-2.5 rounded bg-zinc-900 px-3.5 py-2.5 text-[15px] font-medium text-white"
                      : "flex w-full items-center gap-2.5 rounded px-3.5 py-2.5 text-[15px] font-medium text-zinc-700 hover:bg-zinc-100"
                  }>
                  <Icon size={18} className={isActive ? "text-white" : "text-zinc-500"} aria-hidden />
                  {t(item.label)}
                </button>
              </li>
            );
          })}
        </ul>
        {hasDocument === false && (
          <div data-testid="sidebar-no-document" className="mt-4 px-3 py-2">
            <p className="text-xs text-zinc-500">{t("No contract loaded")}</p>
          </div>
        )}
      </nav>

      <div className="flex items-center justify-center border-t border-zinc-200 px-3.5 py-4">
        <button
          type="button"
          data-testid="new-contract-btn"
          onClick={onNewContract}
          className="inline-flex w-full items-center justify-center gap-2 rounded bg-zinc-900 px-4 py-3 text-center text-[15px] font-medium leading-none text-white hover:bg-zinc-800">
          <Plus size={16} aria-hidden className="shrink-0" strokeWidth={2.5} />
          <span>{t("New contract")}</span>
        </button>
      </div>
    </aside>
  );
}
