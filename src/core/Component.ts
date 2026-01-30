import type { Entity } from './Entity';

export abstract class Component {
  private _entity: Entity | null = null;
  private _enabled: boolean = true;

  get entity(): Entity | null {
    return this._entity;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    if (this._enabled !== value) {
      this._enabled = value;
      if (value) {
        this.onEnable();
      } else {
        this.onDisable();
      }
    }
  }

  /** @internal */
  _setEntity(entity: Entity | null): void {
    this._entity = entity;
  }

  onAttach(): void {}

  onDetach(): void {}

  onEnable(): void {}

  onDisable(): void {}

  update(_deltaTime: number): void {}

  destroy(): void {
    if (this._entity) {
      const ComponentClass = this.constructor as new (...args: unknown[]) => Component;
      this._entity.removeComponent(ComponentClass);
    }
  }
}
