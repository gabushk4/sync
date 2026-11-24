import PATHS from '@/constants/pathNames';
import Radius from '@/constants/Radius';
import { useAPI } from '@/contextes/contexteAPI';
import { useFont } from '@/contextes/contexteFont';
import { useMembre } from '@/contextes/contexteMembre';
import { usePalette } from '@/contextes/contextePalette';
import catcher from '@/functions/catcher';
import log from '@/functions/log';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    Easing,
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Separator from './listSeparator';

/* ------------------------------ Types & config ------------------------------ */

type TutoProgress = {
    addedEvent: boolean;
    addedFriend: boolean;
    importedEvents: boolean;
    invitedFriend: boolean;
    createdDiscussion: boolean;
    fromSharedAvailability: boolean;
};

type TaskId = keyof TutoProgress;

// `as const satisfies` : chaque valeur est un littéral ET doit être une clé de TutoProgress
const TASK_IDS = {
    importedEvents: 'importedEvents',
    addedFriend: 'addedFriend',
    addedEvent: 'addedEvent',
    invitedFriend: 'invitedFriend',
    createdDiscussion: 'createdDiscussion',
    fromSharedAvailability: 'fromSharedAvailability',
} as const satisfies Record<string, TaskId>;

type TodoConfig = { id: TaskId; route?: string };

const TODOS: TodoConfig[] = [
    { id: TASK_IDS.addedFriend, route: PATHS.addFriend },
    { id: TASK_IDS.addedEvent, route: PATHS.createEvent },
    { id: TASK_IDS.invitedFriend, route: undefined },
    { id: TASK_IDS.createdDiscussion, route: undefined },
    { id: TASK_IDS.importedEvents, route: PATHS.settings },
    { id: TASK_IDS.fromSharedAvailability, route: PATHS.home },
];

// Valeur de repli quand `shown` n'existe pas encore (mode forceShown)
const NONE_DONE: TutoProgress = {
    addedEvent: false,
    addedFriend: false,
    importedEvents: false,
    invitedFriend: false,
    createdDiscussion: false,
    fromSharedAvailability: false,
};

const STORAGE_PREFIX = 'tuto_checklist_done';
const CELEBRATION_MS = 5000; // durée de l'état « tout est terminé »
const COLLAPSE_MS = 400; // durée de l'animation de disparition du composant

// Animation d'une tâche qui vient d'être complétée
const SLIDE_OUT_MS = 250; // la ligne part vers la droite
const REORDER_MS = 250; // les autres lignes se réorganisent (la ligne est hors écran)
const SLIDE_IN_MS = 300; // la ligne revient depuis la gauche, complétée, en bas
const STAGGER_MS = 150; // décalage si plusieurs tâches se complètent en même temps
const SETTLE_MS = REORDER_MS + SLIDE_IN_MS + 150; // attendre la fin avant « complete »

// loading  : lecture d'AsyncStorage en cours (on n'affiche rien)
// tasks    : checklist normale
// complete : tout est fait, message de félicitations
// hidden   : terminé, plus rien n'est rendu
type Phase = 'loading' | 'tasks' | 'complete' | 'hidden';

/* ---------------------------------- Todo ---------------------------------- */

