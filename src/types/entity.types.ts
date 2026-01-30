import type { Object3D } from 'three';
import type { Component } from '../core/Component';

export interface EntityOptions {
  id?: string;
  name?: string;
  tags?: string[];
  active?: boolean;
}

export type ComponentClass<T extends Component = Component> = new (
  ...args: unknown[]
) => T;

export interface EntityQuery {
  tags?: string[];
  active?: boolean;
  name?: string;
}

export interface EntityEvents {
  componentAdded: { component: Component };
  componentRemoved: { component: Component };
  tagAdded: { tag: string };
  tagRemoved: { tag: string };
  activated: void;
  deactivated: void;
  destroyed: void;
}

export interface IEntity extends Object3D {
  readonly entityId: string;
  readonly tags: ReadonlySet<string>;
  active: boolean;

  addComponent<T extends Component>(component: T): T;
  removeComponent<T extends Component>(componentClass: ComponentClass<T>): boolean;
  getComponent<T extends Component>(componentClass: ComponentClass<T>): T | undefined;
  hasComponent<T extends Component>(componentClass: ComponentClass<T>): boolean;

  addTag(tag: string): void;
  removeTag(tag: string): void;
  hasTag(tag: string): boolean;

  update(deltaTime: number): void;
  destroy(): void;
}
