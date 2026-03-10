import React from "react";
import HeartLogo from "../../assets/icons/HeartLogo.svg";
import HeartLogoOn from "../../assets/icons/HeartLogoOn.svg";

interface SavedIconProps {
  size?: number;
  color?: string;
  /** true = saved (filled heart), false = unsaved (outline heart) */
  filled?: boolean;
}

/** Red when saved (filled), otherwise uses provided color or default. */
const SAVED_HEART_COLOR = "#E53935";

/**
 * Saved icon: HeartLogo (outline) when unsaved, HeartLogoOn (filled, red) when saved.
 */
export default function SavedIcon({
  size = 24,
  color,
  filled = false,
}: SavedIconProps) {
  const Icon = filled ? HeartLogoOn : HeartLogo;
  const fillColor = filled ? SAVED_HEART_COLOR : color;
  return <Icon width={size} height={size * (23 / 25)} color={fillColor} />;
}
