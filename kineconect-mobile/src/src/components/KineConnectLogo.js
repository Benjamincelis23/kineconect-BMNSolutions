import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle, Path } from 'react-native-svg';


export default function KineConnectLogo({
  variant = 'light', // 'light' | 'dark'
  horizontal = false, // false = vertical (Login), true = horizontal (Header)
  iconSize = 64,
  fontSize = 28,
}) {
  const isDark = variant === 'dark';

  return (
    <View style={[styles.container, horizontal && styles.horizontal]}>
      <Svg
        width={iconSize}
        height={iconSize}
        viewBox="3 3 58 58"
        fill="none"
      >
        <Defs>
          <LinearGradient id="waveCyanApp" x1="14" y1="14" x2="46" y2="38" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor={isDark ? '#7DD3FC' : '#38BDF8'} />
            <Stop offset="100%" stopColor={isDark ? '#38BDF8' : '#0284C7'} />
          </LinearGradient>

          <LinearGradient id="waveNavyApp" x1="50" y1="50" x2="18" y2="26" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#0B1E33" />
            <Stop offset="100%" stopColor="#1967A3" />
          </LinearGradient>

          <LinearGradient id="waveWhiteApp" x1="50" y1="50" x2="18" y2="26" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#BAE6FD" />
          </LinearGradient>
        </Defs>

        {/* Halo de fondo */}
        <Circle
          cx="32"
          cy="32"
          r="28"
          fill={isDark ? '#FFFFFF' : '#F0F9FF'}
          fillOpacity={isDark ? 0.07 : 1}
          stroke="#38BDF8"
          strokeOpacity={isDark ? 0.32 : 0.2}
          strokeWidth={1.5}
        />

        {/* Onda superior: fluidez y movimiento */}
        <Path
          d="M16 36C16 20 26 14 46 20C36 21 27 27 24 38C20.5 38.5 17.5 37.5 16 36Z"
          fill="url(#waveCyanApp)"
        />

        {/* Onda inferior: soporte y estabilidad */}
        <Path
          d="M48 28C48 44 38 50 18 44C28 43 37 37 40 26C43.5 25.5 46.5 26.5 48 28Z"
          fill={isDark ? 'url(#waveWhiteApp)' : 'url(#waveNavyApp)'}
        />

        {/* Núcleo central */}
        <Circle cx="32" cy="32" r="7.5" fill="#38BDF8" fillOpacity={0.22} />
        <Circle cx="32" cy="32" r="4.3" fill="#38BDF8" />
      </Svg>

      <Text style={[styles.wordmark, { fontSize }]}>
        <Text style={{ color: isDark ? '#FFFFFF' : '#0B1E33' }}>Kine</Text>
        <Text style={styles.connectText}>Connect</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  horizontal: {
    flexDirection: 'row',
    gap: 10,
  },
  wordmark: {
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  connectText: {
    color: '#38BDF8',
  },
});
