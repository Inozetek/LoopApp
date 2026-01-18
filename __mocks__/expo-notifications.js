module.exports = {
  getPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', canAskAgain: true })
  ),
  requestPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', canAskAgain: true })
  ),
  getExpoPushTokenAsync: jest.fn(() =>
    Promise.resolve({ data: 'ExponentPushToken[test-token]' })
  ),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  AndroidImportance: {
    DEFAULT: 3,
    HIGH: 4,
    LOW: 2,
    MAX: 5,
    MIN: 1,
    NONE: 0,
  },
};
