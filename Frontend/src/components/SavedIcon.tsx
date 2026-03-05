import React from "react";
import HeartLogo from "../../assets/icons/HeartLogo.svg";
import HeartLogoOn from "../../assets/icons/HeartLogoOn.svg";

interface SavedIconProps {
  size?: number;
  color?: string;
  /** true = saved (filled heart), false = unsaved (outline heart) */
  filled?: boolean;
}

/**
 * Saved icon: HeartLogo (outline) when unsaved, HeartLogoOn (filled) when saved.
 */
export default function SavedIcon({
  size = 24,
  color,
  filled = false,
}: SavedIconProps) {
  const Icon = filled ? HeartLogoOn : HeartLogo;
  return <Icon width={size} height={size * (23 / 25)} color={color} />;
}
