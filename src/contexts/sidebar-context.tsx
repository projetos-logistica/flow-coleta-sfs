import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface SidebarContextType {
  isPinned: boolean;
  togglePin: () => void;
  setPinned: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isPinned, setIsPinned] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("flow_sidebar_pinned") === "true";
      } catch {
        return false;
      }
    }
    return false;
  });

  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("flow_sidebar_pinned", String(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const setPinned = (v: boolean) => {
    setIsPinned(v);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("flow_sidebar_pinned", String(v));
      } catch {
        // ignore
      }
    }
  };

  return (
    <SidebarContext.Provider value={{ isPinned, togglePin, setPinned }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return ctx;
}
