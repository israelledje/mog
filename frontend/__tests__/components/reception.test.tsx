import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));

jest.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'op1', role: 'operator', full_name: 'Op Test' } }),
}));

const mockAddToQueue = jest.fn();
jest.mock('../../src/store/syncStore', () => ({
  useSyncStore: (selector: any) => selector({ addToQueue: mockAddToQueue }),
}));

const mockList = jest.fn();
jest.mock('../../src/api/colis', () => ({
  colisApi: {
    list: (...args: any[]) => mockList(...args),
    receive: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../../src/components/QRScanner', () => () => null);

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn().mockResolvedValue({ isConnected: true }) },
}));

import ReceptionScreen from '../../app/(operator)/reception';

const PENDING = [
  { id: 'c1', tracking_number: 'MOG-1001', description: 'Cartons', owner_id: 'user-a' },
  { id: 'c2', tracking_number: 'MOG-1002', description: 'Textile', owner_id: 'user-b' },
];

describe('ReceptionScreen (opérateur)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Au montage: liste des colis en attente. À la recherche: résultat par tracking.
    mockList.mockImplementation((params: any) => {
      if (params?.status === 'pending_reception') return Promise.resolve(PENDING);
      if (params?.tracking_number === 'MOG-1002') return Promise.resolve([PENDING[1]]);
      return Promise.resolve([]);
    });
  });

  it('charge et affiche les colis attendus au montage', async () => {
    await render(<ReceptionScreen />);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith({ status: 'pending_reception' });
    });
    expect(await screen.findByText('MOG-1001')).toBeTruthy();
    expect(screen.getByText('MOG-1002')).toBeTruthy();
  });

  it('recherche un colis par tracking et passe à la fiche de réception', async () => {
    await render(<ReceptionScreen />);
    await screen.findByText('MOG-1001');

    await fireEvent.changeText(
      screen.getByPlaceholderText('operator.tracking_or_mark'),
      'MOG-1002',
    );
    await fireEvent.press(screen.getByText('OK'));

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith({ tracking_number: 'MOG-1002' });
    });
  });
});
