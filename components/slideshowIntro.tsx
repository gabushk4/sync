import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  ImageProps,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import Icon from '@react-native-vector-icons/ionicons';
import { MainBtn, SecondaryBtn } from '@/abstractions/touchableOpacityAbs';
import { useFont } from '@/contextes/contexteFont';
import { usePalette } from '@/contextes/contextePalette';
import Animated, {
  interpolateColor,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Radius from '@/constants/Radius';
import AppIcon from '@/svgs/appIcon';
import IntroTodoList from './introTodoList';
import NewChatIcon from '@/svgs/newChat';

const TUTORIAL_COMPLETED_KEY = 'tutorial_completed';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Slide = {
  id: string;
  titre: string;
  message: string;
  contenu?: React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    id: 'slide1',
    titre: 'slide1.titre',
    message: 'slide1.message',
    contenu: (
      <View style={{width:'100%', height:'70%', justifyContent:'center', alignItems:'center'}}>
        <AppIcon size={100}/>
      </View>
    )
  },
  {
    id: 'slide2',
    titre: 'slide2.titre',
    message: 'slide2.message',
    contenu: (
      <ImageSlide
        image={require('@/assets/tuto-timelines.png')}
      />
    )
  },
  {
    id: 'slide3',
    titre: 'slide3.titre',
    message: 'slide3.message',
    contenu: (
      <>
        <View style={{height:'20%', width:'100%', alignItems:'center', justifyContent:'center'}}>
          <ImageSlide
            image={require('@/assets/tuto-fab.png')}
          />
        </View>
        <View style={{height:'80%'}}>
          <FabIconsGrid
            items={[
              {
                icon: 'add',
                title: 'home',
                text: 'Ajoute un événement ou une indisponibilité',
              },
              {
                icon: (<NewChatIcon/>),
                title: 'messaging',
                text: 'Crée une conversation avec un ami',
              },
              {
                icon: 'checkmark',
                title: 'createEdit',
                text: 'Confirme la création ou l’édition',
              },
              {
                icon: 'pencil',
                title: 'details',
                text: 'Éditer un événement',
              },
              {
                icon: 'qr-code',
                title: 'profile',
                text: "Ouvre le code QR et le formulaire d'ajout d'ami",
              },
            ]}
          />
        </View>
      </>
    ),
  },
  {
    id: 'slide4',
    titre: 'slide4.titre',
    message: 'slide4.message',
    contenu: (
      <View style={{height:'80%', width:'100%'}}>
        <IntroTodoList forceShown={true}/>
      </View>
    )
  },
];

type FabIconItem = {
  icon: React.ComponentProps<typeof Icon>['name'] | React.ReactElement;
  title: string;
  text: string;
};

function ImageSlide({
  image,
} : {
  image: ImageProps['source'];
}) {
  const { colors } = usePalette();
  
  return (
    <View style={[styles.imagePlaceholder, { backgroundColor: colors.card, borderColor:colors.border }]}>
      <Image
        source={image}
        style={{width: '100%', height:'100%'}}
        resizeMode='contain'
      />
    </View>
  )
}

function IconCell({item} : { item: FabIconItem }){

  const { t } = useTranslation('common', { keyPrefix: 'tuto.slide3.fab' });
  const { colors } = usePalette();
  const { fonts } = useFont();

  return(
    <View style={[styles.iconCell, { width: '48%' }]}>   
    <View style={{height:34, width:34, alignItems:'center', justifyContent:'center'}}>
      {typeof item.icon === 'string' ? (
          <Icon name={item.icon} size={28} color={colors.text} style={{ marginTop: 8 }} />
        ) : (
          item.icon
        )
      }  
      </View>
      <View style={styles.iconTextContainer}>
        <Text style={[styles.iconTitle, { color: colors.text, fontFamily: fonts.body }]}>
          {t(item.title)}
        </Text>
        <Text style={[styles.iconText, { color: colors.muted, fontFamily: fonts.body }]}>
          {item.text}
        </Text>
      </View>
      
    </View>
  )
}

/**
 * FabIconsGrid : affiche les icônes du FAB contextuel en grille.
 * - 2 icônes par rangée.
 * - Si le nombre est impair, la dernière icône est centrée sur toute la largeur.
 */
function FabIconsGrid({ items }: { items: FabIconItem[] }) {
  return (
    <View style={styles.gridContainer}>
      {items.map((item, i) => {
        if (i % 2 !== 0) return null;
        const second = items[i + 1];
        const isPair = !!second;
        return (
          <View
            key={i}
            style={[
              styles.gridRow,
              isPair ? styles.rowPair : styles.rowSingle,
            ]}
          >
            <IconCell item={item}/>
            {second && (
              <IconCell item={second} />
            )}
          </View>
        );
      })}
    </View>
  );
}

