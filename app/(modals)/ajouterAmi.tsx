import ModalBase from "@/components/modalBase";
import { useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';

import { useFont } from '@/contextes/contexteFont';
import { useMembre } from "@/contextes/contexteMembre";
import { usePalette } from "@/contextes/contextePalette";

import log from "@/functions/log";

import Haptics from "@/abstractions/haptics";
import QRCodeAbs from "@/abstractions/QrCodeAbs";
import AddFriendForm from "@/components/addFriendForm";
import DemandeConfirmerCourriel from "@/components/demandeConfirmerCourriel";
import { useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";


const PAGES_DEF = [
    {
        id: 'addFriend',
        titleKey: 'addFriend',
        page: <AddFriendForm/>
    },
    {
        id: 'qrCode',
        titleKey: 'qrCode',
        page: <QRCodeAbs/>
    }
]

export default function AjouterAmi() {
    const { t } = useTranslation('friends')
    const { colors } = usePalette();
    const { fonts } = useFont();    
    const { membre, getMembre } = useMembre();

    const { contexte } = useLocalSearchParams()    

    const { width: WIN_W } = Dimensions.get('window')
    const PAGE_W = WIN_W - 34 //padding applied by Modal Base

    const scrollViewRef = useRef<ScrollView>(null)

    const pages = contexte === 'qrCode'
    ? [...PAGES_DEF].reverse()
    : PAGES_DEF;
    
    const contentOffset = useSharedValue(0)

    const animatedTab = useAnimatedStyle(() => {
        return {
            left: interpolate(contentOffset.get(), [0, WIN_W], [0, WIN_W/2])
        }
    })

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (e) => {
            contentOffset.set(e.contentOffset.x)
        }
    })

    const s = StyleSheet.create({
        page: {
            ...StyleSheet.absoluteFill,
            justifyContent: 'space-evenly',
            width: PAGE_W,
            alignItems: 'center',
            height:'100%'
        },
        title: {
            color: colors.text,
            fontSize: 20,
            letterSpacing: 0.7,
            fontFamily: fonts.title,
            textAlign:'center'
        },
        tab: {
            position: 'absolute',
            backgroundColor: colors.secondary,
            opacity: 0.5,
            width: '50%',
            height: '112%',
            borderRadius: 16,
            left: 0
        }
    })

    useEffect(() => {
        log('email confirme', membre.emailConfirme);
        if (!membre.emailConfirme)
            getMembre()
    }, [membre.emailConfirme, getMembre]);

    return membre.emailConfirme ? (
        <ModalBase>
            <View style={{ flex: 1, gap: 4, }}>
                <View style={{ position:'relative', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8, }}>
                    <Animated.View style={[s.tab, animatedTab]}/>
                    {pages.map((p, index) => 
                        <TouchableOpacity
                            key={"tab"+index}
                            style={{width: '50%',}}
                            onPress={() => {
                                Haptics.clickLeger()
                                scrollViewRef.current?.scrollTo({x: WIN_W * index})
                            }}
                        >
                            <Animated.Text key={index} style={s.title}>{t(`tabs.${p.titleKey}`)}</Animated.Text>
                        </TouchableOpacity>
                    )}
                </View>
                <ScrollView
                    ref={scrollViewRef}    
                    horizontal={true}
                    contentContainerStyle={{height:'90%', width: PAGE_W * 2, gap: 16 }}
                    snapToInterval={PAGE_W}
                    decelerationRate={'fast'}
                    showsHorizontalScrollIndicator={false}
                    onScroll={scrollHandler}
                    onMomentumScrollEnd={(e) => {
                        console.log("ended", e.nativeEvent.contentOffset)
                    }}
                >
                    {pages.map((p, index) =>
                        <View key={index} style={[s.page, {left:PAGE_W* index}]}>
                            {p.page}
                        </View>
                    )}                    
                </ScrollView>
            </View>
        </ModalBase>
    ) : (
        <ModalBase>
            <DemandeConfirmerCourriel intro={t('emailConfirmation.friendRequestsIntro')} />
        </ModalBase>
    );
}
