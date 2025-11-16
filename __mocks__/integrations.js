export const shopifyIntegration = {
  connect: jest.fn().mockResolvedValue({ success: true }),
  disconnect: jest.fn().mockResolvedValue({ success: true }),
  sync: jest.fn().mockResolvedValue({ success: true }),
  test: jest.fn().mockResolvedValue({ success: true }),
};

export const stripeIntegration = {
  connect: jest.fn().mockResolvedValue({ success: true }),
  disconnect: jest.fn().mockResolvedValue({ success: true }),
  sync: jest.fn().mockResolvedValue({ success: true }),
  test: jest.fn().mockResolvedValue({ success: true }),
};

export const googleAnalyticsIntegration = {
  connect: jest.fn().mockResolvedValue({ success: true }),
  disconnect: jest.fn().mockResolvedValue({ success: true }),
  sync: jest.fn().mockResolvedValue({ success: true }),
  test: jest.fn().mockResolvedValue({ success: true }),
};

export const wooCommerceIntegration = {
  connect: jest.fn().mockResolvedValue({ success: true }),
  disconnect: jest.fn().mockResolvedValue({ success: true }),
  sync: jest.fn().mockResolvedValue({ success: true }),
  test: jest.fn().mockResolvedValue({ success: true }),
};