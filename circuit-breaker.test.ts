import { CircuitBreaker } from "./circuit-breaker";
import { test, describe, expect, beforeEach, afterEach, jest } from "@jest/globals";

beforeEach(() => {
  jest.useFakeTimers();
})

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
})

test('When the circuit breaker is in the CLOSED state, all function calls are executed normally', () => {
  const fn = jest.fn();
  const circuitBreaker = new CircuitBreaker(fn, {state: "CLOSED"});
  circuitBreaker.fire();
  expect(fn).toHaveBeenCalled();
});

test('when a specified number of errors occur in a short time it switches to the OPEN state', () => {
  const shortTime = 1000;
  const specifiedNumberOfErrors = 4;
  const failingFunction = jest.fn(() => {throw new Error("error")});
  const circuitBreaker = new CircuitBreaker(failingFunction, {
    state: "CLOSED",
    errorThresholdTimeWindowMilliseconds: shortTime,
    errorThreshold: specifiedNumberOfErrors
  });
  Array.from(Array(specifiedNumberOfErrors)).forEach(() => {
    circuitBreaker.fire();
  }) 
  expect(circuitBreaker.status.state).toBe("OPEN");
})

test('when less than a specified number of errors occur in a short time it stays CLOSED', () => {
  const shortTime = 1000;
  const specifiedNumberOfErrors = 4;
  const failingFunction = jest.fn(() => {throw new Error("error")});
  const circuitBreaker = new CircuitBreaker(failingFunction, {
    state: "CLOSED",
    errorThresholdTimeWindowMilliseconds: shortTime,
    errorThreshold: specifiedNumberOfErrors
  });
  Array.from(Array(specifiedNumberOfErrors - 1)).forEach(() => {
    circuitBreaker.fire();
  }) 
  expect(circuitBreaker.status.state).toBe("CLOSED");
})

test('when a specified number of errors occur, but not in a short time it stays CLOSED', async () => {
  jest.useRealTimers();
  const shortTime = 1000; 
  const specifiedNumberOfErrors = 4;
  const failingFunction = jest.fn(() => {throw new Error("error")});
  const circuitBreaker = new CircuitBreaker(failingFunction, {
    state: "CLOSED",
    errorThresholdTimeWindowMilliseconds: shortTime,
    errorThreshold: specifiedNumberOfErrors
  });
  Array.from(Array(specifiedNumberOfErrors - 1)).forEach(() => {
    circuitBreaker.fire();
  }) 
  setTimeout(() => {
    circuitBreaker.fire();
  }, shortTime + 3000);
  expect(circuitBreaker.status.state).toBe("CLOSED");
})

describe('when in the open state...', () => {
  const fn = jest.fn();
  const circuitBreaker = new CircuitBreaker(fn, {state: "OPEN"});
  try {
    circuitBreaker.fire();
  } catch(e) {
    test('throws errors directly', () => {
      expect((e as Error).message).toBe(circuitBreaker.defaultErrorMessage);
    })
  } finally {
    test('the function isn\'t called', () => {
      expect(fn).not.toHaveBeenCalled;
    });
  }
})

test('when OPEN for the specified time it switches to HALF-OPEN', async () => {
  const fn = jest.fn();
  const specifiedTime = 1000;
  const circuitBreaker = new CircuitBreaker(fn, {state: "OPEN", errorThresholdTimeWindowMilliseconds: specifiedTime});
  setTimeout(() => expect(circuitBreaker.status.state).toBe("HALF-OPEN"), specifiedTime);
});

test('when OPEN for less than the specified time it is still OPEN', async () => {
  const fn = jest.fn();
  const specifiedTime = 1000;
  const circuitBreaker = new CircuitBreaker(fn, {state: "OPEN", errorThresholdTimeWindowMilliseconds: specifiedTime});
  setTimeout(() => {
  }, specifiedTime - 1);
  expect(circuitBreaker.status.state).toEqual("OPEN")
});

test('when in HALF-OPEN, every error switches it to OPEN state', () => {
  const fn = jest.fn(() => {throw new Error('failed')});
  const specifiedTime = 1000;
  const circuitBreaker = new CircuitBreaker(fn, {state: "HALF-OPEN", errorThresholdTimeWindowMilliseconds: specifiedTime});
  setTimeout(() => {
  }, specifiedTime - 1);
  // fire the function, which will fail, within the time window.
  circuitBreaker.fire();
  expect(circuitBreaker.status.state).toBe("OPEN");
})

test('when in HALF-OPEN, when one call is successful it returns to the CLOSED state', () => {
  const fn = jest.fn();
  const specifiedTime = 1000;
  const circuitBreaker = new CircuitBreaker(fn, {state: "HALF-OPEN", errorThresholdTimeWindowMilliseconds: specifiedTime});
  setTimeout(() => {
  }, specifiedTime - 1);
  // fire the function, which is successful, within the time window.
  circuitBreaker.fire();
  expect(circuitBreaker.status.state).toBe("CLOSED");
})