import {
  getActiveContainers,
  getActiveShipments,
  containerProgressIndex,
  normalizeGroupage,
} from '../src/utils/logistics';

describe('logistics.getActiveContainers', () => {
  it('ne garde que les conteneurs aux statuts actifs', () => {
    const groupages: any[] = [
      { id: 'a', status: 'open' },
      { id: 'b', status: 'in_transit' },
      { id: 'c', status: 'delivered' },
      { id: 'd', status: 'draft' },
    ];
    const active = getActiveContainers(groupages);
    expect(active.map((g) => g.id)).toEqual(['a', 'b']);
  });
});

describe('logistics.getActiveShipments', () => {
  const containers: any[] = [
    { id: 'B0230', status: 'in_transit' },
    { id: 'CLOSED', status: 'delivered' },
  ];

  it('inclut les colis dont le statut logistique est en cours', () => {
    const colis: any[] = [{ id: '1', status: 'in_transit' }];
    expect(getActiveShipments(colis, containers).map((c) => c.id)).toEqual(['1']);
  });

  it('inclut un colis rattaché à un conteneur actif même si son statut est en retard', () => {
    const colis: any[] = [{ id: '2', status: 'received', container_id: 'B0230' }];
    expect(getActiveShipments(colis, containers).map((c) => c.id)).toEqual(['2']);
  });

  it('exclut les colis livrés / endommagés / brouillon', () => {
    const colis: any[] = [
      { id: '3', status: 'delivered', container_id: 'B0230' },
      { id: '4', status: 'damaged' },
      { id: '5', status: 'draft' },
    ];
    expect(getActiveShipments(colis, containers)).toHaveLength(0);
  });

  it('exclut un colis rattaché à un conteneur inactif', () => {
    const colis: any[] = [{ id: '6', status: 'received', container_id: 'CLOSED' }];
    expect(getActiveShipments(colis, containers)).toHaveLength(0);
  });
});

describe('logistics.containerProgressIndex', () => {
  it('mappe les statuts de progression', () => {
    expect(containerProgressIndex('closed')).toBe(0);
    expect(containerProgressIndex('in_transit')).toBe(1);
    expect(containerProgressIndex('customs')).toBe(2);
    expect(containerProgressIndex('arrived')).toBe(3);
    expect(containerProgressIndex('distributed')).toBe(4);
  });

  it('renvoie 0 pour open et -1 pour inconnu', () => {
    expect(containerProgressIndex('open')).toBe(0);
    expect(containerProgressIndex('mystere')).toBe(-1);
    expect(containerProgressIndex(undefined)).toBe(-1);
  });
});

describe('logistics.normalizeGroupage', () => {
  it('normalise id et mode depuis des champs alternatifs', () => {
    const g = normalizeGroupage({ _id: 'x1', transport_mode: 'air', destination_city: 'Douala' });
    expect(g.id).toBe('x1');
    expect(g.mode).toBe('air');
    expect(g.transport_mode).toBe('air');
    expect(g.destination_port).toBe('Douala');
    expect(g.origin_port).toBe('Guangzhou');
  });
});
