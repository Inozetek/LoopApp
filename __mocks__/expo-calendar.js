module.exports = {
  requestCalendarPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', canAskAgain: true })
  ),
  getCalendarsAsync: jest.fn(() =>
    Promise.resolve([
      {
        id: 'default-calendar',
        title: 'Default Calendar',
        source: { name: 'Local' },
        color: '#0000FF',
        allowsModifications: true,
        type: 'LOCAL',
      },
    ])
  ),
  getEventsAsync: jest.fn(() => Promise.resolve([])),
  createEventAsync: jest.fn(() => Promise.resolve('event-id')),
  updateEventAsync: jest.fn(() => Promise.resolve()),
  deleteEventAsync: jest.fn(() => Promise.resolve()),
  EntityTypes: {
    EVENT: 'event',
    REMINDER: 'reminder',
  },
  CalendarAccessLevel: {
    CONTRIBUTOR: 'contributor',
    EDITOR: 'editor',
    FREEBUSY: 'freebusy',
    NONE: 'none',
    OWNER: 'owner',
    READ: 'read',
    RESPOND: 'respond',
    ROOT: 'root',
  },
};
