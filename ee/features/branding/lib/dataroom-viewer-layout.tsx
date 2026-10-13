import React from 'react';

// The helper function expected by the navbar component
export const asDataroomViewerHeaderStyle = (style: any) => style || '';

// Main layout component pass-through fallback
export const DataroomViewerLayout = ({ children }: { children: React.ReactNode }) => children;

export default DataroomViewerLayout;
