import AbortController from 'abort-controller';

/**
 * Takes in a generator function and creates a regular function
 * that calls (goes through all the values generated by)
 * the generator function, but it:
 * 1. makes it interruptible on the generator function's `yield`s
 *    (interrupting = stopping generating new values from the generator)
 * 2. makes it automatically interrupted by another call.
 *
 * It always calls the iterator for the next value passing in
 * awaited result of a previous yielded value which makes
 * it easy to create interruptible asynchronous methods.
 *
 * For more information see https://dev.to/chromiumdev/cancellable-async-functions-in-javascript-5gp7
 *
 * @param func The generator function
 * @return An array of three elements:
 * 1. An async function that triggers "calling" the generator passed in.
 *    It resolves with the final value returned by the generator
 *    or undefined if the call has been interrupted by another call.
 * 2. A function returning whether any call has already been made
 *    to the generator.
 * 3. A function interrupting processing of the generator.
 */
export default function makeInterruptible<Arguments extends any[] = any[], Result = void>(
  func: (
    ...args: Arguments
  ) => AsyncGenerator<unknown, Result, unknown> | Generator<unknown, Result, unknown>
): [(...args: Arguments) => Promise<Result | undefined>, () => boolean, () => void] {
  let globalAbortController: null | AbortController = null;
  let hasBeenCalled = false;

  function hasBeenCalledAtLeastOnce() {
    return hasBeenCalled;
  }

  function interrupt() {
    globalAbortController?.abort();
    globalAbortController = null;
  }

  async function callFunc(...args: Arguments) {
    hasBeenCalled = true;
    // Interrupt any existing calls
    interrupt();
    globalAbortController = new AbortController();
    const localAbortController = globalAbortController;

    const iterator = func(...args);
    let resumeValue: any;
    while (true) {
      // Guard before .next() await
      if (localAbortController.signal.aborted) {
        return; // a new call was made
      }
      // We can use a mix of function generator and asynchronous function
      // as per https://www.pluralsight.com/guides/using-asyncawait-with-generator-functions.
      const element = await iterator.next(resumeValue);
      if (element.done) {
        return element.value; // final return value of passed generator
      }

      // Guard before await
      if (localAbortController.signal.aborted) {
        return; // a new call was made
      }
      // whatever the generator yielded, _now_ run await on it
      resumeValue = await element.value;
      // next loop, we'll give resumeValue back to the generator
    }
  }

  return [callFunc, hasBeenCalledAtLeastOnce, interrupt];
}
