// The hook expected by the side navigation layout
export const useRequestListFeatureEnabled = () => false;

// Basic hook configuration fallback
export const useRequestListFeature = () => ({ 
  isEnabled: false 
});

export default useRequestListFeature;
