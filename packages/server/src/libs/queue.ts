import PQueue, { Options } from 'p-queue';
import { QueueAddOptions } from 'p-queue';
import PriorityQueue from 'p-queue/dist/priority-queue.js';

class Queue {
  name: string;
  private _queue: PQueue;

  constructor(name: string, options?: Options<PriorityQueue, QueueAddOptions>) {
    this.name = name;
    this._queue = new PQueue(options);
  }

  async add<T>(fn: () => Promise<T>): Promise<
    | {
        success: true;
        value: T;
      }
    | {
        success: false;
      }
  > {
    return await this._queue.add(
      async () => {
        try {
          const value = await fn();
          return {
            success: true,
            value,
          };
        } catch (error) {
          console.error(`An error occurred while executing a ${this.name} job:`);
          console.error(error);
        }
        return {
          success: false,
        };
      },
      {
        throwOnTimeout: true,
      },
    );
  }
}
export default Queue;
