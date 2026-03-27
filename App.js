import { useRef, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Animated, Pressable, Dimensions, Easing, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const bearSize = Math.min(width, height) * 0.7;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const clarityProjectId = process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID;
const metaPixelId = process.env.EXPO_PUBLIC_META_PIXEL_ID;

function loadClarity(projectId) {
  if (
    Platform.OS !== 'web' ||
    !projectId ||
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return;
  }

  if (document.getElementById('microsoft-clarity-script')) {
    return;
  }

  window.clarity = window.clarity || function clarityQueue() {
    (window.clarity.q = window.clarity.q || []).push(arguments);
  };

  const script = document.createElement('script');
  script.id = 'microsoft-clarity-script';
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${projectId}`;
  document.head.appendChild(script);
}

function loadMetaPixel(pixelId) {
  if (
    Platform.OS !== 'web' ||
    !pixelId ||
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return;
  }

  if (typeof window.fbq === 'function') {
    return;
  }

  (function initMetaPixel(f, b, e, v, n, t, s) {
    if (f.fbq) {
      return;
    }

    n = function metaQueue() {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };

    if (!f._fbq) {
      f._fbq = n;
    }

    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
    f.fbq = n;
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
  window.fbq('track', 'ViewContent', {
    content_name: 'Softy Bear Experience',
    content_category: 'interactive_landing_page',
  });
}

function trackClarityEvent(eventName, metadata) {
  if (
    Platform.OS !== 'web' ||
    typeof window === 'undefined' ||
    typeof window.clarity !== 'function'
  ) {
    return;
  }

  try {
    if (metadata) {
      window.clarity('event', eventName, metadata);
      return;
    }

    window.clarity('event', eventName);
  } catch (error) {
    console.warn('Clarity event tracking failed', error);
  }
}

function trackMetaEvent(eventName, metadata) {
  if (
    Platform.OS !== 'web' ||
    typeof window === 'undefined' ||
    typeof window.fbq !== 'function'
  ) {
    return;
  }

  try {
    if (metadata) {
      window.fbq('trackCustom', eventName, metadata);
      return;
    }

    window.fbq('trackCustom', eventName);
  } catch (error) {
    console.warn('Meta Pixel event tracking failed', error);
  }
}

function trackMetaStandardEvent(eventName, metadata) {
  if (
    Platform.OS !== 'web' ||
    typeof window === 'undefined' ||
    typeof window.fbq !== 'function'
  ) {
    return;
  }

  try {
    if (metadata) {
      window.fbq('track', eventName, metadata);
      return;
    }

    window.fbq('track', eventName);
  } catch (error) {
    console.warn('Meta Pixel standard event tracking failed', error);
  }
}

function getInteractionZone(locationX, locationY) {
  const x = (locationX / bearSize) * 200;
  const y = (locationY / bearSize) * 200;

  if (x > 28 && x < 62 && y > 22 && y < 62) {
    return 'left-ear';
  }

  if (x > 138 && x < 172 && y > 22 && y < 62) {
    return 'right-ear';
  }

  if (x > 87 && x < 113 && y > 106 && y < 125) {
    return 'nose';
  }

  if (x > 38 && x < 72 && y > 96 && y < 124) {
    return 'left-cheek';
  }

  if (x > 128 && x < 162 && y > 96 && y < 124) {
    return 'right-cheek';
  }

  if (x > 70 && x < 130 && y > 48 && y < 86) {
    return 'forehead';
  }

  return 'face';
}

export default function App() {
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const leanX = useRef(new Animated.Value(0)).current;
  const leanY = useRef(new Animated.Value(0)).current;
  const blushOpacity = useRef(new Animated.Value(0.3)).current;
  const earTilt = useRef(new Animated.Value(0)).current;
  const noseScale = useRef(new Animated.Value(1)).current;
  const petGlow = useRef(new Animated.Value(0)).current;
  const [eyesClosed, setEyesClosed] = useState(false);
  const [activeZone, setActiveZone] = useState('face');

  const breatheAnimRef = useRef(null);
  const timeoutsRef = useRef([]);

  const BREATH_DURATION = 4000;
  const BREATH_SCALE = 1.06;
  const TOUCHED_BREATH_DURATION = 6000;
  const TOUCHED_BREATH_SCALE = 1.025;

  useEffect(() => {
    loadClarity(clarityProjectId);
    loadMetaPixel(metaPixelId);
  }, []);

  const queueTimeout = useCallback((callback, delay) => {
    const id = setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((timeoutId) => timeoutId !== id);
      callback();
    }, delay);

    timeoutsRef.current.push(id);
    return id;
  }, []);

  const clearQueuedTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const startBreathing = useCallback((touched = false) => {
    const duration = touched ? TOUCHED_BREATH_DURATION : BREATH_DURATION;
    const toScale = touched ? TOUCHED_BREATH_SCALE : BREATH_SCALE;

    breatheAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: toScale,
          duration: duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    breatheAnimRef.current.start();
  }, [breatheAnim]);

  useEffect(() => {
    startBreathing(false);
    return () => {
      clearQueuedTimeouts();
      if (breatheAnimRef.current) {
        breatheAnimRef.current.stop();
      }
    };
  }, [clearQueuedTimeouts, startBreathing]);

  const handlePressIn = useCallback((event) => {
    clearQueuedTimeouts();

    if (breatheAnimRef.current) {
      breatheAnimRef.current.stop();
    }
    startBreathing(true);

    const { locationX, locationY } = event.nativeEvent;
    const centerX = bearSize / 2;
    const centerY = bearSize / 2;
    const zone = getInteractionZone(locationX, locationY);

    let deltaX = ((locationX - centerX) / bearSize) * 8;
    let deltaY = ((locationY - centerY) / bearSize) * 5;
    let nextBlush = 0.45;
    let closeDelay = 150;

    setActiveZone(zone);

    if (zone === 'left-ear') {
      deltaX = -8;
      deltaY = -4;
    } else if (zone === 'right-ear') {
      deltaX = 8;
      deltaY = -4;
    } else if (zone === 'nose') {
      deltaX = 0;
      deltaY = 2;
      nextBlush = 0.52;
      closeDelay = 80;
    } else if (zone === 'left-cheek' || zone === 'right-cheek') {
      nextBlush = 0.75;
    } else if (zone === 'forehead') {
      deltaX = 0;
      deltaY = -6;
      nextBlush = 0.38;
      closeDelay = 220;
    }

    trackClarityEvent('bear_interaction', { zone });
    trackMetaStandardEvent('Lead', { zone });

    if (zone === 'nose') {
      trackClarityEvent('nose_booped');
      trackMetaEvent('NoseBooped');
    } else if (zone === 'forehead') {
      trackClarityEvent('forehead_pet');
      trackMetaEvent('ForeheadPet');
    } else if (zone === 'left-ear' || zone === 'right-ear') {
      trackClarityEvent('ear_tapped', { side: zone === 'left-ear' ? 'left' : 'right' });
      trackMetaEvent('EarTapped', { side: zone === 'left-ear' ? 'left' : 'right' });
    } else if (zone === 'left-cheek' || zone === 'right-cheek') {
      trackClarityEvent('cheek_tapped', { side: zone === 'left-cheek' ? 'left' : 'right' });
      trackMetaEvent('CheekTapped', { side: zone === 'left-cheek' ? 'left' : 'right' });
    }

    queueTimeout(() => setEyesClosed(true), closeDelay);

    Animated.parallel([
      Animated.timing(leanX, {
        toValue: deltaX,
        duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(leanY, {
        toValue: deltaY,
        duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(blushOpacity, {
        toValue: nextBlush,
        duration: 1200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(earTilt, {
        toValue: zone === 'left-ear' ? -1 : zone === 'right-ear' ? 1 : 0,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(noseScale, {
        toValue: zone === 'nose' ? 1.22 : 1,
        duration: 220,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: false,
      }),
      Animated.timing(petGlow, {
        toValue: zone === 'forehead' ? 1 : 0,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  }, [
    blushOpacity,
    clearQueuedTimeouts,
    earTilt,
    leanX,
    leanY,
    noseScale,
    petGlow,
    queueTimeout,
    startBreathing,
  ]);

  const handlePressOut = useCallback(() => {
    clearQueuedTimeouts();
    queueTimeout(() => setEyesClosed(false), 500);
    setActiveZone('face');

    Animated.parallel([
      Animated.timing(leanX, {
        toValue: 0,
        duration: 2000,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(leanY, {
        toValue: 0,
        duration: 2000,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(blushOpacity, {
        toValue: 0.3,
        duration: 2500,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(earTilt, {
        toValue: 0,
        duration: 800,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(noseScale, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(petGlow, {
        toValue: 0,
        duration: 900,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();

    queueTimeout(() => {
      if (breatheAnimRef.current) {
        breatheAnimRef.current.stop();
      }
      startBreathing(false);
    }, 1500);
  }, [
    blushOpacity,
    clearQueuedTimeouts,
    earTilt,
    leanX,
    leanY,
    noseScale,
    petGlow,
    queueTimeout,
    startBreathing,
  ]);

  const rotation = leanX.interpolate({
    inputRange: [-8, 8],
    outputRange: ['-8deg', '8deg'],
  });

  const foreheadGlowOpacity = petGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.22],
  });

  const noseRx = noseScale.interpolate({
    inputRange: [1, 1.22],
    outputRange: [12, 14.5],
  });

  const noseRy = noseScale.interpolate({
    inputRange: [1, 1.22],
    outputRange: [8, 9.5],
  });

  const mouthPath = activeZone === 'nose'
    ? 'M 86 136 Q 100 147, 114 136'
    : activeZone === 'forehead'
      ? 'M 88 136 Q 100 140, 112 136'
      : 'M 88 135 Q 100 142, 112 135';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" hidden />
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View
          style={[
            styles.bear,
            {
              transform: [
                { scale: breatheAnim },
                { rotate: rotation },
                { translateY: leanY },
              ],
            },
          ]}
        >
          <Svg width={bearSize} height={bearSize} viewBox="0 0 200 200">
            <AnimatedCircle
              cx="100"
              cy="74"
              r="28"
              fill="#fff7df"
              opacity={foreheadGlowOpacity}
            />

            <Circle cx="45" cy="45" r="30" fill="#c9a06a" />
            <Circle
              cx="45"
              cy="45"
              r="18"
              fill={activeZone === 'left-ear' ? '#ffd7c0' : '#f5d0b9'}
            />
            <AnimatedCircle
              cx="45"
              cy="45"
              r="26"
              fill="#fff3db"
              opacity={earTilt.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [0.18, 0, 0.04],
              })}
            />

            <Circle cx="155" cy="45" r="30" fill="#c9a06a" />
            <Circle
              cx="155"
              cy="45"
              r="18"
              fill={activeZone === 'right-ear' ? '#ffd7c0' : '#f5d0b9'}
            />
            <AnimatedCircle
              cx="155"
              cy="45"
              r="26"
              fill="#fff3db"
              opacity={earTilt.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [0.04, 0, 0.18],
              })}
            />

            <Circle cx="100" cy="100" r="70" fill="#d4a574" />

            <Ellipse cx="100" cy="125" rx="35" ry="28" fill="#f5e0c9" />

            <AnimatedEllipse cx="100" cy="115" rx={noseRx} ry={noseRy} fill="#5c4033" />

            {eyesClosed ? (
              <>
                <Path
                  d="M 62 90 Q 70 96, 78 90"
                  stroke="#2c1810"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d="M 122 90 Q 130 96, 138 90"
                  stroke="#2c1810"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </>
            ) : (
              <>
                <Circle cx="70" cy="90" r="8" fill="#2c1810" />
                <Circle cx="130" cy="90" r="8" fill="#2c1810" />
                <Circle cx="72" cy="88" r="3" fill="#ffffff" />
                <Circle cx="132" cy="88" r="3" fill="#ffffff" />
              </>
            )}

            <Path
              d={mouthPath}
              stroke="#5c4033"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />

            <AnimatedCircle
              cx="55"
              cy="110"
              r="14"
              fill="#f8b4b4"
              opacity={blushOpacity}
            />
            <AnimatedCircle
              cx="145"
              cy="110"
              r="14"
              fill="#f8b4b4"
              opacity={blushOpacity}
            />
          </Svg>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fef6e4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bear: {
    backgroundColor: 'transparent',
  },
});
