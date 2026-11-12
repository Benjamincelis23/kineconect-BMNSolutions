import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useTheme } from 'react-native-paper';

export default function Skeleton({ height = 90, style }) {
  const theme = useTheme();
  const o = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(o, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [o]);
  return <Animated.View style={[{ height, borderRadius: 16, marginBottom: 12, opacity: o, backgroundColor: theme.colors.surfaceVariant }, style]} />;
}