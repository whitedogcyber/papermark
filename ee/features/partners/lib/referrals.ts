// The flag function expected by the user account navigation layout
export const isReferralsEnabled = () => false;

// Basic hook/helper fallbacks
export const useReferrals = () => ({ isEnabled: false });
export const getReferralData = () => null;

const fallback = () => false;
export default fallback;
