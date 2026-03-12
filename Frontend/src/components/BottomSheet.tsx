import React, { useEffect, useRef, type ReactNode } from "react";
import {
  StyleSheet,
  View,
  Text,
  Animated,
  PanResponder,
  Dimensions,
  Easing,
  Pressable,
} from "react-native";
import { GRID_MARGIN } from "../constants/grid";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface BottomSheetProps {
  children: ReactNode;
  snapPoints?: (string | number)[];
  index?: number;
  onSnapChange?: (index: number) => void;
  /** Called when the dimmed backdrop is tapped; use to close sheet and dismiss keyboard */
  onBackdropPress?: () => void;
  /** Shown in the drag handle area at the top so the sheet slides up/down from here */
  title?: string;
  subtitle?: string;
  /** Min distance from top of screen; sheet height is clamped so it never goes above this (e.g. below search bar) */
  topInset?: number;
}

function parseSnapPoint(snap: string | number, maxHeight: number): number {
  let value: number;
  if (typeof snap === "number") value = snap;
  else {
    const pct = parseFloat(snap);
    value = snap.endsWith("%") ? (pct / 100) * SCREEN_HEIGHT : pct;
  }
  return Math.min(value, maxHeight);
}

const ANIM_DURATION = 180;

export default function BottomSheet({
  children,
  snapPoints = ["28%", "60%", "90%"],
  index = 0,
  onSnapChange,
  onBackdropPress,
  title,
  subtitle,
  topInset,
}: BottomSheetProps) {
  const maxHeight =
    topInset != null
      ? SCREEN_HEIGHT - topInset - GRID_MARGIN
      : SCREEN_HEIGHT;
  const heights = snapPoints.map((snap) => parseSnapPoint(snap, maxHeight));
  const initialHeight = heights[Math.min(index, heights.length - 1)];
  const animValue = useRef(new Animated.Value(initialHeight)).current;
  const currentIndexRef = useRef(index);
  const currentHeightRef = useRef(initialHeight);
  const gestureStartHeightRef = useRef(initialHeight);
  const gestureStartIndexRef = useRef(index);
  const onSnapChangeRef = useRef(onSnapChange);
  onSnapChangeRef.current = onSnapChange;

  useEffect(() => {
    const i = Math.min(index, heights.length - 1);
    if (i === currentIndexRef.current) return;
    currentIndexRef.current = i;
    const h = heights[i];
    currentHeightRef.current = h;
    Animated.timing(animValue, {
      toValue: h,
      duration: ANIM_DURATION,
      useNativeDriver: false,
      easing: Easing.out(Easing.cubic),
    }).start((result) => {
      if (result.finished) onSnapChangeRef.current?.(i);
    });
  }, [index, heights, animValue]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        gestureStartHeightRef.current = currentHeightRef.current;
        gestureStartIndexRef.current = currentIndexRef.current;
      },
      onPanResponderMove: (_, g) => {
        const next = gestureStartHeightRef.current - g.dy;
        const clamped = Math.max(
          heights[0],
          Math.min(heights[heights.length - 1], next),
        );
        currentHeightRef.current = clamped;
        animValue.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        const current = currentHeightRef.current;
        const minH = heights[0];
        const maxH = heights[heights.length - 1];
        const range = maxH - minH;
        /** When starting from closed: pull up past this to open (lower = easier to open) */
        const openThreshold = minH + range * 0.1;
        /** When starting from open: swipe down past this to close (higher = easier to close) */
        const closeThreshold = minH + range * 0.7;

        const startedClosed = gestureStartIndexRef.current === 0;
        const movedLittle = Math.abs(gestureState.dy) < 12 && Math.abs(gestureState.dx) < 12;
        const targetIndex =
          startedClosed && movedLittle
            ? heights.length - 1
            : startedClosed
              ? (current > openThreshold ? heights.length - 1 : 0)
              : (current <= closeThreshold ? 0 : heights.length - 1);
        const targetHeight = heights[targetIndex];
        currentIndexRef.current = targetIndex;
        currentHeightRef.current = targetHeight;
        Animated.timing(animValue, {
          toValue: targetHeight,
          duration: ANIM_DURATION,
          useNativeDriver: false,
          easing: Easing.out(Easing.cubic),
        }).start(() => onSnapChangeRef.current?.(targetIndex));
      },
    }),
  ).current;

  return (
    <>
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: animValue.interpolate({
              inputRange: [heights[0], heights[heights.length - 1]],
              outputRange: [0, 0.5],
              extrapolate: "clamp",
            }),
          },
        ]}
        pointerEvents="none"
      />
      {index > 0 && onBackdropPress ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onBackdropPress}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />
      ) : null}
      <Animated.View
        style={[
          styles.sheet,
          {
            height: animValue,
          },
        ]}
      >
        <View
          style={[styles.handleWrap, !title && styles.handleWrapCompact]}
          {...panResponder.panHandlers}
        >
          <View style={styles.handle} />
          {title ? (
            <View style={styles.titleBlock}>
              <Text style={styles.handleTitle} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.handleSubtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
        <View style={styles.content} pointerEvents="box-none">
          {children}
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  sheet: {
    position: "absolute",
    left: GRID_MARGIN,
    right: GRID_MARGIN,
    bottom: GRID_MARGIN,
    backgroundColor: "#fff",
    borderRadius: 24,
    overflow: "hidden",
  },
  handleWrap: {
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: GRID_MARGIN,
    alignItems: "stretch",
    minHeight: 48,
  },
  handleWrapCompact: {
    paddingTop: 6,
    paddingBottom: 6,
    minHeight: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ddd",
    marginBottom: 8,
    alignSelf: "center",
  },
  titleBlock: {
    alignSelf: "stretch",
  },
  handleTitle: {
    fontSize: 24,
    fontWeight: "500",
    color: "#000",
    textAlign: "left",
  },
  handleSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
    textAlign: "left",
  },
  content: {
    flex: 1,
    paddingHorizontal: GRID_MARGIN,
    paddingBottom: 24,
    minHeight: 0,
  },
});
