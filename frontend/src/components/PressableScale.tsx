import React from "react";
import { Pressable, PressableProps, ViewStyle, StyleProp } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";

const AView = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

/** Pressable with a smooth scale-down feedback (Spotify/Apple-Music feel). */
export default function PressableScale({ children, style, scaleTo = 0.96, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AView
      {...rest}
      onPressIn={(e) => {
        scale.value = withTiming(scaleTo, { duration: 90 });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: 140 });
        rest.onPressOut?.(e);
      }}
      style={[animStyle, style as any]}
    >
      {children}
    </AView>
  );
}