type Props = {
  /** Appelé quand l'utilisateur termine le slideshow. */
  onFinish?: () => void;
};

type SlideDotProps = {
  index: number;
  activePage: SharedValue<number>;
  activeColor: string;
  inactiveColor: string;
};

function SlideDot({
  index,
  activePage,
  activeColor,
}: SlideDotProps) {
  const dotAnimated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      activePage.value,
      [index - 1, index, index + 1],
      ['transparent', activeColor, 'transparent'],
    ),
  }));
  return (
    <Animated.View
      key={`dot-${index}`}
      style={[styles.dot, {borderColor:activeColor}, dotAnimated]}
    />
  );
}

/**
 * SlideshowIntro : slides de bienvenue affichés au premier lancement.
 * Quatre slides statiques, navigation horizontale, et bouton « Commencer »
 * sur le dernier slide qui écrit tutorial_completed = true dans AsyncStorage.
 *
 * L'utilisateur ajoute les images dans chaque slide (placeholder prévu).
 */
export default function SlideshowIntro({ onFinish }: Props) {
  const { t } = useTranslation('common', { keyPrefix: 'tuto' });
  const { colors } = usePalette();
  const { fonts } = useFont();

  const scrollViewRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  const activePage = useSharedValue(0);
  
  const isLastPage = currentPage === SLIDES.length - 1;

  const scrollToPage = useCallback((index: number) => {
    setCurrentPage(index);
    scrollViewRef.current?.scrollTo({
      x: index * SCREEN_WIDTH,
      animated: true,
    });
  }, []);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      activePage.set(event.contentOffset.x / SCREEN_WIDTH);
    },
  });

  const nextPage = useCallback(() => {
    if (currentPage < SLIDES.length - 1) {
      scrollToPage(currentPage + 1);
    }
  }, [currentPage, scrollToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 0) {
      scrollToPage(currentPage - 1);
    }
  }, [currentPage, scrollToPage]);

  const finish = useCallback(async () => {
    setIsFinishing(true);
    try {
      await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
      onFinish?.();
    } catch (error) {
      console.warn('Erreur sauvegarde tutoriel', error);
    } finally {
      setIsFinishing(false);
    }
  }, [onFinish]);

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={(event) => {
          setCurrentPage(
            Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH),
          );
        }}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={styles.slide}>
            <View style={styles.slideContent}>
              <Text
                style={[
                  styles.titre,
                  { color: colors.text, fontFamily: fonts.title },
                ]}
              >
                {t(slide.titre)}
              </Text>
              <Text
                style={[
                  styles.message,
                  { color: colors.text, fontFamily: fonts.body },
                ]}
              >
                {t(slide.message)}
              </Text>
              {slide.contenu && (
                <View style={styles.contenuWrapper}>{slide.contenu}</View>
              )}
            </View>
          </View>
        ))}
      </Animated.ScrollView>

      <View style={styles.dotsContainer}>
        {SLIDES.map((_, index) => (
          <SlideDot
            key={`dot-${index}`}
            index={index}
            activePage={activePage}
            activeColor={colors.secondary}
            inactiveColor={colors.muted}
          />
        ))}
      </View>

      <View style={styles.navContainer}>
        {currentPage > 0 && (
          <SecondaryBtn
            style={[styles.navButton]}
            onPress={prevPage}
            disabled={isFinishing}
          >
            <Text style={[styles.navText, { color: colors.text, fontFamily: fonts.body }]}>
              {t('bouton_precedent')}
            </Text>
          </SecondaryBtn>
        )}
        <MainBtn
          style={[styles.navButton, styles.navButtonFinish,]}
          onPress={isLastPage ? finish : nextPage}
          disabled={isFinishing}
        >
          <Text style={[styles.navText, { color: colors.text, fontFamily: fonts.body }]}>
            {isLastPage ? t('bouton_commencer') : t('bouton_suivant')}
          </Text>
        </MainBtn>      
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex:3,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideContent: {
    flex:1,
    paddingHorizontal: 40,
    paddingTop: 60,
    width: '100%',
    alignItems: 'center',
  },
  imagePlaceholder: {
    width: '100%',
    height: '80%',
    borderWidth: 1,
    borderRadius: Radius.lg,
    marginBottom: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  contenuWrapper: {
    flex:2,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  titre: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 40,
  },
  // Grille d'icônes FAB
  gridContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  rowPair: {
    justifyContent: 'space-between',
    gap:8
  },
  rowSingle: {
    justifyContent: 'center',
  }, 
  iconCell: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'column'
  },
  iconTextContainer:{
    flexDirection:'column',
  },
  iconTitle: {
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  iconText: {
    fontSize: 13,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  dot: {
    aspectRatio: 1/1,
    height: 12,
    borderRadius: 100,
    marginHorizontal: 6,
    borderWidth:1
  },
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  navButtonFinish: {
  },
  navText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
