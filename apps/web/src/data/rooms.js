export const CONTACT = {
  name: 'Escape Occitanie',
  domain: 'escapeoccitanie.fr',
  website: 'https://escapeoccitanie.fr',
  logo: 'https://horizons-cdn.hostinger.com/6f05984e-16ed-4597-8f84-cb44fc903b9b/4bd0e6870391b77d0f13cc22e5fda061.jpg',
  address: '23 Bd de Verdun, 12400 Saint-Affrique',
  phone: '07 43 72 99 94',
  phoneHref: 'tel:+33743729994',
  email: 'escapeoccitanie@gmail.com',
  facebook: 'https://www.facebook.com/EscapeSaintAffrique',
  instagram: 'https://www.instagram.com/escape_occitanie/',
  maps: 'https://www.google.com/maps/place/Escape+Occitanie/@43.9575602,2.8805006,575m/data=!3m1!1e3!4m15!1m8!3m7!1s0x12b23bbf554c6b7d:0x5f6760ff0e4d410d!2sEscape+Occitanie!8m2!3d43.9575602!4d2.8805006!10e1!16s%2Fg%2F11pd2hdl2n!3m5!1s0x12b23bbf554c6b7d:0x5f6760ff0e4d410d!8m2!3d43.9575602!4d2.8805006!16s%2Fg%2F11pd2hdl2n?entry=ttu&g_ep=EgoyMDI2MDgyNS4wIKXMDSoASAFQAw%3D%3D',
};

export const ROOMS = {
  directeur: {
    slug: 'directeur',
    name: 'Convocation chez le Directeur',
    shortName: 'Le Directeur',
    tagline: 'Enquête au cœur du collège',
    pagePath: '/salles/convocation-chez-le-directeur',
    bookingPath: '/reservation/convocation-chez-le-directeur',
    players: '3 à 6 joueurs',
    minAge: 'Dès 14 ans',
    duration: '60 minutes',
    difficulty: 3,
    successRate: 58,
    image: 'https://images.hostinger.com/f2d40922-ae59-47a0-95d4-549223e899bf.png',
    imageAlt: "Bureau du directeur du collège plongé dans la pénombre, lampe verte allumée",
    cardDescription:
      "Convoqués dans le bureau de M. Grenot, aidez l'inspecteur Dupont à percer le mystère qui plane sur le collège. Fouille, indices et révélations vous attendent.",
    story: [
      "Une convocation mystérieuse… Vous voilà réunis dans le bureau du directeur du collège. Depuis quelques semaines, d'étranges rumeurs circulent dans les couloirs de l'école, et personne ne sait vraiment ce qui se passe derrière cette porte.",
      "Des élèves entrés dans le bureau de M. Grenot en sont ressortis… changés. La mémoire confuse, incapables de raconter ce qui s'y est passé. Certains murmurent que le directeur cache un secret bien plus sombre qu'il n'y paraît.",
      "L'inspecteur Dupont mène l'enquête, mais il a besoin de vous. Fouillez le bureau, rassemblez les indices, résolvez les énigmes et découvrez la vérité avant que les 60 minutes ne s'écoulent. Après, il sera trop tard.",
    ],
    note: "« Ils ressortent tous… changés. » — carnet de l'inspecteur Dupont",
    gallery: [
      {
        src: 'https://images.hostinger.com/e4188b98-da57-4aab-94a5-df4d85f06176.png',
        alt: 'Loupe posée sur des notes manuscrites et des photographies, indices de l\'enquête',
        caption: 'Les indices de l\'inspecteur',
      },
      {
        src: 'https://images.hostinger.com/e630d118-598a-4cd5-838f-55f7a7e1973c.png',
        alt: 'Salle de classe à l\'ancienne, tableau noir couvert de symboles mystérieux',
        caption: 'La salle de classe abandonnée',
      },
      {
        src: 'https://images.hostinger.com/1201bdc8-6343-437e-a907-8e4250bc04f8.png',
        alt: 'Meuble à tiroirs ancien entrouvert révélant des dossiers et une clé en laiton',
        caption: 'Le cabinet aux dossiers secrets',
      },
    ],
    records: [
      { team: 'Les Limiers de Cordes', time: '38:42' },
      { team: 'Section Enquête', time: '41:07' },
      { team: 'Les Insoumis', time: '44:55' },
    ],
  },
  vaisseau: {
    slug: 'vaisseau',
    name: 'La malédiction du Vaisseau Fantôme',
    shortName: 'Le Vaisseau Fantôme',
    tagline: 'Aventure maudite en haute mer',
    pagePath: '/salles/la-malediction-du-vaisseau-fantome',
    bookingPath: '/reservation/la-malediction-du-vaisseau-fantome',
    players: '3 à 6 joueurs',
    minAge: 'Dès 14 ans',
    duration: '60 minutes',
    difficulty: 4,
    successRate: 41,
    image: 'https://images.hostinger.com/c1b6ad64-40d1-40af-90d5-bb894b7f5893.png',
    imageAlt: 'Cabine du capitaine d\'un galion abandonné, cartes marines et bougies vacillantes',
    cardDescription:
      "Naufragés sur une île inconnue, explorez un galion abandonné et brisez la malédiction du capitaine disparu avant que le temps ne soit écoulé.",
    story: [
      "Après une terrible tempête, vous faites naufrage sur une île inconnue. Au cœur de la brume se dresse une silhouette immense : un galion abandonné, échoué là depuis des siècles, que les marins surnomment le Vaisseau Fantôme.",
      "La légende raconte que son capitaine a disparu dans des circonstances mystérieuses, laissant derrière lui une malédiction qui pèse encore sur le navire et sur quiconque ose y pénétrer.",
      "À vous de percer le secret du Vaisseau Fantôme et de briser la malédiction avant que le temps ne soit écoulé… sinon, vous pourriez bien rester à bord pour l'éternité.",
    ],
    note: "« Nul ne quitte le Vaisseau sans payer son dû. » — journal de bord, dernière page",
    gallery: [
      {
        src: 'https://images.hostinger.com/50859314-a996-473c-838b-b47844ba83b0.png',
        alt: 'Carte au trésor déroulée sur un tonneau, boussole en laiton et doublons d\'or',
        caption: 'La carte du capitaine disparu',
      },
      {
        src: 'https://images.hostinger.com/f70380c8-f4bc-46d8-a2de-e0e186aaf9f8.png',
        alt: 'Pont d\'un galion fantôme dans la brume nocturne, voiles déchirées',
        caption: 'Le pont dans la brume',
      },
      {
        src: 'https://images.hostinger.com/f4dafae4-5670-4898-80fe-0e02adafabfb.png',
        alt: 'Coffre ancien entrouvert laissant échapper une lueur verte surnaturelle',
        caption: 'Le coffre maudit',
      },
    ],
    records: [
      { team: "L'Équipage du Tarn", time: '39:18' },
      { team: 'Les Moussaillons', time: '42:51' },
      { team: 'Cap sur la Victoire', time: '47:03' },
    ],
  },
};

export const ROOM_LIST = [ROOMS.directeur, ROOMS.vaisseau];

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

export const HERO_IMAGE = 'https://images.hostinger.com/97e78780-1685-4dc5-98c8-9ae3b0bb5543.png';
