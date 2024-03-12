import React, {useEffect, useState} from 'react';
import {
  Dimensions,
  Modal,
  StatusBar,
  View,
  Text as Txt,
  Image as Img,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import {
  Canvas,
  Group,
  Image,
  Text,
  matchFont,
  useFont,
  useFonts,
  useImage,
} from '@shopify/react-native-skia';
import {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import {MyColors} from './src/assets/MyColors';
import AsyncStorage from '@react-native-async-storage/async-storage';
var Sound = require('react-native-sound');

var bgSound = new Sound('bg2.mp3', Sound.MAIN_BUNDLE, error => {
  bgSound.setVolume(0.5);
  bgSound.play();
  if (error) {
    console.log('failed to load the sound', error);
  }
});

var jumpSound = new Sound('jump2.mp3', Sound.MAIN_BUNDLE, error => {
  if (error) {
    console.log('failed to load the sound', error);
  }
});

var deadSound = new Sound('dead.mp3', Sound.MAIN_BUNDLE, error => {
  bgSound.setVolume(0.5);
  if (error) {
    console.log('failed to load the sound', error);
  }
});

var clickSound = new Sound('click.mp3', Sound.MAIN_BUNDLE, error => {
  if (error) {
    console.log('failed to load the sound', error);
  }
});

const GRAVITY = 1000;
const JUMP = -350;

const pipeWidth = 100;
const pipeHeight = 640;

const App = () => {
  const {width, height} = Dimensions.get('window');

  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [showModel, setShowModel] = useState(false);
  const [selectedBird, setSelectedBird] = useState('yellow');
  const pipeX = useSharedValue(width);
  const pipeOffset = useSharedValue(0);
  const pipeTopY = useDerivedValue(() => pipeOffset.value - 320);
  const pipeBottomY = useDerivedValue(() => height - 320 + pipeOffset.value);

  const birdY = useSharedValue(height / 3);
  const birdX = width / 6;
  const birdYVelocity = useSharedValue(100);

  const gameOver = useSharedValue(false);

  // image resources
  const bg = useImage(require('./src/assets/sprites/background-day.png'));
  const birdYellow = useImage(
    require('./src/assets/sprites/yellowbird-midflap.png'),
  );
  const birdBlue = useImage(
    require('./src/assets/sprites/bluebird-midflap.png'),
  );
  const birdRed = useImage(require('./src/assets/sprites/redbird-midflap.png'));
  const base = useImage(require('./src/assets/sprites/base.png'));
  const pipeTop = useImage(require('./src/assets/sprites/pipe-green-top.png'));
  const pipeBottom = useImage(
    require('./src/assets/sprites/pipe-green-bottom.png'),
  );
  // bird's movement speed
  const movementSpeed = useDerivedValue(() => {
    return interpolate(score, [0, 20], [1, 2]);
  });

  // top and bottom pipes
  const obstacles = useDerivedValue(() => [
    // add bottom pipe
    {
      x: pipeX.value,
      y: height - 320 + pipeOffset.value,
      h: pipeHeight,
      w: pipeWidth,
    },
    // add top pipe
    {
      x: pipeX.value,
      y: pipeOffset.value - 320,
      h: pipeHeight,
      w: pipeWidth,
    },
  ]);

  useEffect(() => {
    if (!showModel) {
      bgSound.setCurrentTime(0);
      bgSound.play();
    } else {
      bgSound.pause();
      deadSound.setCurrentTime(0);
      deadSound.play();
    }
  }, []);

  useEffect(() => {
    if (score > bestScore) {
      (async () => {
        await AsyncStorage.setItem('bestscore', JSON.stringify(score));
      })();
    }
  }, [score, gameOver.value]);

  useEffect(() => {
    (async () => {
      try {
        const bestScore = await AsyncStorage.getItem('bestscore');
        console.log('best score', bestScore);
        setBestScore(bestScore);
      } catch (error) {
        console.log('Error fetching score', error);
      }
    })();
  }, [gameOver.value]);

  // map movement
  useEffect(() => {
    setTimeout(() => {
      animateMap();
    }, 2000);
  }, []);

  // map movement
  const animateMap = () => {
    pipeX.value = withRepeat(
      withSequence(
        withTiming(-150, {
          duration: 3000 / movementSpeed.value,
          easing: Easing.linear,
        }),
        withTiming(width, {duration: 0}),
      ),
      -1,
    );
  };

  // score calculation
  useAnimatedReaction(
    () => pipeX.value,
    (currentValue, previousValue) => {
      const middle = birdX;

      // random pipe X values between [middle - PIPE_RANGE/2, middle + PIPE_RANGE/2]
      if (previousValue && currentValue < -100 && previousValue > -100) {
        pipeOffset.value = Math.random() * 400 - 200;
        // cancelAnimation(pipeX);
        // runOnJS(animateMap)();
      }

      if (
        currentValue !== previousValue &&
        previousValue &&
        currentValue <= middle &&
        previousValue > middle
      ) {
        runOnJS(setScore)(score + 1);
        // console.log('Score ++');
      }
    },
  );

  // hits the any obstacle
  const isPointCollidingWithRect = (bird, pipe) => {
    'worklet';
    return (
      bird.x >= pipe.x && // right of the left edge AND
      bird.x <= pipe.x + pipe.w && // left of the right edge AND
      bird.y >= pipe.y && // below the top AND
      bird.y <= pipe.y + pipe.h // above the bottom
    );
  };

  // detect collision
  useAnimatedReaction(
    () => birdY.value,
    (currentValue, previousValue) => {
      // hits the ground or sky
      const center = {
        x: birdX + 32,
        y: birdY.value + 24,
      };
      if (currentValue > height - 100 || currentValue < 0) {
        // console.log('Game over');
        gameOver.value = true;
      }
      // hits any obstacle
      const isColliding = obstacles.value.some(pipe =>
        isPointCollidingWithRect(center, pipe),
      );
      if (isColliding) {
        gameOver.value = true;
      }
    },
  );

  // cancel map movement
  useAnimatedReaction(
    () => gameOver.value,
    async (currentValue, previousValue) => {
      if (currentValue && !previousValue) {
        // console.log('Game over');
        cancelAnimation(pipeX);
        runOnJS(setShowModel)(true);
      }
    },
  );

  // gravity pulling down
  useFrameCallback(({timeSincePreviousFrame: dt}) => {
    if (!dt || gameOver.value) {
      return;
    }
    birdY.value = birdY.value + (birdYVelocity.value * dt) / 1000;
    birdYVelocity.value = birdYVelocity.value + (GRAVITY * dt) / 1000;
  });

  // restart from beginning
  const restartGame = async () => {
    'worklet';
    birdY.value = height / 3;
    birdYVelocity.value = 0;
    gameOver.value = false;
    pipeX.value = width;
    runOnJS(animateMap)();
    runOnJS(setScore)(0);
  };

  const playJump = () => {
    jumpSound.setCurrentTime(0);
    jumpSound.play();
  };

  // on press detection
  const gesture = Gesture.Tap().onStart(() => {
    // if (gameOver.value) {
    //   restartGame();
    // } else {
    //   birdYVelocity.value = JUMP;
    // }
    runOnJS(playJump)();
    birdYVelocity.value = JUMP;
  });

  // bird physics
  const birdTransformation = useDerivedValue(() => {
    return [
      {
        rotate: interpolate(
          birdYVelocity.value,
          [-500, 500],
          [-0.5, 0.5],
          Extrapolation.CLAMP,
        ),
      },
    ];
  });

  // bird original position
  const birdOrigin = useDerivedValue(() => {
    return {x: width / 4 + 32, y: birdY.value + 24};
  });

  // text fonts
  // const scoreFontStyle = {
  //   fontFamily: 'Audiowide',
  //   fontSize: 40,
  //   fontWeight: 'bold',
  // };
  // const scoreFont = matchFont(scoreFontStyle);
  const fontSize = 40;
  const scoreFont = useFont(
    require('./assets/fonts/Audiowide-Regular.ttf'),
    fontSize,
  );

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <GestureDetector gesture={gesture}>
        <View style={{flex: 1}}>
          {/* <Feather name="volume-1" size={20} color={MyColors.white} /> */}
          <Canvas style={{width, height}}>
            <StatusBar
              barStyle={'light-content'}
              backgroundColor={MyColors.statusBar}
            />
            {/* bg image */}
            <Image image={bg} height={height} width={width} fit={'cover'} />
            {/* top pipe */}
            <Image
              image={pipeTop}
              y={pipeTopY}
              x={pipeX}
              width={pipeWidth}
              height={pipeHeight}
            />
            {/* bottom pipe */}
            <Image
              image={pipeBottom}
              y={pipeBottomY}
              x={pipeX}
              width={pipeWidth}
              height={pipeHeight}
            />
            {/* ground */}
            <Image
              image={base}
              width={width}
              height={150}
              y={height - 75}
              x={0}
              fit={'cover'}
            />
            {/* bird */}
            <Group transform={birdTransformation} origin={birdOrigin}>
              <Image
                image={
                  selectedBird === 'yellow'
                    ? birdYellow
                    : selectedBird === 'red'
                    ? birdRed
                    : birdBlue
                }
                y={birdY}
                x={birdX}
                width={60}
                height={40}
              />
            </Group>
            <Text
              text={score.toString()}
              x={width / 2 - 30}
              y={100}
              font={scoreFont}
            />
          </Canvas>
          {showModel && (
            <Modal
              animationType="fade"
              transparent={true}
              visible={showModel}
              onRequestClose={() => setShowModel(false)}>
              <ImageBackground
                source={require('./src/assets/sprites/background-day.png')}
                style={{
                  flex: 1,
                  // backgroundColor: 'rgba(0, 0, 0, 0.1)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                <Img source={require('./src/assets/sprites/gameover.png')} />
                <Txt
                  style={{
                    color: MyColors.black,
                    fontSize: 18,
                    fontFamily: 'PressStart2P-Regular',
                    marginTop: height * 0.05,
                  }}>
                  Bird Skin
                </Txt>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-evenly',
                    margin: 20,
                    width: '50%',
                  }}>
                  <TouchableOpacity
                    onPress={() => setSelectedBird('yellow')}
                    style={
                      selectedBird === 'yellow'
                        ? {
                            width: 45,
                            height: 40,
                            borderWidth: 2,
                            borderColor: MyColors.black3,
                            borderRadius: 4,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }
                        : {
                            width: 45,
                            height: 40,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }
                    }>
                    <Img
                      source={require('./src/assets/sprites/yellowbird-midflap.png')}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSelectedBird('blue')}
                    style={
                      selectedBird === 'blue'
                        ? {
                            width: 45,
                            height: 40,
                            borderWidth: 2,
                            borderColor: MyColors.black3,
                            borderRadius: 4,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }
                        : {
                            width: 45,
                            height: 40,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }
                    }>
                    <Img
                      source={require('./src/assets/sprites/bluebird-midflap.png')}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSelectedBird('red')}
                    style={
                      selectedBird === 'red'
                        ? {
                            width: 45,
                            height: 40,
                            borderWidth: 2,
                            borderColor: MyColors.black3,
                            borderRadius: 4,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }
                        : {
                            width: 45,
                            height: 40,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }
                    }>
                    <Img
                      source={require('./src/assets/sprites/redbird-midflap.png')}
                    />
                  </TouchableOpacity>
                </View>
                <View
                  style={{
                    width: width * 0.5,
                    height: height * 0.3,
                    backgroundColor: MyColors.white,
                    borderWidth: 2,
                    borderColor: MyColors.black3,
                    borderRadius: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Txt
                    style={{
                      color: MyColors.gray,
                      fontSize: 18,
                      marginBottom: 5,
                      fontFamily: 'Audiowide-Regular',
                    }}>
                    Your score
                  </Txt>
                  <Txt
                    style={{
                      color: MyColors.black,
                      fontSize: 18,
                      fontWeight: '600',
                      marginBottom: 10,
                      fontFamily: 'PressStart2P-Regular',
                    }}>
                    {score}
                  </Txt>
                  <Txt
                    style={{
                      color: MyColors.gray,
                      fontSize: 18,
                      marginBottom: 5,
                      fontFamily: 'Audiowide-Regular',
                    }}>
                    Best score
                  </Txt>
                  <Txt
                    style={{
                      color: MyColors.black,
                      fontSize: 18,
                      fontWeight: '600',
                      fontFamily: 'PressStart2P-Regular',
                    }}>
                    {bestScore}
                  </Txt>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowModel(false);
                    restartGame();
                  }}>
                  <Txt
                    style={{
                      color: MyColors.black,
                      fontFamily: 'PressStart2P-Regular',
                      marginTop: 25,
                    }}>
                    RESTART
                  </Txt>
                </TouchableOpacity>
              </ImageBackground>
            </Modal>
          )}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};
export default App;
