/** Promise가 ms 안에 끝나지 않으면 reject */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = '시간이 초과됐어요',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message));
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}