function Todo({
    id,
    title,
    description,
    done,
    pending,
    delay,
    onSwap,
    route,
}: {
    id: TaskId;
    title: string;
    description: string;
    done: boolean; // état affiché
    pending: boolean; // complétée côté serveur, animation à jouer
    delay: number;
    onSwap: (id: TaskId) => void; // appelé quand la ligne est hors écran
    route?: string;
}) {
    const { colors } = usePalette();
    const { fonts } = useFont();
    const router = useRouter();

    const x = useSharedValue(0);
    const rowW = useSharedValue(0);

    const slideStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: x.value }],
    }));

    useEffect(() => {
        if (!pending) return;

        x.set(withDelay(
            delay,
            withTiming(
                rowW.value,
                { duration: SLIDE_OUT_MS, easing: Easing.in(Easing.cubic) },
                (finished) => {
                    if (!finished) return;
                    // Hors écran à droite : on bascule l'état (coche + déplacement en bas)
                    scheduleOnRN(onSwap, id);
                    // On replace la ligne à gauche, puis elle revient
                    x.value = -rowW.value;
                    x.value = withDelay(
                        REORDER_MS,
                        withTiming(0, { duration: SLIDE_IN_MS, easing: Easing.out(Easing.cubic) })
                    );
                }
            )
        ));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pending]);

    return (
        <Animated.View
            style={[s.slide, slideStyle]}
            onLayout={(e) => {
                rowW.value = e.nativeEvent.layout.width;
            }}
        >
            <TouchableOpacity
                style={s.todoContainer}
                disabled={!route || done || pending}
                activeOpacity={0.6}
                onPress={() => route && router.push(route as Href)}
            >
                <View style={s.todoCheckContainer}>
                    <Ionicons
                        name={done ? 'checkbox' : 'square-outline'}
                        color={colors.muted}
                        size={20}
                    />
                </View>
                <View style={[s.todoTextContainer, done && s.todoDone]}>
                    <Text
                        numberOfLines={2}
                        style={[s.todoTitle, { color: colors.text, fontFamily: fonts.title }]}
                    >
                        {title}
                    </Text>
                    <Text
                        numberOfLines={2}
                        style={[s.todoDesc, { color: colors.muted, fontFamily: fonts.body }]}
                    >
                        {description}
                    </Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

/* ------------------------------ Checklist (interne) ------------------------------ */

// Un composant par compte : le parent lui donne une `key` différente à chaque
// membre, donc il est détruit et recréé au changement de compte, avec un état
// tout neuf (aucune donnée ni AsyncStorage hérités du compte précédent).
function Checklist({ storageKey, forceShown }: { storageKey: string; forceShown: boolean }) {
    const { api } = useAPI();
    const { t } = useTranslation('tutoChecklist');
    const { colors } = usePalette();
    const { fonts } = useFont();

    const [phase, setPhase] = useState<Phase>('loading');

    // tutoProgress : la vérité côté serveur
    // shown        : ce qui est affiché (en retard sur tutoProgress le temps de l'animation)
    const [tutoProgress, setTutoProgress] = useState<TutoProgress>();
    const [shown, setShown] = useState<TutoProgress>();

    // Ce qu'on lit dans le rendu : jamais undefined (utile en mode forceShown)
    const display = shown ?? NONE_DONE;

    // Animation de disparition du composant
    const progress = useSharedValue(1);
    const fullHeight = useSharedValue(0);
    const collapsing = useSharedValue(false);

    const animatedStyle = useAnimatedStyle(() => {
        // Tant qu'on ne réduit pas : hauteur automatique, et pas d'overflow
        // caché (sinon l'ombre du conteneur serait coupée)
        if (!collapsing.value) return {};
        return {
            opacity: progress.value,
            height: fullHeight.value * progress.value,
            overflow: 'hidden',
        };
    });

    /* ------------------------- Données dérivées de `shown` ------------------------- */

    // Tâches non faites d'abord, tâches faites en bas (ordre d'origine conservé)
    const ordered = useMemo(
        () => [
            ...TODOS.filter((td) => !shown?.[td.id]),
            ...TODOS.filter((td) => shown?.[td.id]),
        ],
        [shown]
    );

    // Tâches à animer : faites côté serveur, pas encore affichées comme faites
    const pendingIds = useMemo(
        () => ordered.filter((td) => !!tutoProgress?.[td.id] && !shown?.[td.id]).map((td) => td.id),
        [ordered, tutoProgress, shown]
    );

    const allDone = useMemo(
        () => (shown ? TODOS.every((td) => shown[td.id]) : false),
        [shown]
    );
    const tasksDone = useMemo(
        () => (shown ? TODOS.filter((td) => shown[td.id]).length : 0),
        [shown]
    );

    

    /* ---------------------------------- Effets ---------------------------------- */

    // 1. Au montage : la checklist a-t-elle déjà été terminée pour CE compte ?
    useEffect(() => {
        let cancelled = false;
        AsyncStorage.getItem(storageKey)
            .then((v) => {
                if (!cancelled) setPhase(v === 'true' ? 'hidden' : 'tasks');
            })
            .catch(() => {
                if (!cancelled) setPhase('tasks');
            });
        return () => {
            cancelled = true;
        };
    }, [storageKey]);

    // Met à jour ce qui est affiché à partir des données du serveur :
    // - première charge : tel quel, sans animation
    // - tâche complétée : NON copiée (c'est la ligne qui déclenche le swap)
    // - tâche redevenue non faite : copiée tout de suite
    function syncShown(prev: TutoProgress | undefined, data: TutoProgress): TutoProgress {
        if (!prev) return data;
        let changed = false;
        const next = { ...prev };
        for (const { id } of TODOS) {
            if (!data[id] && prev[id]) {
                next[id] = false;
                changed = true;
            }
        }
        return changed ? next : prev;
    }

    // 2. Récupération de la progression (si la checklist est active, ou forcée)
    const fetchTodoProgress = useCallback(async () => {
        try {
            const res = await api.get(`/membres/tuto_progress`);
            const data = res.data;

            log('tuto_progress: ', data);

            setTutoProgress(data);
            setShown((prev) => syncShown(prev, data))
        } catch (err) {
            catcher(err, 'récupération échouée');
        }
    }, [api]);

    // useCallback obligatoire : sinon le callback change à chaque rendu et le
    // fetch se relance en boucle
    useFocusEffect(
        useCallback(() => {
            if (phase === 'tasks' || forceShown) fetchTodoProgress();
        }, [phase, forceShown, fetchTodoProgress])
    );

    // Appelé par une ligne quand elle est hors écran : on la marque comme faite
    const onSwap = useCallback((id: TaskId) => {
        setShown((prev) => (prev ? { ...prev, [id]: true } : prev));
    }, []);

    // 4. Tout est fait (une fois les animations terminées) : « complete » + mémorisation
    //    Désactivé en mode forceShown : la checklist reste affichée, sans rien écrire
    useEffect(() => {
        if (forceShown || phase !== 'tasks' || !allDone) return;
        const id = setTimeout(() => {
            setPhase('complete');
            AsyncStorage.setItem(storageKey, 'true').catch(() => {});
        }, SETTLE_MS);
        return () => clearTimeout(id);
    }, [forceShown, phase, allDone, storageKey]);

    // 5. Après CELEBRATION_MS : animation de hauteur + opacité, puis 'hidden'
    const hide = useCallback(() => {
        collapsing.set(true);
        progress.set(withTiming(
            0,
            { duration: COLLAPSE_MS, easing: Easing.out(Easing.cubic) },
            (finished) => {
                if (finished) scheduleOnRN(setPhase, 'hidden');
            }
        ))
    }, [collapsing, progress]);

    useEffect(() => {
        if (forceShown || phase !== 'complete') return;
        const id = setTimeout(hide, CELEBRATION_MS);
        return () => clearTimeout(id);
    }, [forceShown, phase, hide]);

    /* ----------------------------------- Rendu ----------------------------------- */

    // On attend la première réponse du serveur : évite d'afficher des cases
    // décochées à tort, puis de les voir se réorganiser.
    // forceShown outrepasse toutes ces conditions.
    if (!forceShown && (phase === 'loading' || phase === 'hidden' || !shown)) return null;

    return (
        <Animated.View style={[s.wrapper, animatedStyle]}>
            <View
                onLayout={(e) => {
                    // On mesure la hauteur réelle tant qu'on n'a pas commencé à réduire
                    if (!collapsing.value) fullHeight.set(e.nativeEvent.layout.height);
                }}
                style={[s.container, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
                {/* En-tête : hors du ScrollView, donc toujours visible (sticky) */}
                <View style={[s.header, { borderColor: colors.border }]}>
                    <Text style={[s.title, { color: colors.text, fontFamily: fonts.title }]}>
                        {phase === 'complete' ? t('checklist.allDone') : t('checklist.title')}
                    </Text>
                    <Text style={[s.subtitle, { color: colors.muted, fontFamily: fonts.body }]}>
                        {t('checklist.progress', { done: tasksDone, total: TODOS.length })}
                    </Text>
                </View>

                {/* Si le parent limite la hauteur, la liste défile ; sinon elle prend sa
                    taille naturelle. Le ScrollView coupe aussi la ligne qui glisse au bord
                    de la liste, sans toucher à l'ombre du conteneur. */}
                <ScrollView
                    style={s.list}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={true}
                >
                    {ordered.map((todo, i) => (
                        <Animated.View
                            key={todo.id}
                            layout={LinearTransition.duration(REORDER_MS)}
                        >
                            <Todo
                                id={todo.id}
                                title={t(`checklist.tasks.${todo.id}.title`)}
                                description={t(`checklist.tasks.${todo.id}.description`)}
                                done={display[todo.id]}
                                pending={pendingIds.includes(todo.id)}
                                delay={Math.max(pendingIds.indexOf(todo.id), 0) * STAGGER_MS}
                                onSwap={onSwap}
                                route={todo.route}
                            />
                            <Separator
                                show={i < ordered.length - 1}
                                style={{ width: '90%', alignSelf: 'center', marginVertical: 4 }}
                            />
                        </Animated.View>
                    ))}
                </ScrollView>
            </View>
        </Animated.View>
    );
}

/* ------------------------------- IntroTodoList ------------------------------ */

export default function IntroTodoList({ forceShown = false }: { forceShown?: boolean }) {
    const { membre } = useMembre();

    // Pas encore de compte (ou profil pas chargé) : rien à afficher
    if (!membre?.idPublique) return null;

    // key : un autre compte = un composant tout neuf, sans état hérité
    return (
        <Checklist
            key={membre.idPublique}
            storageKey={`${STORAGE_PREFIX}:${membre.idPublique}`}
            forceShown={forceShown}
        />
    );
}

/* --------------------------------- Styles --------------------------------- */

const s = StyleSheet.create({
    // flexShrink: 1 sur toute la chaîne (wrapper -> container -> ScrollView) :
    // c'est ce qui permet au composant de rétrécir quand le parent manque de place
    wrapper: {
        width: '100%',
        flexShrink: 1,
    },
    container: {
        paddingTop: 8,
        paddingHorizontal:8,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        flexShrink: 1,
        borderWidth: 1,
        borderRadius: Radius.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
    },
    header: {
        width: '100%',
        flexShrink: 0, // l'en-tête ne rétrécit jamais
        paddingHorizontal: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems:'center'
    },
    title: {
        fontSize: 20,
    },
    subtitle:{
        fontSize:16
    },
    list: {
        width: '100%',
        flexGrow: 0, // ne s'étire pas : prend sa taille naturelle quand tout rentre
        flexShrink: 1, // rétrécit (et défile) quand le parent limite la hauteur
    },
    slide: {
        width: '100%',
    },
    todoContainer: {
        padding: 8,
        minHeight: 56,
        width: '100%',
        borderRadius: Radius.sm,
        flexDirection: 'row',
        alignItems: 'center',
    },
    todoCheckContainer: {
        width: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    todoTextContainer: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingLeft: 4,
    },
    todoDone: {
        opacity: 0.5,
    },
    todoTitle: {
        fontSize: 18,
    },
    todoDesc: {
        fontSize: 14,
    },
});