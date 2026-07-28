import {
  Headphones, Plane, GraduationCap, Hotel, Languages, Car,
} from 'lucide-react-native';

export type FieldType = 'text' | 'phone' | 'email' | 'number' | 'date' | 'datetime' | 'textarea' | 'select';

export type ServiceField = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  multiline?: boolean;
};

export type ServiceDef = {
  slug: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  color: string;
  Icon: any;
  href: string;
  intro: string[];
  fields: ServiceField[];
};

export const SERVICES: ServiceDef[] = [
  {
    slug: 'assistance',
    title: 'Assistance client pendant le séjour',
    shortTitle: 'Assistance',
    subtitle: 'Accompagnement en Chine',
    color: '#2563EB',
    Icon: Headphones,
    href: '/services/assistance',
    intro: [
      'Un conseiller M.O.G vous accompagne pendant votre séjour en Chine.',
      'Remplissez le formulaire : un opérateur vous rappellera avec toutes les infos nécessaires.',
    ],
    fields: [
      { key: 'full_name', label: 'Nom complet', type: 'text', required: true, placeholder: 'Ex. Jean Dupont' },
      { key: 'phone', label: 'Téléphone WhatsApp', type: 'phone', required: true, placeholder: '+237 6XX XXX XXX' },
      { key: 'city_china', label: 'Ville en Chine', type: 'select', required: true, options: [
        { value: 'guangzhou', label: 'Guangzhou' },
        { value: 'shenzhen', label: 'Shenzhen' },
        { value: 'yiwu', label: 'Yiwu' },
        { value: 'other', label: 'Autre' },
      ]},
      { key: 'arrival_date', label: "Date d'arrivée", type: 'date', required: true },
      { key: 'departure_date', label: 'Date de départ', type: 'date' },
      { key: 'hotel_address', label: 'Adresse / hôtel', type: 'text', placeholder: 'Nom ou adresse' },
      { key: 'language', label: 'Langue préférée', type: 'select', options: [
        { value: 'fr', label: 'Français' },
        { value: 'en', label: 'Anglais' },
        { value: 'zh', label: 'Chinois' },
      ]},
      { key: 'needs', label: 'Besoins précis', type: 'textarea', required: true, placeholder: 'Décrivez ce dont vous avez besoin…' },
    ],
  },
  {
    slug: 'airport',
    title: "Accueil à l'aéroport",
    shortTitle: 'Aéroport',
    subtitle: 'Prise en charge à l’arrivée',
    color: '#0EA5E9',
    Icon: Plane,
    href: '/services/airport',
    intro: [
      'Prise en charge à l’aéroport et transfert vers hôtel ou entrepôt.',
      'Réservez idéalement 48h avant l’arrivée.',
    ],
    fields: [
      { key: 'full_name', label: 'Nom du passager', type: 'text', required: true },
      { key: 'phone', label: 'Téléphone WhatsApp', type: 'phone', required: true },
      { key: 'airport', label: 'Aéroport', type: 'select', required: true, options: [
        { value: 'CAN', label: 'Guangzhou Baiyun (CAN)' },
        { value: 'SZX', label: 'Shenzhen Bao’an (SZX)' },
        { value: 'PVG', label: 'Shanghai Pudong (PVG)' },
        { value: 'other', label: 'Autre' },
      ]},
      { key: 'airline', label: 'Compagnie aérienne', type: 'text', required: true, placeholder: 'Ex. Ethiopian, Air France…' },
      { key: 'flight_number', label: 'N° de vol', type: 'text', required: true, placeholder: 'Ex. ET607' },
      { key: 'arrival_datetime', label: "Date & heure d'arrivée", type: 'datetime', required: true },
      { key: 'passengers', label: 'Nombre de passagers', type: 'number', required: true, placeholder: '1' },
      { key: 'luggage', label: 'Nombre de bagages', type: 'number', placeholder: '2' },
      { key: 'destination_address', label: 'Destination (hôtel / adresse)', type: 'text', required: true },
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Enfant, fauteuil roulant, panneau nominatif…' },
    ],
  },
  {
    slug: 'student',
    title: 'Inscription étudiant',
    shortTitle: 'Études',
    subtitle: 'Dossier & universités',
    color: '#7C3AED',
    Icon: GraduationCap,
    href: '/services/student',
    intro: [
      'Accompagnement pour inscriptions universitaires et écoles en Chine.',
      'Aide au dossier, traduction et suivi administratif.',
    ],
    fields: [
      { key: 'full_name', label: 'Nom complet', type: 'text', required: true },
      { key: 'phone', label: 'Téléphone', type: 'phone', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'nationality', label: 'Nationalité', type: 'text', required: true },
      { key: 'passport', label: 'N° de passeport', type: 'text', required: true },
      { key: 'target_school', label: 'École / université visée', type: 'text', required: true, placeholder: 'Ou domaine souhaité' },
      { key: 'program', label: 'Filière / programme', type: 'text', required: true },
      { key: 'start_period', label: 'Rentrée souhaitée', type: 'select', required: true, options: [
        { value: 'sept', label: 'Septembre' },
        { value: 'march', label: 'Mars' },
        { value: 'other', label: 'Autre' },
      ]},
      { key: 'documents_ready', label: 'Documents prêts ?', type: 'select', required: true, options: [
        { value: 'yes', label: 'Oui (diplômes, passeport…)' },
        { value: 'partial', label: 'Partiellement' },
        { value: 'no', label: 'Non, j’ai besoin d’aide' },
      ]},
      { key: 'notes', label: 'Précisions', type: 'textarea' },
    ],
  },
  {
    slug: 'hotel',
    title: "Réservation d'hôtel",
    shortTitle: 'Hôtel',
    subtitle: 'Hôtels partenaires',
    color: '#D97706',
    Icon: Hotel,
    href: '/services/hotel',
    intro: [
      'Hôtels partenaires près des zones commerciales et entrepôts, tarifs négociés M.O.G.',
    ],
    fields: [
      { key: 'full_name', label: 'Nom complet', type: 'text', required: true },
      { key: 'phone', label: 'Téléphone', type: 'phone', required: true },
      { key: 'city', label: 'Ville', type: 'select', required: true, options: [
        { value: 'guangzhou', label: 'Guangzhou' },
        { value: 'shenzhen', label: 'Shenzhen' },
        { value: 'yiwu', label: 'Yiwu' },
        { value: 'other', label: 'Autre' },
      ]},
      { key: 'check_in', label: 'Date d’arrivée', type: 'date', required: true },
      { key: 'check_out', label: 'Date de départ', type: 'date', required: true },
      { key: 'guests', label: 'Nombre de personnes', type: 'number', required: true, placeholder: '1' },
      { key: 'room_type', label: 'Type de chambre', type: 'select', required: true, options: [
        { value: 'single', label: 'Simple' },
        { value: 'double', label: 'Double' },
        { value: 'twin', label: 'Twin (2 lits)' },
        { value: 'suite', label: 'Suite / Famille' },
      ]},
      { key: 'budget_max', label: 'Budget max / nuit (CNY)', type: 'number', placeholder: '300' },
      { key: 'preferences', label: 'Préférences', type: 'textarea', placeholder: 'Proche métro, petit-déj., near warehouse…' },
    ],
  },
  {
    slug: 'translator',
    title: 'Service de traducteur',
    shortTitle: 'Traducteur',
    subtitle: 'FR / EN / ZH',
    color: '#059669',
    Icon: Languages,
    href: '/services/translator',
    intro: [
      'Traducteur pour rendez-vous fournisseurs, usines, négociation et contrôle qualité.',
    ],
    fields: [
      { key: 'full_name', label: 'Nom complet', type: 'text', required: true },
      { key: 'phone', label: 'Téléphone', type: 'phone', required: true },
      { key: 'language_pair', label: 'Langues', type: 'select', required: true, options: [
        { value: 'fr_zh', label: 'Français ↔ Chinois' },
        { value: 'en_zh', label: 'Anglais ↔ Chinois' },
        { value: 'fr_en_zh', label: 'FR / EN ↔ Chinois' },
      ]},
      { key: 'service_date', label: 'Date souhaitée', type: 'date', required: true },
      { key: 'duration', label: 'Durée', type: 'select', required: true, options: [
        { value: 'half', label: 'Demi-journée' },
        { value: 'full', label: 'Journée complète' },
        { value: 'multi', label: 'Plusieurs jours' },
      ]},
      { key: 'city', label: 'Ville / zone', type: 'text', required: true, placeholder: 'Guangzhou, Shenzhen…' },
      { key: 'meeting_place', label: 'Lieu du rendez-vous', type: 'text', required: true },
      { key: 'purpose', label: 'Objectif', type: 'select', required: true, options: [
        { value: 'factory', label: 'Visite usine' },
        { value: 'negotiation', label: 'Négociation' },
        { value: 'qc', label: 'Contrôle qualité' },
        { value: 'sourcing', label: 'Sourcing / marchés' },
        { value: 'other', label: 'Autre' },
      ]},
      { key: 'notes', label: 'Détails', type: 'textarea' },
    ],
  },
  {
    slug: 'vehicles',
    title: 'Achat & expédition de véhicules',
    shortTitle: 'Véhicules',
    subtitle: 'Afrique centrale & CI',
    color: '#DC2626',
    Icon: Car,
    href: '/services/vehicles',
    intro: [
      'Achat en Chine et acheminement en conteneur vers l’Afrique centrale et la Côte d’Ivoire.',
    ],
    fields: [
      { key: 'full_name', label: 'Nom complet', type: 'text', required: true },
      { key: 'phone', label: 'Téléphone', type: 'phone', required: true },
      { key: 'vehicle_type', label: 'Type de véhicule', type: 'select', required: true, options: [
        { value: 'sedan', label: 'Berline' },
        { value: 'suv', label: 'SUV / 4x4' },
        { value: 'pickup', label: 'Pick-up' },
        { value: 'van', label: 'Utilitaire / van' },
        { value: 'truck', label: 'Camion' },
        { value: 'moto', label: 'Moto' },
        { value: 'other', label: 'Autre' },
      ]},
      { key: 'brand_model', label: 'Marque / modèle souhaité', type: 'text', required: true, placeholder: 'Ex. Toyota Land Cruiser' },
      { key: 'year_min', label: 'Année minimum', type: 'number', placeholder: '2018' },
      { key: 'budget_max', label: 'Budget max (USD ou CNY)', type: 'text', required: true, placeholder: 'Ex. 15 000 USD' },
      { key: 'destination', label: 'Pays de destination', type: 'select', required: true, options: [
        { value: 'cm', label: 'Cameroun' },
        { value: 'ga', label: 'Gabon' },
        { value: 'gq', label: 'Guinée équatoriale' },
        { value: 'cg', label: 'Congo' },
        { value: 'cd', label: 'RD Congo' },
        { value: 'td', label: 'Tchad' },
        { value: 'ci', label: "Côte d'Ivoire" },
      ]},
      { key: 'condition', label: 'État', type: 'select', required: true, options: [
        { value: 'used', label: 'Occasion' },
        { value: 'new', label: 'Neuf' },
        { value: 'either', label: 'Indifférent' },
      ]},
      { key: 'notes', label: 'Précisions', type: 'textarea', placeholder: 'Couleur, options, délai…' },
    ],
  },
];

export const getServiceBySlug = (slug?: string | null) =>
  SERVICES.find((s) => s.slug === slug);
