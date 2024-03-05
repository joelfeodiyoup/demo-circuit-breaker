type State = "CLOSED" | "OPEN" | "HALF-OPEN";

type Options = {
  /** how many errors are allowed within range? */
  errorThreshold: number,
  /** time window: [now, now - this value]. track errors within tihs range */
  errorThresholdTimeWindowMilliseconds: number,
  /** state of circuit breaker. e.g. open / closed / half-open */
  state: State,
  errorTimes: number[],
  timeOfOpen: number | undefined
}

export class CircuitBreaker {
  private options: Options = {
    errorThreshold: 3,
    errorThresholdTimeWindowMilliseconds: 3000,
    state: "CLOSED",
    errorTimes: [],
    timeOfOpen: undefined,
  };
  public defaultErrorMessage = `Function errored more than ${this.options.errorThreshold} during time window of ${this.options.errorThresholdTimeWindowMilliseconds}ms`;

  constructor(
    private f: () => void,
    options: Partial<Options>
  ) {
    Object.assign(this.options, options);
  }

  public get status() {
    return {
      state: this.options.state,
      errorTimes: this.options.errorTimes,
    }
  }
  
  public fire() {
    this.removeErrorsOutsideErrorWindow();
    if (this.options.state === "OPEN") {
      throw new Error(this.defaultErrorMessage);
    }
    try {
      this.f();

      // the function was successful
      if (this.options.state === "HALF-OPEN") {
        this.options.state = "CLOSED";
      }
    } catch (e) {
      if (this.options.state === "HALF-OPEN") {
        // when half-open, every error switches the state to "OPEN"
        this.options.state = "OPEN";
      } else if (this.options.state === "CLOSED") {
        this.options.errorTimes.push(this.currentTime());
        
        if (this.options.errorTimes.length >= this.options.errorThreshold) {
          // in the OPEN state, no function calls happen.
          this.options.state = "OPEN";
          // after some length of time, it changes to HALF-OPEN
          setTimeout(() => this.options.state = "HALF-OPEN", this.options.errorThresholdTimeWindowMilliseconds);
        }
      }
    }
  }

  private removeErrorsOutsideErrorWindow() {
    const timeMinusErrorThreshold = this.currentTime() - this.options.errorThresholdTimeWindowMilliseconds;
    this.options.errorTimes = this.options.errorTimes.filter(t => t >= timeMinusErrorThreshold)
  }

  private currentTime() {
    return Date.now();
  }
}
