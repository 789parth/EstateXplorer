/**
 * Centralized Attribution Configuration
 * Single source of truth for all attribution timing rules.
 * 
 * Spec §12: "Do not hardcode the duration into multiple places."
 */

const ATTRIBUTION_WINDOW_DAYS = 30;
const ATTRIBUTION_WINDOW_MS = ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const INQUIRY_EXPIRY_DAYS = 10;
const INQUIRY_EXPIRY_MS = INQUIRY_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

module.exports = {
  ATTRIBUTION_WINDOW_DAYS,
  ATTRIBUTION_WINDOW_MS,
  INQUIRY_EXPIRY_DAYS,
  INQUIRY_EXPIRY_MS,
};
