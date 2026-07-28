import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  Link: ({ children }: any) => children,
}));

const mockLogin = jest.fn();
const mockBootstrap = jest.fn();
jest.mock('../../src/store/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: any) => selector({ login: mockLogin, loading: false }),
    { getState: () => ({ bootstrap: mockBootstrap, user: null }) },
  ),
}));

jest.mock('../../src/api/client', () => ({
  formatErr: (_e: any, fallback: string) => fallback,
  saveTokens: jest.fn(),
  BASE: 'http://test',
}));

jest.mock('../../src/api/biometrics', () => ({
  biometricService: {
    isEnabled: jest.fn().mockResolvedValue(false),
    authenticate: jest.fn(),
  },
}));

jest.mock('../../src/components/LanguageSelector', () => () => null);

import LoginScreen from '../../app/(auth)/login';

describe('LoginScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it("affiche une erreur inline quand l'email est invalide et n'appelle pas login", async () => {
    await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByTestId('login-email'), 'pas-un-email');
    await fireEvent.changeText(screen.getByTestId('login-password'), '123456');
    await fireEvent.press(screen.getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('login-email-error')).toBeTruthy();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('exige un mot de passe de 6 caractères minimum', async () => {
    await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByTestId('login-email'), 'client@mog.com');
    await fireEvent.changeText(screen.getByTestId('login-password'), '123');
    await fireEvent.press(screen.getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('login-password-error')).toBeTruthy();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('connecte un client et redirige vers les onglets', async () => {
    mockLogin.mockResolvedValue({ role: 'client' });
    await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByTestId('login-email'), 'client@mog.com');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'secret123');
    await fireEvent.press(screen.getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('client@mog.com', 'secret123');
    });
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it("redirige un opérateur vers l'espace opérateur", async () => {
    mockLogin.mockResolvedValue({ role: 'operator' });
    await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByTestId('login-email'), 'op@mog.com');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'secret123');
    await fireEvent.press(screen.getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(operator)');
    });
  });
});
