import { Scene } from 'three';
import { Entity } from './Entity';
import { EventEmitter } from '../utils/EventEmitter';
import type { EntityQuery } from '../types/entity.types';

interface EntityManagerEvents {
  entityAdded: { entity: Entity };
  entityRemoved: { entity: Entity };
}

export class EntityManager {
  private entities: Map<string, Entity> = new Map();
  private tagIndex: Map<string, Set<Entity>> = new Map();
  private scene: Scene;

  readonly events: EventEmitter<EntityManagerEvents> = new EventEmitter();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  add(entity: Entity): Entity {
    if (this.entities.has(entity.entityId)) {
      console.warn(`Entity with id "${entity.entityId}" already exists`);
      return entity;
    }

    this.entities.set(entity.entityId, entity);
    this.scene.add(entity);

    entity.tags.forEach((tag) => {
      this.addToTagIndex(tag, entity);
    });

    entity.events.on('tagAdded', ({ tag }) => {
      this.addToTagIndex(tag, entity);
    });

    entity.events.on('tagRemoved', ({ tag }) => {
      this.removeFromTagIndex(tag, entity);
    });

    entity.events.on('destroyed', () => {
      this.remove(entity.entityId);
    });

    this.events.emit('entityAdded', { entity });

    return entity;
  }

  remove(entityId: string): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return false;
    }

    entity.tags.forEach((tag) => {
      this.removeFromTagIndex(tag, entity);
    });

    this.entities.delete(entityId);
    this.scene.remove(entity);

    this.events.emit('entityRemoved', { entity });

    return true;
  }

  get(entityId: string): Entity | undefined {
    return this.entities.get(entityId);
  }

  getByName(name: string): Entity | undefined {
    for (const entity of this.entities.values()) {
      if (entity.name === name) {
        return entity;
      }
    }
    return undefined;
  }

  getByTag(tag: string): Entity[] {
    return Array.from(this.tagIndex.get(tag) ?? []);
  }

  getByTags(tags: string[]): Entity[] {
    if (tags.length === 0) return [];

    const firstTagEntities = this.tagIndex.get(tags[0]);
    if (!firstTagEntities) return [];

    return Array.from(firstTagEntities).filter((entity) =>
      tags.slice(1).every((tag) => entity.hasTag(tag))
    );
  }

  query(query: EntityQuery): Entity[] {
    let result = Array.from(this.entities.values());

    if (query.tags && query.tags.length > 0) {
      result = result.filter((entity) => entity.hasTags(query.tags!));
    }

    if (query.active !== undefined) {
      result = result.filter((entity) => entity.active === query.active);
    }

    if (query.name !== undefined) {
      result = result.filter((entity) => entity.name === query.name);
    }

    return result;
  }

  getAll(): Entity[] {
    return Array.from(this.entities.values());
  }

  count(): number {
    return this.entities.size;
  }

  update(deltaTime: number): void {
    this.entities.forEach((entity) => {
      entity.update(deltaTime);
    });
  }

  clear(): void {
    this.entities.forEach((entity) => {
      entity.destroy();
    });
    this.entities.clear();
    this.tagIndex.clear();
  }

  private addToTagIndex(tag: string, entity: Entity): void {
    if (!this.tagIndex.has(tag)) {
      this.tagIndex.set(tag, new Set());
    }
    this.tagIndex.get(tag)!.add(entity);
  }

  private removeFromTagIndex(tag: string, entity: Entity): void {
    const tagSet = this.tagIndex.get(tag);
    if (tagSet) {
      tagSet.delete(entity);
      if (tagSet.size === 0) {
        this.tagIndex.delete(tag);
      }
    }
  }
}
