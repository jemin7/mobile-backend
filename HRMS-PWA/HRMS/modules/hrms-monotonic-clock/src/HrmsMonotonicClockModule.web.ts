const HrmsMonotonicClock = {
  getMonotonicTimeMs: () => performance.now(),
  getBootCount: () => -1,
};

export default HrmsMonotonicClock;
