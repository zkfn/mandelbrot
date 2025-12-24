const DESTROYED_SYMBOL = Symbol("destroyed");

export class Destroyable {
  private [DESTROYED_SYMBOL]?: boolean;

  public destroy(): void {
    this[DESTROYED_SYMBOL] = true;
  }

  public isDestroyed(): boolean {
    return this[DESTROYED_SYMBOL] === true;
  }
}

export function checkDestroyed(
  _target: Destroyable,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = function (this: { [DESTROYED_SYMBOL]?: boolean }, ...args: unknown[]) {
    if (this[DESTROYED_SYMBOL] === true) {
      throw new Error(`Cannot call method '${propertyKey}' on destroyed object`);
    }
    return originalMethod.apply(this, args);
  };

  return descriptor;
}
