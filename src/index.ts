// Core
export { Entity } from './core/Entity';
export { EntityManager } from './core/EntityManager';
export { Component } from './core/Component';
export { StatValue, StatContainer } from './core/StatModifier';
export type { Modifier, ModifierType } from './core/StatModifier';

// Resource
export { ResourceManager } from './resource/ResourceManager';
export type { ResourceManifest, LoadingProgress, ProgressCallback } from './resource/ResourceManager';

// State
export { State } from './state/State';
export { StateMachine } from './state/StateMachine';
export { StateMachineComponent } from './state/StateMachineComponent';

// Inventory
export { Item } from './inventory/Item';
export type { ItemConfig, ItemRarity, ItemStats, ItemEffects, ItemEffectContext, ItemEffectFunction } from './inventory/Item';
export { Inventory } from './inventory/Inventory';
export type { InventoryConfig, InventoryEvents } from './inventory/Inventory';
export { Equipment, DEFAULT_EQUIPMENT_SLOTS } from './inventory/Equipment';
export type { EquipmentSlotConfig, EquipmentEvents } from './inventory/Equipment';
export { InventoryComponent } from './inventory/InventoryComponent';
export type { InventoryComponentConfig } from './inventory/InventoryComponent';

// UI (optional - requires three-mesh-ui)
export { DEFAULT_UI_THEME, mergeTheme } from './ui/UITheme';
export type { UITheme } from './ui/UITheme';
export { InventoryGridUI } from './ui/InventoryGridUI';
export type { InventoryGridUIConfig } from './ui/InventoryGridUI';
export { EquipmentUI, DEFAULT_EQUIPMENT_LAYOUT, DEFAULT_EQUIPMENT_COLS, DEFAULT_EQUIPMENT_ROWS } from './ui/EquipmentUI';
export type { EquipmentUIConfig, EquipmentSlotPosition } from './ui/EquipmentUI';
export { InventoryScreen } from './ui/InventoryScreen';
export type { InventoryScreenConfig } from './ui/InventoryScreen';

// Effects
export { RibbonTrail } from './effects/RibbonTrail';
export type { RibbonTrailOptions } from './effects/RibbonTrail';
export { FlowingLines } from './effects/FlowingLines';
export type { FlowingLinesOptions } from './effects/FlowingLines';
export { ScreenFade } from './effects/ScreenFade';
export type { ScreenFadeOptions } from './effects/ScreenFade';

// Utils
export { EventEmitter } from './utils/EventEmitter';

// Types
export type {
  EntityOptions,
  ComponentClass,
  EntityQuery,
} from './types/entity.types';

export type {
  StateConfig,
  TransitionCondition,
  StateMachineConfig,
  StateEvents,
} from './types/state.types';
