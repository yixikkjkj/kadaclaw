import { create } from "zustand";

interface LayoutState {
  collapseSidebar: boolean;
  setCollapseSidebar: (collapseSidebar: boolean) => void;
  toggleCollapseSidebar: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  collapseSidebar: false,
  setCollapseSidebar: (collapseSidebar) =>
    set({
      collapseSidebar,
    }),
  toggleCollapseSidebar: () =>
    set(({ collapseSidebar }) => ({
      collapseSidebar: !collapseSidebar,
    })),
}));
