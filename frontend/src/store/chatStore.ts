import { create } from "zustand";

type ActiveTab = "chat" | "clauses" | "risks";

interface ChatStore {
  inputValue: string;
  setInputValue: (value: string) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  inputValue: "",
  setInputValue: (value) => set({ inputValue: value }),
  activeTab: "chat",
  setActiveTab: (tab) => set({ activeTab: tab }),
  isSubmitting: false,
  setIsSubmitting: (value) => set({ isSubmitting: value }),
}));
