export class DirtyFlag {
  private isSet: boolean;

  public constructor(isSet: boolean = false) {
    this.isSet = isSet;
  }

  public setDirty(): void {
    this.isSet = true;
  }

  public readAndClear(): boolean {
    const wasSet = this.isSet;
    this.isSet = false;
    return wasSet;
  }
}
