export const useSession = jest.fn().mockReturnValue({
  data: {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
    },
  },
  status: 'authenticated',
});

export const signIn = jest.fn().mockResolvedValue({ ok: true });
export const signOut = jest.fn().mockResolvedValue({ ok: true });

export const SessionProvider = ({ children }) => children;