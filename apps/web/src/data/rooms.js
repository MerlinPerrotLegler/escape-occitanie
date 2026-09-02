import {
  CONTACT,
  HERO_IMAGE,
  ROOMS as GENERATED_ROOMS,
} from '@/generated/siteCopy';

export { CONTACT, HERO_IMAGE };

export const REVIEWS = [
  {
    name: 'Élodie M.',
    city: 'Albi',
    text: "Une immersion incroyable ! Le bureau du directeur est bluffant de réalisme et les énigmes sont diaboliquement bien pensées. On a adhéré du début à la fin.",
    stars: 5,
  },
  {
    name: 'Thomas R.',
    city: 'Toulouse',
    text: "Le Vaisseau Fantôme nous a littéralement transportés. Un décor digne d'un film, une ambiance à frissonner et un game master au top. On reviendra !",
    stars: 5,
  },
  {
    name: 'Famille Garcia',
    city: 'Castres',
    text: "Parfait en famille : nos enfants de 11 et 14 ans ont participé à toutes les fouilles. Une heure passée beaucoup, beaucoup trop vite !",
    stars: 5,
  },
];

const RECORD_FALLBACK = {
  directeur: [
    { team: 'Les Limiers de Cordes', time: '38:42' },
    { team: 'Section Enquête', time: '41:07' },
    { team: 'Les Insoumis', time: '44:55' },
  ],
  vaisseau: [
    { team: "L'Équipage du Tarn", time: '39:18' },
    { team: 'Les Moussaillons', time: '42:51' },
    { team: 'Cap sur la Victoire', time: '47:03' },
  ],
};

export const ROOMS = {
  directeur: { ...GENERATED_ROOMS.directeur, records: RECORD_FALLBACK.directeur },
  vaisseau: { ...GENERATED_ROOMS.vaisseau, records: RECORD_FALLBACK.vaisseau },
};

export const ROOM_LIST = [ROOMS.directeur, ROOMS.vaisseau];
