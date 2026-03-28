import { useRef, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Animated, Pressable, Dimensions, Easing, Platform, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const bearSize = Math.min(width, height) * 0.7;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const clarityProjectId = process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID;
const metaPixelId = process.env.EXPO_PUBLIC_META_PIXEL_ID;
const IDLE_BUBBLES = ['go ahead, pet me', 'you can pet me', 'come say hi'];
const FAST_TAP_BUBBLES = ['easy there', 'gentle paws, please', 'whoa, slow down'];
const SLOW_TOUCH_BUBBLES = ["mmm, that's nice", 'oh, keep going', 'that feels lovely'];

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

  if (x > 72 && x < 128 && y > 86 && y < 142) {
    return 'center-face';
  }

  return 'face';
}

function pickBubbleMessage(messages, lastMessageRef) {
  if (messages.length === 1) {
    lastMessageRef.current = messages[0];
    return messages[0];
  }

  const candidates = messages.filter((message) => message !== lastMessageRef.current);
  const pool = candidates.length > 0 ? candidates : messages;
  const message = pool[Math.floor(Math.random() * pool.length)];
  lastMessageRef.current = message;
  return message;
}

export default function App() {
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const tapPulse = useRef(new Animated.Value(1)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const bubbleLift = useRef(new Animated.Value(8)).current;
  const leanX = useRef(new Animated.Value(0)).current;
  const leanY = useRef(new Animated.Value(0)).current;
  const blushOpacity = useRef(new Animated.Value(0.3)).current;
  const earTilt = useRef(new Animated.Value(0)).current;
  const noseScale = useRef(new Animated.Value(1)).current;
  const petGlow = useRef(new Animated.Value(0)).current;
  const [eyesClosed, setEyesClosed] = useState(false);
  const [activeZone, setActiveZone] = useState('face');
  const [bubbleMessage, setBubbleMessage] = useState('');

  const breatheAnimRef = useRef(null);
  const timeoutsRef = useRef([]);
  const idlePromptTimerRef = useRef(null);
  const bubbleHideTimerRef = useRef(null);
  const blinkTimerRef = useRef(null);
  const recentTapTimesRef = useRef([]);
  const pressStartedAtRef = useRef(0);
  const pressStartPointRef = useRef(null);
  const slowTouchShownRef = useRef(false);
  const userIsPressingRef = useRef(false);
  const lastBubbleMessageRef = useRef('');

  const BREATH_DURATION = 4000;
  const BREATH_SCALE = 1.06;
  const TOUCHED_BREATH_DURATION = 6000;
  const TOUCHED_BREATH_SCALE = 1.025;

  useEffect(() => {
    loadClarity(clarityProjectId);
    loadMetaPixel(metaPixelId);
  }, []);

  const clearIdlePromptTimer = useCallback(() => {
    if (idlePromptTimerRef.current) {
      clearTimeout(idlePromptTimerRef.current);
      idlePromptTimerRef.current = null;
    }
  }, []);

  const clearBubbleHideTimer = useCallback(() => {
    if (bubbleHideTimerRef.current) {
      clearTimeout(bubbleHideTimerRef.current);
      bubbleHideTimerRef.current = null;
    }
  }, []);

  const clearBlinkTimer = useCallback(() => {
    if (blinkTimerRef.current) {
      clearTimeout(blinkTimerRef.current);
      blinkTimerRef.current = null;
    }
  }, []);

  const hideBubble = useCallback(() => {
    clearBubbleHideTimer();
    Animated.parallel([
      Animated.timing(bubbleOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(bubbleLift, {
        toValue: 8,
        duration: 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setBubbleMessage('');
      }
    });
  }, [bubbleLift, bubbleOpacity, clearBubbleHideTimer]);

  const showBubble = useCallback((message, visibleMs) => {
    clearBubbleHideTimer();
    setBubbleMessage(message);
    bubbleOpacity.stopAnimation();
    bubbleLift.stopAnimation();

    Animated.parallel([
      Animated.timing(bubbleOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(bubbleLift, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    bubbleHideTimerRef.current = setTimeout(() => {
      hideBubble();
    }, visibleMs);
  }, [bubbleLift, bubbleOpacity, clearBubbleHideTimer, hideBubble]);

  const scheduleIdlePrompt = useCallback(() => {
    clearIdlePromptTimer();
    idlePromptTimerRef.current = setTimeout(() => {
      showBubble(pickBubbleMessage(IDLE_BUBBLES, lastBubbleMessageRef), 3000);
    }, 5000);
  }, [clearIdlePromptTimer, showBubble]);

  const scheduleBlink = useCallback(() => {
    clearBlinkTimer();
    const delay = 2200 + Math.random() * 2400;

    blinkTimerRef.current = setTimeout(() => {
      if (userIsPressingRef.current) {
        scheduleBlink();
        return;
      }

      setEyesClosed(true);

      const blinkLength = 120 + Math.random() * 80;
      blinkTimerRef.current = setTimeout(() => {
        if (!userIsPressingRef.current) {
          setEyesClosed(false);
        }
        scheduleBlink();
      }, blinkLength);
    }, delay);
  }, [clearBlinkTimer]);

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
      clearIdlePromptTimer();
      clearBubbleHideTimer();
      clearBlinkTimer();
      if (breatheAnimRef.current) {
        breatheAnimRef.current.stop();
      }
    };
  }, [clearBlinkTimer, clearBubbleHideTimer, clearIdlePromptTimer, clearQueuedTimeouts, startBreathing]);

  useEffect(() => {
    scheduleIdlePrompt();
    scheduleBlink();

    return () => {
      clearIdlePromptTimer();
      clearBubbleHideTimer();
      clearBlinkTimer();
    };
  }, [clearBlinkTimer, clearBubbleHideTimer, clearIdlePromptTimer, scheduleBlink, scheduleIdlePrompt]);

  const handlePressIn = useCallback((event) => {
    clearQueuedTimeouts();
    clearIdlePromptTimer();
    clearBlinkTimer();
    hideBubble();
    userIsPressingRef.current = true;

    if (breatheAnimRef.current) {
      breatheAnimRef.current.stop();
    }
    startBreathing(true);

    const { locationX, locationY } = event.nativeEvent;
    const centerX = bearSize / 2;
    const centerY = bearSize / 2;
    const zone = getInteractionZone(locationX, locationY);
    const now = Date.now();

    pressStartedAtRef.current = now;
    pressStartPointRef.current = { x: locationX, y: locationY };
    slowTouchShownRef.current = false;
    recentTapTimesRef.current = recentTapTimesRef.current.filter((time) => now - time < 1000);
    recentTapTimesRef.current.push(now);

    let deltaX = ((locationX - centerX) / bearSize) * 8;
    let deltaY = ((locationY - centerY) / bearSize) * 5;
    let nextBlush = 0.58;
    let closeDelay = 120;
    let nextNoseScale = 1.08;

    setActiveZone(zone);

    if (zone === 'left-ear') {
      deltaX = -8;
      deltaY = -4;
      nextNoseScale = 1;
    } else if (zone === 'right-ear') {
      deltaX = 8;
      deltaY = -4;
      nextNoseScale = 1;
    } else if (zone === 'nose') {
      deltaX = 0;
      deltaY = 2;
      nextBlush = 0.52;
      closeDelay = 80;
      nextNoseScale = 1.22;
    } else if (zone === 'left-cheek' || zone === 'right-cheek') {
      nextBlush = 0.75;
      nextNoseScale = 1.04;
    } else if (zone === 'forehead') {
      deltaX = 0;
      deltaY = -6;
      nextBlush = 0.38;
      closeDelay = 220;
      nextNoseScale = 1;
    } else if (zone === 'center-face') {
      deltaX = 0;
      deltaY = 1.5;
      nextBlush = 0.68;
      closeDelay = 90;
      nextNoseScale = 1.16;
    } else {
      const minTiltX = deltaX >= 0 ? 2.5 : -2.5;
      const minTiltY = deltaY >= 0 ? 1.5 : -1.5;
      deltaX = Math.abs(deltaX) < 2.5 ? minTiltX : deltaX;
      deltaY = Math.abs(deltaY) < 1.5 ? minTiltY : deltaY;
    }

    trackClarityEvent('bear_interaction', { zone });
    trackMetaStandardEvent('AddToCart', { zone });

    if (recentTapTimesRef.current.length >= 4) {
      showBubble(pickBubbleMessage(FAST_TAP_BUBBLES, lastBubbleMessageRef), 2000);
    }

    if (zone === 'nose') {
      trackClarityEvent('nose_booped');
      trackMetaEvent('NoseBooped');
    } else if (zone === 'forehead') {
      trackClarityEvent('forehead_pet');
      trackMetaEvent('ForeheadPet');
    } else if (zone === 'center-face') {
      trackClarityEvent('face_tapped');
      trackMetaEvent('FaceTapped');
    } else if (zone === 'left-ear' || zone === 'right-ear') {
      trackClarityEvent('ear_tapped', { side: zone === 'left-ear' ? 'left' : 'right' });
      trackMetaEvent('EarTapped', { side: zone === 'left-ear' ? 'left' : 'right' });
    } else if (zone === 'left-cheek' || zone === 'right-cheek') {
      trackClarityEvent('cheek_tapped', { side: zone === 'left-cheek' ? 'left' : 'right' });
      trackMetaEvent('CheekTapped', { side: zone === 'left-cheek' ? 'left' : 'right' });
    }

    queueTimeout(() => setEyesClosed(true), closeDelay);

    tapPulse.stopAnimation();
    tapPulse.setValue(0.965);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(tapPulse, {
          toValue: 1.035,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(tapPulse, {
          toValue: 1,
          duration: 170,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(leanX, {
        toValue: deltaX,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(leanY, {
        toValue: deltaY,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(blushOpacity, {
        toValue: nextBlush,
        duration: 260,
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
        toValue: nextNoseScale,
        duration: 180,
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
    clearBlinkTimer,
    clearIdlePromptTimer,
    clearQueuedTimeouts,
    earTilt,
    hideBubble,
    leanX,
    leanY,
    noseScale,
    petGlow,
    queueTimeout,
    showBubble,
    startBreathing,
    tapPulse,
  ]);

  const handlePressOut = useCallback(() => {
    clearQueuedTimeouts();
    userIsPressingRef.current = false;
    queueTimeout(() => setEyesClosed(false), 360);
    queueTimeout(() => setActiveZone('face'), 240);

    queueTimeout(() => {
      Animated.parallel([
      Animated.timing(leanX, {
        toValue: 0,
        duration: 520,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(leanY, {
        toValue: 0,
        duration: 520,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(blushOpacity, {
        toValue: 0.3,
        duration: 700,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(earTilt, {
        toValue: 0,
        duration: 420,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(noseScale, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(petGlow, {
        toValue: 0,
        duration: 420,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      ]).start();
    }, 120);

    queueTimeout(() => {
      if (breatheAnimRef.current) {
        breatheAnimRef.current.stop();
      }
      startBreathing(false);
      scheduleIdlePrompt();
      scheduleBlink();
    }, 700);
  }, [
    blushOpacity,
    clearQueuedTimeouts,
    earTilt,
    leanX,
    leanY,
    noseScale,
    petGlow,
    queueTimeout,
    scheduleBlink,
    scheduleIdlePrompt,
    startBreathing,
  ]);

  const handlePressMove = useCallback((event) => {
    if (slowTouchShownRef.current) {
      return;
    }

    const startedAt = pressStartedAtRef.current;
    const startPoint = pressStartPointRef.current;

    if (!startedAt || !startPoint) {
      return;
    }

    const now = Date.now();
    const { locationX, locationY } = event.nativeEvent;
    const deltaX = locationX - startPoint.x;
    const deltaY = locationY - startPoint.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (now - startedAt > 450 && distance > 14) {
      slowTouchShownRef.current = true;
      showBubble(pickBubbleMessage(SLOW_TOUCH_BUBBLES, lastBubbleMessageRef), 2000);
    }
  }, [showBubble]);

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
      {bubbleMessage ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bubbleWrap,
            {
              opacity: bubbleOpacity,
              transform: [{ translateY: bubbleLift }],
            },
          ]}
        >
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{bubbleMessage}</Text>
          </View>
          <View style={styles.bubbleTail} />
        </Animated.View>
      ) : null}
      <Pressable onPressIn={handlePressIn} onPressMove={handlePressMove} onPressOut={handlePressOut}>
        <Animated.View
          style={[
            styles.bear,
            {
              transform: [
                { scale: Animated.multiply(breatheAnim, tapPulse) },
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
  bubbleWrap: {
    position: 'absolute',
    top: '18%',
    alignItems: 'center',
    zIndex: 2,
  },
  bubble: {
    backgroundColor: '#fffaf2',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#f2dfc8',
    shadowColor: '#7c5a3b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  bubbleTail: {
    width: 14,
    height: 14,
    backgroundColor: '#fffaf2',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f2dfc8',
    transform: [{ rotate: '45deg' }, { translateY: -7 }],
  },
  bubbleText: {
    color: '#7a5c40',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  bear: {
    backgroundColor: 'transparent',
  },
});
