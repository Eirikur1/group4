import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Image,
  StyleSheet,
  Animated,
  type ImageStyle,
  type ViewStyle,
  type StyleProp,
} from "react-native";

interface ImageWithSkeletonProps {
  uri: string;
  containerStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain" | "stretch" | "repeat" | "center";
  skeletonBorderRadius?: number;
}

function ImageWithSkeleton({
  uri,
  containerStyle,
  imageStyle,
  resizeMode = "cover",
  skeletonBorderRadius = 8,
}: ImageWithSkeletonProps) {
  const [loaded, setLoaded] = useState(false);
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (loaded) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.5,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [loaded, pulse]);

  return (
    <View style={[styles.container, containerStyle]}>
      {!loaded && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            styles.skeleton,
            { borderRadius: skeletonBorderRadius, opacity: pulse },
          ]}
        />
      )}
      <Image
        source={{ uri }}
        style={[
          StyleSheet.absoluteFillObject,
          imageStyle,
          !loaded && styles.imageHidden,
        ]}
        resizeMode={resizeMode}
        onLoad={() => setLoaded(true)}
      />
    </View>
  );
}

export default React.memo(ImageWithSkeleton);

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  skeleton: {
    backgroundColor: "#E0E0E0",
  },
  imageHidden: {
    opacity: 0,
  },
});
