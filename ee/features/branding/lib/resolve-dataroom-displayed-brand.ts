// Named constant expected by the component
export const CUSTOM_DATAROOM_BRAND = 'custom';

// Main layout resolver function fallback
export const resolveDataroomDisplayedBrand = () => ({
  brand: null,
  isCustomBranded: false,
});

export default resolveDataroomDisplayedBrand;
