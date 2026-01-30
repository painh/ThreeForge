import { Object3D } from 'three';
import { Component } from './Component';
import { EventEmitter } from '../utils/EventEmitter';
import type { EntityOptions, ComponentClass, EntityEvents } from '../types/entity.types';

let entityIdCounter = 0;

function generateEntityId(): string {
  return `entity_${++entityIdCounter}`;
}

export class Entity extends Object3D {
  readonly entityId: string;
  private _tags: Set<string> = new Set();
  private _active: boolean = true;
  private _components: Map<ComponentClass, Component> = new Map();

  readonly events: EventEmitter<EntityEvents> = new EventEmitter();

  constructor(options: EntityOptions = {}) {
    super();
    this.entityId = options.id ?? generateEntityId();
    this.name = options.name ?? this.entityId;
    this._active = options.active ?? true;

    if (options.tags) {
      options.tags.forEach((tag) => this._tags.add(tag));
    }
  }

  get tags(): ReadonlySet<string> {
    return this._tags;
  }

  get active(): boolean {
    return this._active;
  }

  set active(value: boolean) {
    if (this._active !== value) {
      this._active = value;
      this.visible = value;
      if (value) {
        this.events.emit('activated', undefined as unknown as void);
      } else {
        this.events.emit('deactivated', undefined as unknown as void);
      }
    }
  }

  addComponent<T extends Component>(component: T): T {
    const ComponentClass = component.constructor as ComponentClass<T>;

    if (this._components.has(ComponentClass)) {
      console.warn(`Entity "${this.name}" already has component of type ${ComponentClass.name}`);
      return this._components.get(ComponentClass) as T;
    }

    this._components.set(ComponentClass, component);
    component._setEntity(this);
    component.onAttach();
    this.events.emit('componentAdded', { component });

    return component;
  }

  removeComponent<T extends Component>(componentClass: ComponentClass<T>): boolean {
    const component = this._components.get(componentClass);
    if (!component) {
      return false;
    }

    component.onDetach();
    component._setEntity(null);
    this._components.delete(componentClass);
    this.events.emit('componentRemoved', { component });

    return true;
  }

  getComponent<T extends Component>(componentClass: ComponentClass<T>): T | undefined {
    return this._components.get(componentClass) as T | undefined;
  }

  hasComponent<T extends Component>(componentClass: ComponentClass<T>): boolean {
    return this._components.has(componentClass);
  }

  getComponents(): Component[] {
    return Array.from(this._components.values());
  }

  addTag(tag: string): void {
    if (!this._tags.has(tag)) {
      this._tags.add(tag);
      this.events.emit('tagAdded', { tag });
    }
  }

  removeTag(tag: string): void {
    if (this._tags.has(tag)) {
      this._tags.delete(tag);
      this.events.emit('tagRemoved', { tag });
    }
  }

  hasTag(tag: string): boolean {
    return this._tags.has(tag);
  }

  hasTags(tags: string[]): boolean {
    return tags.every((tag) => this._tags.has(tag));
  }

  hasAnyTag(tags: string[]): boolean {
    return tags.some((tag) => this._tags.has(tag));
  }

  update(deltaTime: number): void {
    if (!this._active) return;

    this._components.forEach((component) => {
      if (component.enabled) {
        component.update(deltaTime);
      }
    });
  }

  destroy(): void {
    this._components.forEach((component) => {
      component.onDetach();
      component._setEntity(null);
    });
    this._components.clear();

    this.removeFromParent();

    this.events.emit('destroyed', undefined as unknown as void);
    this.events.removeAllListeners();
  }
}
