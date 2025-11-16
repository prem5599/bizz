export const getServerSession = jest.fn().mockResolvedValue({
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  },
});

export const authOptions = {};

export default {
  getServerSession,
  authOptions,
};