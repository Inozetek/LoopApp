module.exports = {
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  requestBackgroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: {
        latitude: 32.7767,
        longitude: -96.797,
        accuracy: 10,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        speed: 0,
      },
      timestamp: Date.now(),
    })
  ),
  watchPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: {
        latitude: 32.7767,
        longitude: -96.797,
        accuracy: 10,
      },
    })
  ),
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
};
