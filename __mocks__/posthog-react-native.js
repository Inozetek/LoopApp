// Mock PostHog for Jest tests
class PostHog {
  constructor() {}
  capture() {}
  identify() {}
  reset() {}
  screen() {}
  flush() {}
}

module.exports = PostHog;
module.exports.default = PostHog;
