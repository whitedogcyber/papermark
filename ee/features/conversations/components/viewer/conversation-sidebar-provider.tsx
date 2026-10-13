import React from 'react';

// The hook expected by the document view navbar layout
export const useConversationSidebarSafe = () => ({
  isOpen: false,
  setIsOpen: () => {},
  hasActiveDiscussions: false,
});

// Pass-through context provider fallback component
export const ConversationSidebarProvider = ({ children }: { children: React.ReactNode }) => children;

export default ConversationSidebarProvider;
